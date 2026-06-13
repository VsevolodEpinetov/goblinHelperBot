import { LRUCache } from 'lru-cache';
import type { Context, MiddlewareFn } from 'telegraf';

import { db } from '../../db/client';
import { upsertUserFromTelegram } from '../../db/repos/users';
import { logger } from '../observability';

interface CachedUser {
  username: string | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
}

interface UserInput {
  id: number;
  username: string | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
}

interface Options {
  upsert: (u: UserInput) => Promise<void>;
  cacheSize?: number;
}

function sameUser(a: CachedUser, b: CachedUser): boolean {
  return a.username === b.username && a.firstName === b.firstName && a.lastName === b.lastName;
}

export function createUserTracker(opts: Options): MiddlewareFn<Context> {
  const cache = new LRUCache<number, CachedUser>({ max: opts.cacheSize ?? 10_000 });
  return async (ctx, next) => {
    const from = ctx.from;
    if (!from) return next();
    const current: CachedUser = {
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
    };
    const cached = cache.get(from.id);
    if (!cached || !sameUser(cached, current)) {
      try {
        await opts.upsert({ id: from.id, ...current });
        cache.set(from.id, current);
      } catch (err) {
        logger.warn({ err, userId: from.id }, 'userTracker upsert failed; continuing chain');
      }
    }
    return next();
  };
}

export const userTrackerMiddleware: MiddlewareFn<Context> = createUserTracker({
  upsert: (u) => upsertUserFromTelegram(db, u),
});
