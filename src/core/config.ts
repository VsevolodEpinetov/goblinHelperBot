import 'dotenv/config';

import { z } from 'zod';

const ConfigSchema = z.object({
  TOKEN: z.string().min(1, 'TOKEN is required'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().default('goblin_bot'),
  DB_TEST_NAME: z.string().default('goblin_test'),
  DB_USER: z.string().default('goblin'),
  DB_PASSWORD: z.string().default(''),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  USE_REDIS_SESSIONS: z
    .union([z.literal('true'), z.literal('false')])
    .default('true')
    .transform((v) => v === 'true'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SENTRY_DSN: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export interface Config {
  botToken: string;
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbTestName: string;
  dbUser: string;
  dbPassword: string;
  redisHost: string;
  redisPort: number;
  redisPassword: string | undefined;
  useRedisSessions: boolean;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  sentryDsn: string | undefined;
  nodeEnv: 'development' | 'production' | 'test';
}

export function loadConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): Config {
  // Fall back to the standard libpq env vars (PGHOST/PGPORT/…) when our own
  // DB_* names are absent. This lets the same .env serve both local dev and a
  // production box that already uses the libpq convention. DB_* win when set.
  const withDbFallback = {
    ...env,
    DB_HOST: env.DB_HOST ?? env.PGHOST,
    DB_PORT: env.DB_PORT ?? env.PGPORT,
    DB_NAME: env.DB_NAME ?? env.PGDATABASE,
    DB_USER: env.DB_USER ?? env.PGUSER,
    DB_PASSWORD: env.DB_PASSWORD ?? env.PGPASSWORD,
  };
  const parsed = ConfigSchema.parse(withDbFallback);
  return {
    botToken: parsed.TOKEN,
    dbHost: parsed.DB_HOST,
    dbPort: parsed.DB_PORT,
    dbName: parsed.DB_NAME,
    dbTestName: parsed.DB_TEST_NAME,
    dbUser: parsed.DB_USER,
    dbPassword: parsed.DB_PASSWORD,
    redisHost: parsed.REDIS_HOST,
    redisPort: parsed.REDIS_PORT,
    redisPassword: parsed.REDIS_PASSWORD,
    useRedisSessions: parsed.USE_REDIS_SESSIONS,
    logLevel: parsed.LOG_LEVEL,
    sentryDsn: parsed.SENTRY_DSN,
    nodeEnv: parsed.NODE_ENV,
  };
}

let _config: Config | undefined;
export function getConfig(): Config {
  if (!_config) _config = loadConfig();
  return _config;
}

// ---------------------------------------------------------------------------
// Feature config: the group/topic/payment env vars. Unlike the infra config
// above, these are parsed FRESH on every call (the schema is tiny) so tests
// can stub env per-case and there is exactly one reader for each var — no
// scattered `process.env.X ?? ''` silently disabling features.
// ---------------------------------------------------------------------------

/** '' and whitespace-only count as unset; other strings are trimmed. */
const emptyToUndef = (v: unknown): unknown => {
  if (typeof v !== 'string') return v;
  const t = v.trim();
  return t === '' ? undefined : t;
};

/** A Telegram chat id ('-100…' for supergroups). Malformed values THROW at
 * boot — a typo'd group id must kill the start, not silently disable XP. */
const chatId = z.preprocess(
  emptyToUndef,
  z
    .string()
    .regex(/^-?\d+$/, 'must be a numeric Telegram chat id (e.g. -1001234567890)')
    .optional(),
);

/** A topic (message_thread_id) inside the main group. Malformed → throws. */
const topicId = z.preprocess(emptyToUndef, z.coerce.number().int().positive().optional());

/** Lenient positive int: a malformed value degrades to undefined (the UI then
 * omits the amount) instead of crashing a runtime price computation. */
const lenientPositiveInt = z.preprocess(
  emptyToUndef,
  z.coerce.number().int().positive().optional().catch(undefined),
);

const FeatureConfigSchema = z.object({
  MAIN_GROUP_ID: chatId,
  ADMIN_NOTIFICATIONS_CHAT: chatId,
  RAIDS_TOPIC_ID: topicId,
  KICKSTARTERS_TOPIC_ID: topicId,
  RPG_TOPIC_ID: topicId,
  REGULAR_PRICE: z.preprocess(emptyToUndef, z.coerce.number().int().positive().default(350)),
  PLUS_PRICE: z.preprocess(emptyToUndef, z.coerce.number().int().positive().default(1000)),
  SBP_PRICE_REGULAR_RUB: lenientPositiveInt,
  SBP_PRICE_PLUS_RUB: lenientPositiveInt,
  SBP_REQUISITES: z.preprocess(emptyToUndef, z.string().optional()),
  TEST_USER_ID: lenientPositiveInt,
});

export interface FeatureConfig {
  /** The permanent lair supergroup: XP scope, raid/KS/RPG topics, main invite. */
  mainGroupId: string | undefined;
  /** Council chat: application notifications, SBP review, failure alerts. */
  adminNotificationsChat: string | undefined;
  raidsTopicId: number | undefined;
  kickstartersTopicId: number | undefined;
  /** The public RPG topic where XP gains and level-ups are announced. */
  rpgTopicId: number | undefined;
  regularPrice: number;
  plusPrice: number;
  sbpPriceRegularRub: number | undefined;
  sbpPricePlusRub: number | undefined;
  sbpRequisites: string | undefined;
  testUserId: number | undefined;
}

export function featureConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): FeatureConfig {
  const p = FeatureConfigSchema.parse(env);
  return {
    mainGroupId: p.MAIN_GROUP_ID,
    adminNotificationsChat: p.ADMIN_NOTIFICATIONS_CHAT,
    raidsTopicId: p.RAIDS_TOPIC_ID,
    kickstartersTopicId: p.KICKSTARTERS_TOPIC_ID,
    rpgTopicId: p.RPG_TOPIC_ID,
    regularPrice: p.REGULAR_PRICE,
    plusPrice: p.PLUS_PRICE,
    sbpPriceRegularRub: p.SBP_PRICE_REGULAR_RUB,
    sbpPricePlusRub: p.SBP_PRICE_PLUS_RUB,
    sbpRequisites: p.SBP_REQUISITES,
    testUserId: p.TEST_USER_ID,
  };
}

/** The bot is functionally broken in production without these — fail the boot
 * loudly instead of starting a bot that silently posts nothing anywhere. */
export function assertProductionConfig(fc: FeatureConfig, nodeEnv: string): void {
  if (nodeEnv !== 'production') return;
  const missing: string[] = [];
  if (!fc.mainGroupId) missing.push('MAIN_GROUP_ID');
  if (!fc.adminNotificationsChat) missing.push('ADMIN_NOTIFICATIONS_CHAT');
  if (missing.length > 0) {
    throw new Error(
      `Missing required production env: ${missing.join(', ')}. ` +
        'Set them in .env or run with NODE_ENV=development.',
    );
  }
}

/** One line per env-driven feature: ON (where) or OFF (which var is missing).
 * Logged at boot and shown on the admin health screen, so a silently disabled
 * feature is always one glance away. */
export function featureReport(fc: FeatureConfig): string[] {
  const group = fc.mainGroupId;
  const topic = (id: number | undefined): string => (id ? `topic ${id}` : 'General topic');
  return [
    group ? `message XP: ON (group ${group})` : 'message XP: OFF — MAIN_GROUP_ID not set',
    group
      ? `raid cards: ON (group ${group}, ${topic(fc.raidsTopicId)})`
      : 'raid cards: OFF — MAIN_GROUP_ID not set',
    group
      ? `kickstarter promos: ON (group ${group}, ${topic(fc.kickstartersTopicId)})`
      : 'kickstarter promos: OFF — MAIN_GROUP_ID not set',
    group && fc.rpgTopicId
      ? `RPG announcements: ON (group ${group}, topic ${fc.rpgTopicId})`
      : `RPG announcements: OFF — ${group ? 'RPG_TOPIC_ID' : 'MAIN_GROUP_ID'} not set (XP notices fall back to DM)`,
    group
      ? `main-group invite links: ON (group ${group})`
      : 'main-group invite links: OFF — MAIN_GROUP_ID not set',
    fc.adminNotificationsChat
      ? `admin notifications (applications/SBP/alerts): ON (chat ${fc.adminNotificationsChat})`
      : 'admin notifications: OFF — ADMIN_NOTIFICATIONS_CHAT not set (applications will NOT reach the council)',
    fc.adminNotificationsChat
      ? `SBP payments: ON (amounts ${
          fc.sbpPriceRegularRub && fc.sbpPricePlusRub
            ? `${fc.sbpPriceRegularRub}/${fc.sbpPricePlusRub} RUB`
            : 'not shown — SBP_PRICE_*_RUB not set'
        }; requisites ${fc.sbpRequisites ? 'set' : 'NOT set'})`
      : 'SBP payments: OFF — ADMIN_NOTIFICATIONS_CHAT not set',
    `prices: regular ${fc.regularPrice} XTR, plus ${fc.plusPrice} XTR`,
    fc.testUserId ? `test user: ${fc.testUserId} (charged 1 star)` : 'test user: not set',
  ];
}
