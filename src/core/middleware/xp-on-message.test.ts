import { describe, expect, it, vi } from 'vitest';

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

describe('xp-on-message', () => {
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
    const ctx = { from: { id: 1 }, chat: { id: -100 } };
    const next = vi.fn();
    await mw(ctx as never, next);
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
    await mw({ from: { id: 1 }, chat: { id: -999 } } as never, vi.fn());
    expect(grant).not.toHaveBeenCalled();
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
    const ctx = { from: { id: 1 }, chat: { id: -100 } };
    await mw(ctx as never, vi.fn());
    await mw(ctx as never, vi.fn());
    await mw(ctx as never, vi.fn());
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
    await mw({ from: { id: 1 }, chat: { id: -100 } } as never, next);
    expect(next).toHaveBeenCalled();
  });
});
