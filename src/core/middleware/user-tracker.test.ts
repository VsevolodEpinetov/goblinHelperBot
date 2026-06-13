import { describe, expect, it, vi } from 'vitest';

import { createUserTracker } from './user-tracker';

describe('userTracker', () => {
  it('upserts a user on first sight', async () => {
    const upsert = vi.fn().mockResolvedValue(undefined);
    const mw = createUserTracker({ upsert, cacheSize: 100 });
    const next = vi.fn();
    await mw({ from: { id: 1, username: 'a', first_name: 'A' } } as never, next);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalled();
  });

  it('skips upsert when user is in cache and unchanged', async () => {
    const upsert = vi.fn().mockResolvedValue(undefined);
    const mw = createUserTracker({ upsert, cacheSize: 100 });
    const next = vi.fn();
    const ctx = { from: { id: 1, username: 'a', first_name: 'A' } };
    await mw(ctx as never, next);
    await mw(ctx as never, next);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('re-upserts when user fields change', async () => {
    const upsert = vi.fn().mockResolvedValue(undefined);
    const mw = createUserTracker({ upsert, cacheSize: 100 });
    const next = vi.fn();
    await mw({ from: { id: 1, username: 'a' } } as never, next);
    await mw({ from: { id: 1, username: 'b' } } as never, next);
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it('does not block the next() chain on upsert errors', async () => {
    const upsert = vi.fn().mockRejectedValue(new Error('DB error'));
    const mw = createUserTracker({ upsert, cacheSize: 100 });
    const next = vi.fn();
    await mw({ from: { id: 1, username: 'a' } } as never, next);
    expect(next).toHaveBeenCalled();
  });

  it('skips when ctx.from is missing', async () => {
    const upsert = vi.fn();
    const mw = createUserTracker({ upsert, cacheSize: 100 });
    const next = vi.fn();
    await mw({ from: undefined } as never, next);
    expect(upsert).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
