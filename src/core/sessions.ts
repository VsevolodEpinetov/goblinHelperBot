import { Redis } from '@telegraf/session/redis';
import { Composer, session, type Context } from 'telegraf';

import { getConfig } from './config';
import { redis } from './redis';
import { sceneSessionGuard } from './scenes';

const cfg = getConfig();

interface SessionShape {
  user?: Record<string, unknown>;
  chat?: Record<string, unknown>;
  scene?: Record<string, unknown>;
  polls?: Record<string, unknown>;
  __scenes?: Record<string, unknown>;
}

function getSessionKey(ctx: Context): string | undefined {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (chatId === undefined || userId === undefined) return undefined;
  return `${chatId}:${userId}`;
}

// In-memory store for development/testing
const memoryMap = new Map<string, SessionShape>();

const inMemoryStore = {
  get: async (key: string) => memoryMap.get(key),
  set: async (key: string, value: SessionShape) => {
    memoryMap.set(key, value);
  },
  delete: async (key: string) => {
    memoryMap.delete(key);
  },
};

// Redis store using @telegraf/session/redis
const redisStore = Redis<SessionShape>({
  client: redis,
  prefix: 'session:',
});

const store = cfg.useRedisSessions ? redisStore : inMemoryStore;

// The guard composes AFTER session load and BEFORE the stage, so it can clear
// or time-stamp scene state ahead of the scene handlers (see sceneSessionGuard).
export const sessionMiddleware = Composer.compose<Context>([
  session({
    store,
    getSessionKey,
    defaultSession: () => ({}),
  }),
  sceneSessionGuard(),
]);
