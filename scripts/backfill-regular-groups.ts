import 'dotenv/config';

import knexLib from 'knex';
import type { Knex } from 'knex';

/*
 * Backfill: every buyer of the EXTENDED (plus) archive should also hold the
 * BASIC (regular) archive for the same month — the plus price covers both
 * groups. The fix in payments now grants both on purchase; this script repairs
 * historical rows: for each user with a `plus` user_groups record in the range
 * below but NO `regular` record for that same period, it inserts the missing
 * `regular` record.
 *
 * Periods are `YYYY_MM` strings (zero-padded month). Idempotent: re-running adds
 * nothing once every plus buyer has their regular row.
 *
 * Usage:
 *   tsx scripts/backfill-regular-groups.ts            # DRY RUN — report only
 *   tsx scripts/backfill-regular-groups.ts --apply    # actually insert rows
 */

const START_PERIOD = '2026_01';
const END_PERIOD = '2026_06';

const APPLY = process.argv.includes('--apply');

const db: Knex = knexLib({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST ?? 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    database: process.env.DB_NAME ?? 'goblin_bot',
    user: process.env.DB_USER ?? 'goblin',
    password: process.env.DB_PASSWORD ?? '',
  },
  pool: { min: 0, max: 5 },
});

/** Inclusive list of `YYYY_MM` periods between two `YYYY_MM` bounds. */
function periodsInRange(start: string, end: string): string[] {
  const parse = (s: string): { year: number; month: number } => {
    const m = /^(\d{4})_(\d{2})$/.exec(s);
    if (!m) throw new Error(`Bad period "${s}", expected YYYY_MM`);
    return { year: Number(m[1]), month: Number(m[2]) };
  };
  const s = parse(start);
  const e = parse(end);
  const out: string[] = [];
  let { year, month } = s;
  while (year < e.year || (year === e.year && month <= e.month)) {
    out.push(`${year}_${String(month).padStart(2, '0')}`);
    if (++month > 12) {
      month = 1;
      year++;
    }
  }
  return out;
}

interface Membership {
  user_id: string;
  period: string;
}

const key = (m: Membership): string => `${m.user_id}|${m.period}`;

async function main(): Promise<void> {
  const periods = periodsInRange(START_PERIOD, END_PERIOD);

  // Extended (plus) memberships in range, and the basic (regular) ones that
  // already exist — diffed in memory (the dataset is one community, six months).
  const [plusRows, regularRows] = await Promise.all([
    db('user_groups').where('type', 'plus').whereIn('period', periods).select('user_id', 'period'),
    db('user_groups')
      .where('type', 'regular')
      .whereIn('period', periods)
      .select('user_id', 'period'),
  ]);

  const haveRegular = new Set((regularRows as Membership[]).map(key));
  const missing = (plusRows as Membership[]).filter((p) => !haveRegular.has(key(p)));

  // eslint-disable-next-line no-console
  const log = console.log;
  log(`Range: ${periods[0]}…${periods[periods.length - 1]} (${periods.join(', ')})`);
  log(`Extended (plus) memberships in range: ${plusRows.length}`);
  log(`Missing basic (regular) memberships:  ${missing.length}`);

  if (missing.length > 0) {
    const byPeriod = new Map<string, number>();
    for (const m of missing) byPeriod.set(m.period, (byPeriod.get(m.period) ?? 0) + 1);
    log('\nMissing per period:');
    for (const period of periods) {
      const n = byPeriod.get(period) ?? 0;
      if (n > 0) log(`  ${period}: ${n}`);
    }
    log('\nAffected (user_id, period):');
    for (const m of missing.slice(0, 50)) log(`  ${m.user_id}  ${m.period}`);
    if (missing.length > 50) log(`  … and ${missing.length - 50} more`);
  }

  if (missing.length === 0) {
    log('\nNothing to backfill — every extended buyer already holds the basic archive.');
    await db.destroy();
    return;
  }

  if (!APPLY) {
    log('\nDRY RUN — no rows written. Re-run with --apply to insert the rows above.');
    await db.destroy();
    return;
  }

  // onConflict ignore guards against a concurrent grant landing the same row.
  const inserted = await db.transaction(async (trx) => {
    const rows = await trx('user_groups')
      .insert(missing.map((m) => ({ user_id: m.user_id, period: m.period, type: 'regular' })))
      .onConflict(['user_id', 'period', 'type'])
      .ignore()
      .returning(['user_id', 'period']);
    return rows.length;
  });

  log(`\nAPPLIED — inserted ${inserted} basic (regular) membership row(s).`);
  if (inserted < missing.length) {
    log(`(${missing.length - inserted} were already present and skipped.)`);
  }
  await db.destroy();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  void db.destroy();
  process.exit(1);
});
