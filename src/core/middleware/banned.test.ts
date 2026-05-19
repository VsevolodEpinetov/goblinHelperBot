import { describe, expect, it, vi } from 'vitest';

import { createBannedMiddleware } from './banned';

describe('bannedMiddleware', () => {
  it('passes through non-banned users', async () => {
    const isBanned = vi.fn().mockResolvedValue(false);
    const mw = createBannedMiddleware(isBanned);
    const next = vi.fn();
    await mw({ from: { id: 1 }, reply: vi.fn() } as never, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks banned users with a polite message', async () => {
    const isBanned = vi.fn().mockResolvedValue(true);
    const reply = vi.fn();
    const mw = createBannedMiddleware(isBanned);
    const next = vi.fn();
    await mw({ from: { id: 1 }, reply } as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalled();
  });

  it('fails CLOSED on DB error — does NOT pass through', async () => {
    const isBanned = vi.fn().mockRejectedValue(new Error('DB unreachable'));
    const reply = vi.fn();
    const mw = createBannedMiddleware(isBanned);
    const next = vi.fn();
    await mw({ from: { id: 1 }, reply } as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalled();
  });

  it('passes through when ctx.from is missing', async () => {
    const isBanned = vi.fn();
    const mw = createBannedMiddleware(isBanned);
    const next = vi.fn();
    await mw({ from: undefined } as never, next);
    expect(next).toHaveBeenCalled();
    expect(isBanned).not.toHaveBeenCalled();
  });
});
