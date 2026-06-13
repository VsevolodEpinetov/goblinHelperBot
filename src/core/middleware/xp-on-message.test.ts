import { afterEach, describe, expect, it, vi } from 'vitest';

import { createXpOnMessage } from './xp-on-message';

function makeFakeRedis() {
  const store = new Map<string, number>();
  const ttl = new Map<string, number>();
  return {
    store,
    async incr(key: string) {
      const v = (store.get(key) ?? 0) + 1;
      store.set(key, v);
      return v;
    },
    async expire(key: string, seconds: number) {
      ttl.set(key, seconds);
    },
    async ttl(key: string) {
      return ttl.get(key) ?? -1;
    },
  };
}

function makeCtx(update: Record<string, unknown> = { message: {} }) {
  return { from: { id: 1 }, chat: { id: -100 }, update };
}

describe('xp-on-message', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('grants XP when under daily limit', async () => {
    const redis = makeFakeRedis();
    const grant = vi.fn().mockResolvedValue(undefined);
    const mw = createXpOnMessage({
      redis: redis as never,
      grant,
      dailyLimit: 3,
      weeklyLimit: 10,
      allowedChatIds: [-100],
    });
    const next = vi.fn();
    await mw(makeCtx() as never, next);
    expect(grant).toHaveBeenCalledTimes(1);
  });

  it('skips when chat is not in allowedChatIds', async () => {
    const redis = makeFakeRedis();
    const grant = vi.fn();
    const mw = createXpOnMessage({
      redis: redis as never,
      grant,
      dailyLimit: 3,
      weeklyLimit: 10,
      allowedChatIds: [-100],
    });
    await mw({ from: { id: 1 }, chat: { id: -999 }, update: { message: {} } } as never, vi.fn());
    expect(grant).not.toHaveBeenCalled();
  });

  it('ignores edited_message updates in the allowed chat', async () => {
    const redis = makeFakeRedis();
    const grant = vi.fn();
    const mw = createXpOnMessage({
      redis: redis as never,
      grant,
      dailyLimit: 3,
      weeklyLimit: 10,
      allowedChatIds: [-100],
    });
    const next = vi.fn();
    await mw(makeCtx({ edited_message: {} }) as never, next);
    expect(grant).not.toHaveBeenCalled();
    expect(redis.store.size).toBe(0);
    expect(next).toHaveBeenCalled();
  });

  it('ignores callback_query updates in the allowed chat', async () => {
    const redis = makeFakeRedis();
    const grant = vi.fn();
    const mw = createXpOnMessage({
      redis: redis as never,
      grant,
      dailyLimit: 3,
      weeklyLimit: 10,
      allowedChatIds: [-100],
    });
    const next = vi.fn();
    await mw(makeCtx({ callback_query: {} }) as never, next);
    expect(grant).not.toHaveBeenCalled();
    expect(redis.store.size).toBe(0);
    expect(next).toHaveBeenCalled();
  });

  it('stops granting after daily limit', async () => {
    const redis = makeFakeRedis();
    const grant = vi.fn().mockResolvedValue(undefined);
    const mw = createXpOnMessage({
      redis: redis as never,
      grant,
      dailyLimit: 2,
      weeklyLimit: 10,
      allowedChatIds: [-100],
    });
    await mw(makeCtx() as never, vi.fn());
    await mw(makeCtx() as never, vi.fn());
    await mw(makeCtx() as never, vi.fn());
    expect(grant).toHaveBeenCalledTimes(2);
  });

  it('derives both day and week keys from the same UTC clock', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-11T00:30:00Z'));
    const redis = makeFakeRedis();
    const grant = vi.fn().mockResolvedValue(undefined);
    const mw = createXpOnMessage({
      redis: redis as never,
      grant,
      dailyLimit: 3,
      weeklyLimit: 10,
      allowedChatIds: [-100],
    });
    await mw(makeCtx() as never, vi.fn());
    const week = Math.floor(Date.now() / (7 * 86_400_000));
    expect([...redis.store.keys()]).toEqual(['xp:msg:day:2026-06-11:1', `xp:msg:week:${week}:1`]);
  });

  it('resets the daily counter at UTC midnight', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-11T23:59:00Z'));
    const redis = makeFakeRedis();
    const grant = vi.fn().mockResolvedValue(undefined);
    const mw = createXpOnMessage({
      redis: redis as never,
      grant,
      dailyLimit: 1,
      weeklyLimit: 10,
      allowedChatIds: [-100],
    });
    await mw(makeCtx() as never, vi.fn());
    await mw(makeCtx() as never, vi.fn());
    expect(grant).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date('2026-06-12T00:01:00Z'));
    await mw(makeCtx() as never, vi.fn());
    expect(grant).toHaveBeenCalledTimes(2);
  });

  it('still calls next() regardless of XP outcome', async () => {
    const redis = makeFakeRedis();
    const grant = vi.fn();
    const mw = createXpOnMessage({
      redis: redis as never,
      grant,
      dailyLimit: 0,
      weeklyLimit: 0,
      allowedChatIds: [-100],
    });
    const next = vi.fn();
    await mw(makeCtx() as never, next);
    expect(next).toHaveBeenCalled();
  });
});
