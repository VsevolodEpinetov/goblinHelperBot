# Cutover Runbook

## Pre-flight (T-24h)

- [ ] `git status` clean on `rewrite` branch.
- [ ] `npm ci && npm run build && npm test` — all green.
- [ ] `.env` populated with:
      `TOKEN`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`,
      `REDIS_HOST`, `REDIS_PORT`, optional `REDIS_PASSWORD`,
      `ADMIN_NOTIFICATIONS_CHAT`, optional `SENTRY_DSN`, optional `TEST_USER_ID`.
- [ ] PostgreSQL reachable; user has `CREATE` on the target schema.
- [ ] Redis reachable.
- [ ] Run `npm run audit` against the production DB; resolve any anomalies it
      reports (duplicate achievements, stale `paymentTracking.pending` > 30 days,
      `userGroups` rows lacking `paymentTracking`).
- [ ] **Schema introspection for the migration-018 manifest.** The legacy
      `helpers.js` source-of-truth was deleted in this rewrite, so a few tables
      had their RENAMES manifest built from inference rather than direct
      inspection. Run these against production and cross-check every camelCase
      column against `src/db/migrations/018_rename_camelcase_to_snakecase.ts`.
      Any column listed by psql that is NOT in the manifest will stay camelCase
      after the migration and be invisible to the new code:
      ```
      psql ... -c '\d+ "userPurchases"'
      psql ... -c '\d+ "userRoles"'
      psql ... -c '\d+ "userGroups"'
      psql ... -c '\d+ "userKickstarters"'
      ```
      Pay particular attention to `createdAt` / `updatedAt` timestamps —
      the legacy pattern added these to most tables. If any are missing
      from the 018 manifest, add them before running `npm run migrate`.

## Backup (T-1h)

- [ ] `pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -Fc -f goblin_$(date +%Y%m%d_%H%M%S).dump`
- [ ] Verify the dump file size is non-zero and reasonable.
- [ ] Copy the dump to a SECOND location (USB, cloud) — this is your only recovery.

## Stop the legacy bot

- [ ] Stop the running legacy process (whatever process manager you use:
      `pm2 stop bot`, `systemctl stop goblin-bot`, or kill it directly).
- [ ] Confirm it's not running: no replies to a test `/start`.

## Migrate

- [ ] `npm run migrate` — applies migrations 017–022.
- [ ] Watch for the per-migration log lines. If any migration fails, the
      transaction rolls back and the DB is left at the previous state.
- [ ] If a migration fails: restore from the dump, investigate, fix, re-try.

## Smoke-check the migrated schema

- [ ] `psql ... -c "SELECT COUNT(*) FROM users"` — same count as pre-migration.
- [ ] `psql ... -c "SELECT COUNT(*) FROM user_groups"` — same count.
- [ ] `psql ... -c "SELECT COUNT(*) FROM payment_tracking"` — same count.
- [ ] `psql ... -c "SELECT DISTINCT source FROM payment_tracking"` — should
      include `'stars'` (backfilled by migration 019).
- [ ] `psql ... -c "\d users"` — column names are snake_case
      (`first_name`, `created_at`, etc.).
- [ ] `psql ... -c 'SELECT 1 FROM "userLoyalty" LIMIT 1'` — should error
      "relation does not exist" (dropped by migration 021; note the
      double quotes — the legacy table name is camelCase, not snake_case,
      and PostgreSQL needs the quotes to preserve the case).
- [ ] `psql ... -c '\d+ "user_groups"'` and the same for `"user_roles"`,
      `"user_purchases"`, `"user_kickstarters"` — every column should be
      snake_case now. Any leftover camelCase column = migration 018 missed it.

## Start the new bot

- [ ] `npm start` (or your process-manager start command pointing at
      `node dist/index.js`).
- [ ] Tail logs for 5 minutes.
- [ ] In Telegram, send `/start` from a test account. Verify response.
- [ ] If staff, send `/admin` — verify the admin menu opens.
- [ ] Send a small Telegram Stars test payment (e.g., for an old month or
      a kickstarter that costs <50 stars). Verify:
      - `pre_checkout_query` accepted
      - `successful_payment` processed
      - DM confirmation received
      - `payment_tracking` row with `status='completed'` and the
        `telegram_payment_charge_id` set.

## Soak (T+1h to T+24h)

- [ ] Monitor logs for `error.unhandled`, `payments.precheckout_rejected`,
      `payments.unknown_payload` counters.
- [ ] Watch `metrics.snapshot()` (admin command `/admin metrics` if exposed,
      otherwise via SQL on the metrics counters that are logged hourly).

## Rollback criteria

Rollback if ANY of the following are observed within the first 24h:

- A payment succeeds in Telegram but the user did NOT get access.
- Any user is in `user_groups` they did not pay for.
- Any double-charge (two `payment_tracking` rows with the same
  `telegram_payment_charge_id` — should be impossible due to UNIQUE, but
  watch anyway).
- Significant data corruption (counters dropping, NULLs where there shouldn't be).

UI glitches, missing admin commands, or one-off errors are NOT rollback
criteria — fix forward.

## Rollback procedure

1. Stop the new bot: `npm stop` / `pm2 stop` / `systemctl stop`.
2. Drop the migrated DB or restore from the pre-migration dump:
   ```
   psql ... -c "DROP DATABASE goblin_bot"
   psql ... -c "CREATE DATABASE goblin_bot"
   pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME goblin_<dump>.dump
   ```
3. Check out the `legacy` tag (created automatically by the rewrite branch
   merge OR manually before cutover): `git checkout legacy`.
4. Start the legacy bot.
5. Telegram payments that arrived during the rollback window may be lost;
   manually reconcile from `payment_tracking` audit if any did.

Estimated recovery time: 15–30 minutes.

## Post-cutover (T+1w)

- [ ] Archive the legacy code branch.
- [ ] Tag the cutover commit (`git tag -a cutover -m "..."`).
- [ ] Update on-call docs if any.
