import { describe, expect, it, vi } from 'vitest';

import { createBannedMiddleware } from './banned';

describe('bannedMiddleware', () => {
  it('passes through non-banned users', async () => {
    const isBanned = vi.fn().mockResolvedValue(false);
    const mw = createBannedMiddleware(isBanned);
    const next = vi.fn();
    await mw({ from: { id: 1 }, chat: { type: 'private' }, reply: vi.fn() } as never, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks banned users in private chat with a polite message', async () => {
    const isBanned = vi.fn().mockResolvedValue(true);
    const reply = vi.fn();
    const mw = createBannedMiddleware(isBanned);
    const next = vi.fn();
    await mw({ from: { id: 1 }, chat: { type: 'private' }, reply } as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalled();
  });

  it('blocks banned users in group chats silently', async () => {
    const isBanned = vi.fn().mockResolvedValue(true);
    const reply = vi.fn();
    const mw = createBannedMiddleware(isBanned);
    const next = vi.fn();
    await mw({ from: { id: 1 }, chat: { id: -100, type: 'supergroup' }, reply } as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(reply).not.toHaveBeenCalled();
  });

  it('answers the callback query for banned users instead of replying', async () => {
    const isBanned = vi.fn().mockResolvedValue(true);
    const reply = vi.fn();
    const answerCbQuery = vi.fn();
    const mw = createBannedMiddleware(isBanned);
    const next = vi.fn();
    await mw(
      {
        from: { id: 1 },
        chat: { id: -100, type: 'supergroup' },
        callbackQuery: { id: 'cb1' },
        reply,
        answerCbQuery,
      } as never,
      next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(answerCbQuery).toHaveBeenCalled();
    expect(reply).not.toHaveBeenCalled();
  });

  it('fails CLOSED on DB error — does NOT pass through', async () => {
    const isBanned = vi.fn().mockRejectedValue(new Error('DB unreachable'));
    const reply = vi.fn();
    const mw = createBannedMiddleware(isBanned);
    const next = vi.fn();
    await mw({ from: { id: 1 }, chat: { type: 'private' }, reply } as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalled();
  });

  it('fails CLOSED on DB error in groups without replying', async () => {
    const isBanned = vi.fn().mockRejectedValue(new Error('DB unreachable'));
    const reply = vi.fn();
    const mw = createBannedMiddleware(isBanned);
    const next = vi.fn();
    await mw({ from: { id: 1 }, chat: { id: -100, type: 'supergroup' }, reply } as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(reply).not.toHaveBeenCalled();
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
