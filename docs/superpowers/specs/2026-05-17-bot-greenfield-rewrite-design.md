# Greenfield rewrite of goblinHelperBot — design spec

**Date:** 2026-05-17
**Status:** Approved by user, ready for implementation planning
**Scope:** Full greenfield rewrite of the Telegram bot, migrating live production data in place.

## 1. Goals and constraints

### What we're solving

The current bot is "scattered, unpredicted, has different issues." The audit traced this to identifiable causes, not a vague feeling:

- Quadruple-firing `successful_payment` handlers — subscriptions are processed 2–4× per payment; `months.counter_paid` inflates; XP is awarded multiple times; level-up notifications spam.
- No transactions in payment flows — crashes mid-sequence leave partially-committed state.
- `/ex` eval command gated only by loose `==` on two user IDs.
- `.env` file committed to git with live secrets.
- `banned.js` middleware fails open on DB error.
- `preCheckoutQuery.js` rejects new-format `t:'sub'` payloads — only works because `stars.js:85` registers an unconditional accept first.
- Two parallel loyalty systems (`userLoyalty` manual vs `user_levels` XP-driven); users see different tiers in profile vs pricing.
- Two parallel XP services with divergent formulas (`xpService.applyXpGain` vs `rpgUtils.grantXp`).
- Three permission models in use simultaneously (`ensureRoles`, `isAuthorizedAdmin`, hardcoded IDs, broken `util.isAdmin`).
- 5+ entry points for "buy current month" with copy-pasted pricing math; `applyTestUserPricing` missing in some paths.
- Double session architecture — 4 Redis sessions + Telegraf's `session()`; scenes read the wrong one.
- `globalThis.__bot` startup race — loyalty/scrolls notifications silently dropped during cold start.
- 6 dead callback IDs (`scrollKickstarters`, `scrollExclusive`, `scrollSpecial`, `scrollEarlyAccess`, `confirmPlusPurchase`, `subscriptionHistory`, `subscriptionPlanning`) rendered as buttons that do nothing.
- Broken admin payment-code subsystem reading from non-existent `ctx.*` properties.
- `confirmPayment` `release` branch crashes on type=release (var-hoisted across switch cases).
- Duplicate action registrations (regex + literal both matching `adminParticipants`).
- 18 modules import `knex` directly, bypassing the partial `helpers.js` abstraction.
- 5 core tables (`users`, `months`, `kickstarters`, `applications`, `settings`) have no creating migrations.
- Mixed `snake_case` / `camelCase` column conventions.
- `pg.js` is a dead second DB client used in 2 admin actions for raw SQL alongside knex.
- Massive duplication — raid message template 5×, `updatePublicRaidMessage` 91 lines duplicated, 4 near-identical kickstarter edit scenes, 4 near-identical polls display/reset, `thisis` vs `thisis-channel` 95% identical.

### Success criteria

- All bugs above structurally impossible in the new architecture (not just patched).
- "Same flow + cleaner navigation" UX — existing users don't relearn the bot; every screen has exactly one canonical entry point, every button has a handler, every back-button works.
- One source of truth for: bot instance, sessions, permissions, XP, pricing, tiers, achievement gating, payment processing.
- Pragmatic test coverage: unit tests on pure logic, integration tests against a real Postgres test DB for payment flows and scene lifecycles.
- Live production data preserved (users, subscriptions, months, raids, kickstarters, XP, scrolls, achievements).
- Single-go cutover (no staging shadow phase, per user constraint).

### Non-goals

- Full UX redesign — the flows the users know stay the same.
- New features — anything currently dead/half-baked is dropped or fixed; no new product surface.
- Framework migration — Telegraf v4 stays; no move to grammY.
- Multi-language support — Russian remains the only locale.
- Microservices, queues, workers — single Node.js process keeps running the bot.

### Scope decisions (locked in)

- **Tech stack:** TypeScript + Telegraf v4 + Postgres (knex) + Redis (single session backend).
- **Data continuity:** Migrate everything in place; same Postgres database, same Telegram bot token.
- **Feature scope KEEP:** SBP/fiat payment path (achievement-gated, screenshot-mediated, admin-confirmed — see §3.4).
- **Feature scope DROP:** Manual loyalty tier overrides (`userLoyalty` table, `/set_level` command); lots/auction subsystem (8 tables); Notion integration stub; in-memory payment-code subsystem in `modules/user/`; `paymentNoteProcessor`; all dead callback IDs; `/ex` eval command.
- **Architecture:** Feature-modular, flat per feature (Approach C from brainstorming).
- **UX:** Conservative — same flow, consistent navigation, single canonical entry per user state.
- **Testing:** Pragmatic core coverage (unit + targeted integration).
- **Rollout:** Single-go cutover (no staging shadow phase).

## 2. Architecture overview

### Directory layout

```
goblinHelperBot/
├── src/
│   ├── index.ts                 # Wire core, register features, launch (≤80 lines)
│   ├── core/
│   │   ├── bot.ts               # Single Telegraf instance (replaces globalThis.__bot)
│   │   ├── config.ts            # Loads .env via zod; throws on missing required keys
│   │   ├── sessions.ts          # ONE Redis session with namespaced keys
│   │   ├── router.ts            # Typed callback-data parser + action registration
│   │   ├── scenes.ts            # BaseScene helpers; scene-chain definitions
│   │   ├── middleware/
│   │   │   ├── error.ts
│   │   │   ├── logger.ts
│   │   │   ├── banned.ts        # Fail-CLOSED on DB error
│   │   │   ├── user-tracker.ts  # Bounded LRU cache
│   │   │   ├── rbac.ts          # Populates ctx.state.roles
│   │   │   └── xp-on-message.ts # With actual rate limiting
│   │   ├── permissions.ts       # ONE source: requireRoles, requireDM, requireGroup
│   │   ├── observability.ts     # Structured logging (pino), counters, optional Sentry
│   │   └── i18n.ts              # t() with typed keys generated from locales/ru.json
│   ├── db/
│   │   ├── client.ts            # Single knex instance
│   │   ├── migrations/
│   │   └── seeds/
│   ├── shared/                  # Pure functions; no DB, no Telegraf, no I/O
│   │   ├── pricing.ts           # ONE pricing calc
│   │   ├── xp.ts                # ONE XP calc + tier resolution
│   │   ├── achievements.ts      # gate helpers (incl. sbp_payment)
│   │   ├── period.ts            # year/month helpers
│   │   ├── format.ts            # message templates, button label helpers
│   │   └── loyalty-config.ts    # Tier definitions, benefits, discounts
│   ├── features/
│   │   ├── onboarding/
│   │   ├── subscriptions/
│   │   ├── old-months/
│   │   ├── payments/
│   │   ├── raids/
│   │   ├── kickstarters/
│   │   ├── polls/
│   │   ├── loyalty/
│   │   ├── scrolls/
│   │   ├── promo/
│   │   ├── invitations/         # Renamed from misnamed "archive"
│   │   ├── admin/
│   │   └── common/
│   └── types/
│       └── telegraf.d.ts        # Context augmentation
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── docs/superpowers/specs/
├── locales/
│   └── ru.json
├── package.json
├── tsconfig.json
├── .eslintrc.cjs
├── knexfile.ts
└── .env.example                 # Tracked; .env in .gitignore
```

### Per-feature folder shape

Every `features/X/` folder follows the same predictable structure:

```
features/X/
  index.ts        # Public surface; the only thing src/index.ts imports
  routes.ts       # Handler registration (uses core/router)
  service.ts      # Business logic; orchestrates repo + shared + side effects
  repo.ts         # DB queries scoped to this feature's tables
  schemas.ts      # zod schemas for callback payloads, DB rows, invoice payloads
  menus.ts        # Pure functions: state → { text, keyboard }
  scenes.ts       # If the feature has scenes (otherwise omit)
  __tests__/
```

### Layer rules

- `core/` — no business logic. Bot plumbing only.
- `db/` — knex client + migration files. Nothing else.
- `shared/` — pure functions. No DB access, no Telegraf, no I/O. Easiest tests live here.
- `features/X/` — anything user-facing or domain-specific.
- A `features/A/` file may import from `core/`, `shared/`, `db/`, and `features/A/`. It may **not** reach into `features/B/repo.ts` or `features/B/service.ts`. If A needs something from B, B exposes it via `features/B/index.ts`.

This rule is enforced by an ESLint `no-restricted-imports` config.

## 3. Core platform

### 3.1 Bot instance and lifecycle

`core/bot.ts` creates and exports the Telegraf instance. Any code that needs `bot.telegram.xxx` imports from this module. No `globalThis.__bot`. Loyalty/scrolls notifications that previously dropped silently during the startup window now work reliably because the bot module is loaded before any feature module that uses it.

`src/index.ts` is the wiring file: import core, import each feature's `index.ts`, call `bot.launch()`. Target ≤80 lines.

### 3.2 Sessions

One `@telegraf/session` instance backed by Redis. Sessions are explicitly namespaced on the context:

```ts
ctx.session.user    // per-user data
ctx.session.chat    // per-chat data
ctx.session.scene   // scene state
ctx.session.polls   // poll-specific data
```

Scene state lives in the same store. No more divergent reads between Telegraf's in-memory `session()` and the four `RedisSession` instances.

Type augmentation in `src/types/telegraf.d.ts` so every handler gets typed session access.

### 3.3 Typed callback router

`core/router.ts` exposes:

```ts
type CallbackSchema = z.ZodDiscriminatedUnion<'a', any>

interface Router {
  on<S extends CallbackSchema>(schema: S, handler: (ctx, payload: z.infer<S>) => Promise<void>): void
  encode<S extends CallbackSchema>(schema: S, payload: z.infer<S>): string
  middleware(): Telegraf.Middleware
}
```

Per-feature usage:

```ts
// features/subscriptions/schemas.ts
export const subCallback = z.discriminatedUnion('a', [
  z.object({ a: z.literal('payMonth'), year: z.number(), month: z.number() }),
  z.object({ a: z.literal('upgradePlus') }),
])

// features/subscriptions/routes.ts
router.on(subCallback, async (ctx, payload) => {
  if (payload.a === 'payMonth') return startPurchaseFlow(ctx, payload.year, payload.month)
  if (payload.a === 'upgradePlus') return startUpgradeFlow(ctx)
})

// features/subscriptions/menus.ts
const button = Markup.button.callback(
  'Купить доступ',
  router.encode(subCallback, { a: 'payMonth', year: 2026, month: 6 })
)
```

**Properties this gives:**

- Every callback in a button is guaranteed to have a handler — if `menus.ts` tries to encode a variant that no schema includes, TypeScript rejects the call at compile time.
- Dead callback IDs become structurally impossible.
- Startup-time assertion verifies no two schemas claim overlapping discriminator values (catches the `adminParticipants` regex+literal conflict at boot, not at runtime).
- Callback data is parsed once at the boundary; handlers receive a fully-typed payload, no string splitting.

### 3.4 Middleware chain (fixed order)

1. `error.ts` — wraps `next()`; logs structured error with full update context; replies user-safe message; routes alert to admin chat. Replaces the empty `bot.catch` body and the three-times-logged error chain.
2. `logger.ts` — structured request log via pino. One implementation. The orphan `logger.js` and the duplicate `cleanLogger.js` collapse into this.
3. `banned.ts` — fail-CLOSED on DB error. If we can't determine ban status, the update is dropped with a generic "try again later" message. No more banned-users-get-through-during-DB-hiccup.
4. `user-tracker.ts` — backed by `lru-cache` with a bounded size. Diffs flushed at most once per N seconds per user.
5. `rbac.ts` — populates `ctx.state.roles` for downstream handlers. Single read per update.
6. `xp-on-message.ts` — Redis sliding-window rate limiter keyed `(user_id, date)`. Enforces the daily/weekly caps in `configs/rpg.js` that were configured but never enforced.

### 3.5 Permissions — one model

```ts
// core/permissions.ts
export function requireRoles(...roles: Role[]): MiddlewareFn
export function requireDM(): MiddlewareFn
export function requireGroup(chatId: string): MiddlewareFn
```

All admin handlers gate via `requireRoles('admin')` at the route level. No inline ID checks. No `isAuthorizedAdmin`. No `util.isAdmin`. RBAC tables are the only source. Hardcoded user IDs in `settings.json` are no longer treated as a permission system — they remain only as chat-routing constants.

The `/ex` eval command is removed. Specific operations admins legitimately needed (run pricing report, force a refresh, manually grant achievement) become explicit admin commands under `features/admin/`, each gated by `requireRoles('super')`.

### 3.6 Observability

- Structured logging via pino — JSON to stdout in production, pretty-printed in dev.
- Counter/timer metrics in-process (a tiny `core/observability.ts::metrics` object): `payments.success`, `payments.failure`, `payments.duplicate_blocked`, `scene.enter`, `scene.exit`, `handler.latency`. Exposed via `/admin metrics` command for inspection.
- Optional Sentry integration (free tier sufficient) for production error capture. Toggle via `SENTRY_DSN` env var.
- Every payment flow logs: incoming payload (sanitized), idempotency check result, transaction outcome, notification result. Three months from now you can answer "why did Alex never get his scroll" by reading logs.

### 3.7 i18n

`core/i18n.ts` exposes `t(key, params?)`. The key type is generated from `locales/ru.json` at build time by a small script (`scripts/gen-locale-types.ts`). Typo'd keys break the build. Existing inconsistency (32 files use `t()`, ~30 hardcode Russian) becomes mechanically detectable — every hardcoded string is a candidate for extraction; the type system makes the migration tractable.

## 4. Feature designs

### 4.1 Subscriptions & payments (the highest-risk redesign)

**One `successful_payment` handler.** `bot.on('successful_payment', features.payments.handleSuccessfulPayment)`. Drops the legacy `stars.js` composer, the `index.js:174` fallback message handler, and `users/actions/paymentSuccess.js`.

**Typed payment payloads:**

```ts
// features/payments/schemas.ts
export const PaymentPayload = z.discriminatedUnion('t', [
  z.object({ t: z.literal('sub'),     userId: z.number(), year: z.number(), month: z.number(), tier: z.enum(['regular', 'plus']) }),
  z.object({ t: z.literal('old'),     userId: z.number(), year: z.number(), month: z.number(), tier: z.enum(['regular', 'plus']) }),
  z.object({ t: z.literal('ks'),      userId: z.number(), kickstarterId: z.number() }),
  z.object({ t: z.literal('upgrade'), userId: z.number(), year: z.number(), month: z.number() }),
])
```

Both `pre_checkout_query` and `successful_payment` parse with this schema. No more handler/invoice payload-shape desync. The unconditional `answerPreCheckoutQuery(true)` workaround goes away.

**Idempotency + transactions, mandatory pattern:**

```ts
async function processSubscriptionPayment(payload, telegramChargeId) {
  return db.transaction(async trx => {
    const existing = await paymentsRepo.findByChargeId(trx, telegramChargeId)
    if (existing?.status === 'completed') return { alreadyProcessed: true }

    await subscriptionsRepo.grantAccess(trx, payload.userId, payload.year, payload.month, payload.tier)
    await paymentsRepo.markCompleted(trx, telegramChargeId, payload)
    await monthsRepo.incrementCounterPaid(trx, payload.year, payload.month, payload.tier)
    await xpRepo.grantXp(trx, payload.userId, computeXp(payload), { source: 'payment', externalId: telegramChargeId })

    return { processed: true }
  })
  // Confirmation message sent outside transaction
}
```

If the same `successful_payment` fires twice, the idempotency check at step 1 short-circuits. Counter inflation, double-XP, ghost subscriptions — structurally impossible. XP idempotency relies on `UNIQUE(source, external_id)` on `xp_transactions` (migration 019).

**One entry point per user state:**

```ts
async function startPurchaseFlow(ctx, year, month) {
  const sub = await subscriptionsRepo.getStatus(ctx.from.id, year, month)
  if (sub.hasPlus)              return showAlreadyPlus(ctx)
  if (sub.hasRegular)           return offerUpgradeToPlus(ctx, year, month)
  if (isHistoricalMonth(year, month)) return showOldMonthOptions(ctx, year, month)
  return showCurrentMonthOptions(ctx, year, month)
}
```

The 5+ legacy entry points collapse to this. Same logic, one place.

**Pricing in one function:**

```ts
// shared/pricing.ts
export function computePrice(
  userId: number,
  basePrice: number,
  opts: { yearsOfService: boolean, isTestUser: boolean }
): { final: number, discountPercent: number, currency: 'XTR' | 'RUB' }
```

Called by every payment service. The `applyTestUserPricing` regression (where one path used it and others didn't) is structurally impossible — there's only one path.

**SBP screenshot flow** (preserved per scope decision, gated by `sbp_payment` achievement):

1. User has `sbp_payment` achievement → SBP button appears alongside Stars button on the purchase screen.
2. Tapping SBP enters `SBP_SCREENSHOT` scene.
3. Scene asks for a screenshot, validates it's a photo, forwards to admin notification chat with structured metadata (user, year/month, claimed tier, amount).
4. Admin sees the message in the notification chat with an inline "Подтвердить" button. Tapping it calls `processSubscriptionPayment` with `source: 'sbp'` — going through the same idempotent transactional path as Stars.
5. The user gets the same confirmation message and access grant.

The duplicated SBP + legacy scenes collapse into this single, owned-by-payments scene.

**Payment tables changes** (see §5): `payment_tracking.telegram_payment_charge_id` (unique), `payment_tracking.source` (`'stars' | 'sbp' | 'manual'`).

### 4.2 Loyalty (XP + tiers + achievements)

**One XP system.** `shared/xp.ts::grantXp(conn, userId, amount, source, metadata)` is idempotent via `UNIQUE(source, external_id)` on `xp_transactions`. Both `xpService.applyXpGain` and `rpgUtils.grantXp` paths collapse to this function.

**One tier source.** `user_levels.current_tier`, computed from accumulated XP. The `userLoyalty` table is dropped. Profile, leaderboard, pricing all read tier from `user_levels`.

**One benefits source.** `shared/loyalty-config.ts` holds tier definitions, benefits arrays, discount percentages. The duplicated `tierBenefits` in `loyalty/index.js`, the `benefits` arrays in `configs/rpg.js`, and the stub `configs/benefits.js` all disappear.

**Level-up notifications fire once.** From `shared/xp.ts` only. `core/observability.ts` tracks how often — any future regression to double-notification is visible.

**Achievements.** `user_achievements` gets `UNIQUE(user_id, achievement_type)` (migration 020). `grantAchievement` becomes idempotent. The `sbp_payment` and `years_of_service` definitions live in `shared/achievements.ts` as a typed map.

### 4.3 Onboarding

Replace the looping funnel (`applyInit` ↔ `applicationQuestions` ↔ `startApplication` ↔ `whatIsIt`) with a single linear scene: `OnboardingScene` with steps `intro → questions → confirm → submit`. Each step has a "forward" button and a "выйти" cancel. No back-links pointing in circles.

Admin-side approval: `features/onboarding/admin/` splits the 912-line `allApplications.js` into:

- `list-routes.ts` (pagination, filtering)
- `single-user-routes.ts` (approve/reject)
- `service.ts` (business logic, role transitions)
- `shared/user-status.ts::getStatusDisplay(roles)` — the role→{emoji,text} mapping currently duplicated 4+ times in `allApplications.js` and again in `scenes/requests.js`.

### 4.4 Raids

- One scene chain in `features/raids/scene-chain.ts`: `['photo', 'link', 'price', 'description', 'date', 'review']`. Each scene reads its position to resolve prev/next — adding or reordering is a one-line change.
- One `shared/format.ts::formatRaid(raid)` returning `{ text, keyboard }`. Currently duplicated 5×. `join.ts` and `leave.ts` call it; the 91-line `updatePublicRaidMessage` becomes one shared function.
- `joinRaid` wrapped in a transaction; DB unique constraint catches double-tap races; catch error code `23505` cleanly.
- `getUserRaids` / `getUserCreatedRaids` rewritten as one SQL with joins. No N+1 loop.

### 4.5 Kickstarters

- One `sendKickstarterPromo` implementation (the audit found two divergent ones).
- Edit scenes (name/creator/pledge/price) collapse to one `makeEditFieldScene(field, dbColumn, validator)` factory.
- `addKickstarter` uses `.returning('id')`. The workaround in `helpers.js:358-427` and the silent-exception block in migration 016 both go away.
- Purchase paths: `purchaseWithStars` and `purchaseWithScroll` share `processKickstarterPurchase` — identical idempotent + transactional pattern as subscriptions.

### 4.6 Polls

- `POLLS_ROLES` lives once in `features/polls/constants.ts`.
- `displayCore`/`displayStudios` and `resetCore`/`resetStudios` collapse to parameterized `displayPollList(kind)` and `resetPollList(kind)`.
- User-vs-admin split preserved (`user-routes.ts` + `admin-routes.ts`), both call into `service.ts`.
- Brittle JSON-round-trip parsing in `add.js:17` replaced with a proper parser + zod validation.

### 4.7 Scrolls

- Dead buttons (`scrollKickstarters`, `scrollExclusive`, `scrollSpecial`, `scrollEarlyAccess`) removed. Future scroll-exchange features designed when actually needed.
- Balance stays as counter (`user_scrolls.amount`) with `scroll_logs` as audit trail. No event-sourcing rewrite.
- One `useScroll(userId, scrollType)` service used by kickstarter purchase flow.

### 4.8 Promo

- Cooldown enforced from one source — recommendation: keep `cooldown_until` column, recompute on use; drop the JS-side `used_at + COOLDOWN_HOURS` filter.
- `getRandomPromoFile` uses SQL `WHERE NOT EXISTS` instead of in-memory filter.

### 4.9 Invitations (renamed from `archive/`)

The current `archive/archiveService.js` is invitation link lifecycle, not archival — folder is renamed to `features/invitations/`. The `revokeInvitationLink` bug (passing `groupPeriod` where Telegram expects the URL) is fixed. The second Telegraf instance in `invitationService.js` goes away — it uses `core/bot.ts` like everyone else.

### 4.10 Common

- Dead `chat.from < 0` guard in `id.js:6` removed.
- `infoCommand.js` and missing `info.js` reconciled — one file.
- `INTEGRATION_EXAMPLES.js` moved to `docs/integration-examples.md`; stops looking like a module.

### 4.11 Admin

Admin handlers are thin route registrations that call into other features' public services via their `index.ts` exports. `allApplications.js` (912 lines) splits per §4.3. Three permission patterns collapse to `requireRoles('admin')` or `requireRoles('super')`.

### 4.12 Dropped entirely

- `modules/user/` — in-memory payment codes (dead).
- `paymentNoteProcessor.js` — not wired (dead).
- Manual `/set_level` admin command + `userLoyalty` table (scope decision).
- Lots tables — 8 tables (scope decision).
- Notion integration (scope decision).
- `/ex` eval (security).
- `pg.js` second DB client.
- All dead callback IDs across the codebase.

## 5. Data layer

### 5.1 Schema migration sequence

```
017_create_retroactive_tables_documentation.js
    Documents the existing shape of users, months, kickstarters,
    applications, settings — tables created outside the migration
    system. No-op against current DBs (hasTable() guards); provides
    canonical schema for fresh-environment setup.

018_rename_camelcase_to_snakecase.js
    Renames every camelCase column on: users, user_purchases,
    user_roles, user_groups, user_kickstarters, months,
    applications, payment_tracking, invitation_links,
    kickstarter_promo_messages, user_scrolls, scroll_logs,
    kickstarter_photos, kickstarter_files.
    Single transactional rename block. Down-migration restores.
    Riskiest migration; verify against production dump first.

019_add_payment_idempotency.js
    payment_tracking.telegram_payment_charge_id (unique, nullable)
    payment_tracking.source ('stars' | 'sbp' | 'manual')
    Backfill source='stars' for existing rows.
    xp_transactions.external_id + UNIQUE(source, external_id)
    so XP grants are idempotent on payment IDs.

020_add_user_achievements_unique.js
    UNIQUE(user_id, achievement_type) on user_achievements.
    De-duplicates existing rows in the up-migration.

021_drop_dead_tables.js
    DROP user_loyalty (replaced by user_levels)
    DROP lots, lot_categories, lot_tags, lot_photos,
         lot_participants, lot_tag_assignments,
         user_preferences, user_favorites
    Down-migration recreates empty tables (data loss intentional).

022_normalize_invitation_links.js
    Drop telegram_invite_link_name, _creator_id, _is_primary,
    _is_revoked, _expire_date, _member_limit.
    Add telegram_metadata JSONB column.
    Backfill into JSONB.
```

Migration 005 (missing in the current sequence) is intentionally left as a numbering gap. No retroactive insertion; the gap is documented in `MIGRATION_GUIDE.md`.

Naming convention for the new schema: **snake_case throughout**, matching PostgreSQL idiom and avoiding quoted identifiers in raw SQL. Repository code maps to TypeScript camelCase at the boundary via a small mapper.

### 5.2 Repository pattern

Every feature has a `repo.ts`. ESLint rule: no feature imports `knex` outside `repo.ts`. Repository functions accept `conn: Knex | Knex.Transaction` so the same function works inside or outside a transaction.

```ts
// features/subscriptions/repo.ts
import { db } from '../../db/client'
import type { Knex } from 'knex'

export async function findStatus(userId: number, year: number, month: number) { ... }

export async function grantAccess(
  conn: Knex | Knex.Transaction,
  userId: number, year: number, month: number, tier: 'regular' | 'plus'
) {
  return conn('user_groups')
    .insert({ user_id: userId, period: `${year}_${month}`, type: tier })
    .onConflict(['user_id', 'period', 'type'])
    .ignore()
}
```

### 5.3 `helpers.js` dissolution

The 22 functions in current `modules/db/helpers.js` are split across feature `repo.ts` files by domain. `getUser` (currently fires 5 parallel queries) is rewritten as one joined query returning a typed user object. N+1 elimination is per-feature.

### 5.4 `pg.js` deletion

Two callers (`setRole.js`, `resendInvite.js`) are rewritten with knex query builder. `pg.js` is deleted. One client, one connection pool.

### 5.5 Pre-migration audit script

`scripts/pre-migration-audit.ts` runs against the live DB and reports:

- Users with both `regular` and `plus` for the same period (data anomaly).
- `payment_tracking` rows stuck in `pending` > 30 days (orphans from the current broken flow).
- Duplicate achievements (which migration 020's UNIQUE would block — must be cleaned first).
- `user_groups` rows without a matching `payment_tracking` row (audit-trail gap).

Run before the migration window; resolve flagged anomalies before cutover.

### 5.6 Data continuity guarantees

- Every existing user keeps roles, balance, XP, scrolls, kickstarter purchases, raid history, month memberships.
- Active subscriptions remain active — same `user_groups` rows, snake_case column names.
- Payment history preserved in `payment_tracking`, backfilled with `source='stars'` and nullable `telegram_payment_charge_id`.
- Application records preserved.

## 6. Testing strategy

### 6.1 Unit tests (pure logic in `shared/`)

- `shared/pricing.test.ts` — every scenario (base, achievement discount, test user, upgrade delta, edge cases). The `applyTestUserPricing` regression is structurally impossible — there's only one function and one test suite.
- `shared/xp.test.ts` — XP calculation, tier resolution, level boundaries.
- `shared/achievements.test.ts` — gate logic.
- `shared/period.test.ts` — year/month/period parsing, current-period derivation, year-wrap edge cases.
- Per-feature `schemas.test.ts` — every zod schema validates expected good and rejects expected bad cases. Catches the "payload uses `t:'sub'` but handler expects `type:'subscription'`" class of bug.

Fast (no I/O). Runs in CI on every commit. Target: sub-second total.

### 6.2 Integration tests (real Postgres test DB)

One ephemeral Postgres DB per test run (testcontainers, or a dedicated test schema reset between runs). Migrations run as setup.

- `subscriptions.integration.test.ts` — issue invoice → simulate `successful_payment` → assert single grant, single XP transaction, single payment row, idempotency on retry.
- `payments-stars-vs-sbp.integration.test.ts` — same outcome for both paths.
- `kickstarter-purchase.integration.test.ts` — Stars + scrolls paths.
- `raid-join-race.integration.test.ts` — two concurrent `joinRaid` calls produce one participant, not two.
- `onboarding-funnel.integration.test.ts` — linear scene path, application landed.
- `migration-018-rename.integration.test.ts` — load fixture DB at pre-rename state, run migration, assert all data preserved.

### 6.3 What is not tested

- Menu rendering (button labels, message text). TS + zod ensure shape; visual correctness verified manually.
- Telegram API itself. We stub `ctx.reply`, `ctx.telegram.sendMessage`, etc. with minimal fakes — no full Telegraf simulation.

### 6.4 CI

GitHub Actions workflow (`.github/workflows/ci.yml`): on push, lint → typecheck → unit → integration. Fail-fast. Pre-commit hook via `lefthook` for lint+typecheck on staged files.

## 7. Rollout and migration plan

### 7.1 Build the new bot (no production impact)

Implement on a long-lived branch. Order (lowest risk → highest):

1. `core/` and `shared/` — clean tests, no I/O.
2. `common/`, `polls/`, `promo/` — small, isolated.
3. `loyalty/`, `scrolls/`, `achievements/` — fix the dual-system bug.
4. `raids/`, `kickstarters/` — medium complexity.
5. `subscriptions/`, `payments/`, `onboarding/` — the big ones.
6. `admin/` — depends on everything else.
7. `invitations/` (renamed from archive).

Each feature lands with its tests passing.

### 7.2 Pre-cutover preparation

- Local dev runs against a clone of production DB. No staging shadow phase (per user constraint — single-go cutover).
- Local smoke test of every flow end-to-end (apply, pay, upgrade, SBP, raids, kickstarter, profile, leaderboard, admin tools).
- Full integration test suite green.
- Run `scripts/pre-migration-audit.ts` against production DB. Resolve flagged anomalies.

### 7.3 Cutover window (single go)

- Announce maintenance window (estimated 30–60 min — single migration with no shadow validation needs buffer).
- `bot.stop()` on old bot (graceful SIGTERM).
- `pg_dump` production DB as recovery point. **This is the only rollback path** — no parallel-running old bot.
- Run `npm run migrate` (017–022).
- Smoke-verify migration: SELECT counts for users, payment_tracking, user_groups, months; sample 10 random users and verify their data shape matches expected schema; verify no orphaned data.
- Start new bot pointed at production DB.
- Watch logs for 60 minutes. Send test messages from the dev account; trigger a self-payment via Stars to verify end-to-end.

### 7.4 Rollback criteria

Rollback if any of:

- Any payment fails to grant access despite Telegram showing payment success.
- Any user locked out of a group they should have access to.
- Any double-charging observed.
- Significant data corruption (counters wildly off, missing rows in spot-checks).

Anything below that bar (UI glitches, an admin command missing) is fix-forward.

Rollback procedure: stop new bot → restore pre-migration `pg_dump` → check out the `legacy/` branch → start old bot. Estimated recovery: 15–30 minutes depending on dump size.

### 7.5 Soak period

- New bot in production, old bot's code archived on `legacy/` branch.
- Active monitoring of logs/metrics for 1 week.
- After 1 week with no critical issues, the `legacy/` branch is archived and the rewrite is considered done.

### 7.6 What does not happen on cutover

- No URL change.
- No Telegram bot token change.
- No user-visible change to existing flows (UX decision: same flow, cleaner navigation).
- Users see their bot behaving the same way, just more reliably.

## 8. Open questions

None at design time. All architectural decisions are locked. Remaining unknowns are implementation details that surface during the build:

- Exact `zod` schema shapes for every callback (defined during feature implementation; constrained by §3.3 router).
- Exact column-by-column mappings for migration 018 (defined when writing the migration against a production DB dump).
- Whether integration tests use testcontainers or a locally-provisioned Postgres (recommendation: testcontainers for CI isolation; decided when scaffolding CI).
- Whether Sentry is added on day 1 or after the soak period (decided during core scaffolding; toggled by `SENTRY_DSN`).
