import { createClient, type RedisClientType } from 'redis';

import { getConfig } from './config';
import { logger } from './observability';

const cfg = getConfig();

/** Single Redis client, connected lazily on first command. */
export const redis: RedisClientType = createClient({
  socket: { host: cfg.redisHost, port: cfg.redisPort },
  password: cfg.redisPassword,
});

redis.on('error', (err: unknown) => {
  logger.error({ err }, 'Redis client error');
});

export async function connectRedis(): Promise<void> {
  if (!redis.isOpen) await redis.connect();
}

export async function disconnectRedis(): Promise<void> {
  if (redis.isOpen) await redis.quit();
}
