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
  const parsed = ConfigSchema.parse(env);
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
