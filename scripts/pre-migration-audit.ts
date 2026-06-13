import 'dotenv/config';

import knexLib from 'knex';
import type { Knex } from 'knex';

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

interface AuditSection {
  title: string;
  rows: unknown[];
}

async function checkDuplicateAchievements(): Promise<AuditSection> {
  const result = await db.raw<{
    rows: Array<{ user_id: number; achievement_type: string; count: number }>;
  }>(
    `SELECT user_id, achievement_type, COUNT(*)::int AS count
     FROM user_achievements
     GROUP BY user_id, achievement_type
     HAVING COUNT(*) > 1`,
  );
  return {
    title: 'Duplicate achievements (migration 020 would fail without dedupe)',
    rows: result.rows,
  };
}

async function checkOrphanedPendingPayments(): Promise<AuditSection> {
  const result = await db.raw<{ rows: unknown[] }>(
    `SELECT id, "userId", period, status, "createdAt"
     FROM "paymentTracking"
     WHERE status = 'pending'
       AND "createdAt" < NOW() - INTERVAL '30 days'
     ORDER BY "createdAt" ASC`,
  );
  return {
    title: 'Stale pending payments (>30 days)',
    rows: result.rows,
  };
}

async function checkBothRegularAndPlusForSamePeriod(): Promise<AuditSection> {
  const result = await db.raw<{ rows: unknown[] }>(
    `SELECT "userId", period, COUNT(DISTINCT type) AS types
     FROM "userGroups"
     GROUP BY "userId", period
     HAVING COUNT(DISTINCT type) > 1`,
  );
  return {
    title: 'Users with both regular and plus for the same period',
    rows: result.rows,
  };
}

async function checkUserGroupsWithoutPayment(): Promise<AuditSection> {
  const result = await db.raw<{ rows: unknown[] }>(
    `SELECT ug."userId", ug.period, ug.type
     FROM "userGroups" ug
     LEFT JOIN "paymentTracking" pt
       ON pt."userId" = ug."userId" AND pt.period = ug.period
     WHERE pt.id IS NULL`,
  );
  return {
    title: 'User group memberships with no matching paymentTracking row',
    rows: result.rows,
  };
}

async function main(): Promise<void> {
  const sections = await Promise.all([
    checkDuplicateAchievements(),
    checkOrphanedPendingPayments(),
    checkBothRegularAndPlusForSamePeriod(),
    checkUserGroupsWithoutPayment(),
  ]);

  let totalIssues = 0;
  for (const s of sections) {
    const count = s.rows.length;
    totalIssues += count;
    // eslint-disable-next-line no-console
    console.log(`\n=== ${s.title} (${count}) ===`);
    if (count > 0) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(s.rows.slice(0, 10), null, 2));
      if (count > 10) {
        // eslint-disable-next-line no-console
        console.log(`... and ${count - 10} more`);
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(`\nTotal anomalies: ${totalIssues}`);

  await db.destroy();
  process.exit(totalIssues > 0 ? 1 : 0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  void db.destroy();
  process.exit(2);
});
