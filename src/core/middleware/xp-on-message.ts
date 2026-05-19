import type { Context, MiddlewareFn } from 'telegraf';

import { logger } from '../observability';

interface RedisLike {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void | number>;
}

interface Options {
  redis: RedisLike;
  grant: (userId: number, amount: number) => Promise<void>;
  dailyLimit: number;
  weeklyLimit: number;
  allowedChatIds: number[];
  xpPerMessage?: number;
}

function dayKey(userId: number): string {
  const d = new Date();
  const day = d.toISOString().slice(0, 10);
  return `xp:msg:day:${day}:${userId}`;
}

function weekKey(userId: number): string {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - start.getTime()) / 86_400_000 + start.getDay() + 1) / 7);
  return `xp:msg:week:${d.getFullYear()}:${week}:${userId}`;
}

const DAY_SECONDS = 86_400;
const WEEK_SECONDS = 7 * 86_400;

export function createXpOnMessage(opts: Options): MiddlewareFn<Context> {
  const xpPerMessage = opts.xpPerMessage ?? 1;
  const allowed = new Set(opts.allowedChatIds);
  return async (ctx, next) => {
    try {
      if (!ctx.from || !ctx.chat) return next();
      if (!allowed.has(ctx.chat.id)) return next();

      const dKey = dayKey(ctx.from.id);
      const wKey = weekKey(ctx.from.id);
      const dCount = await opts.redis.incr(dKey);
      if (dCount === 1) await opts.redis.expire(dKey, DAY_SECONDS);
      const wCount = await opts.redis.incr(wKey);
      if (wCount === 1) await opts.redis.expire(wKey, WEEK_SECONDS);

      if (dCount <= opts.dailyLimit && wCount <= opts.weeklyLimit) {
        await opts.grant(ctx.from.id, xpPerMessage);
      }
    } catch (err) {
      logger.warn({ err }, 'xp-on-message: failed; continuing chain');
    }
    return next();
  };
}
