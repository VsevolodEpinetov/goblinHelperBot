import { createClient, type RedisClientType } from 'redis';

import { getConfig } from './config';
import { logger, metrics } from './observability';

const cfg = getConfig();

const COMMAND_TIMEOUT_MS = 2_000;

/** Single Redis client. node-redis v4 does NOT connect lazily — call connectRedis() at startup. */
export const redis: RedisClientType = createClient({
  socket: {
    host: cfg.redisHost,
    port: cfg.redisPort,
    reconnectStrategy: (retries) => Math.min(retries * 200, 5000),
  },
  password: cfg.redisPassword,
  commandsQueueMaxLength: 1000,
});

redis.on('error', (err: unknown) => {
  logger.error({ err }, 'Redis client error');
});

function withDegrade<Args extends unknown[], T>(
  fn: (...args: Args) => Promise<T>,
  fallback: T,
  op: string,
): (...args: Args) => Promise<T> {
  return (...args) =>
    new Promise<T>((resolve) => {
      const timer = setTimeout(() => {
        metrics.incr('redis.degraded');
        logger.warn({ op }, 'Redis command timed out; degrading');
        resolve(fallback);
      }, COMMAND_TIMEOUT_MS);
      fn(...args).then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err: unknown) => {
          clearTimeout(timer);
          metrics.incr('redis.degraded');
          logger.warn({ err, op }, 'Redis command failed; degrading');
          resolve(fallback);
        },
      );
    });
}

// The session store relies on get/set/del; during a Redis outage these degrade
// (empty session / dropped write) instead of stalling every incoming update.
redis.get = withDegrade(redis.get.bind(redis), null, 'get') as typeof redis.get;
redis.set = withDegrade(redis.set.bind(redis), null, 'set') as typeof redis.set;
redis.del = withDegrade(redis.del.bind(redis), 0, 'del') as typeof redis.del;

export async function connectRedis(): Promise<void> {
  if (!redis.isOpen) await redis.connect();
}

export async function disconnectRedis(): Promise<void> {
  if (redis.isOpen) await redis.quit();
}
