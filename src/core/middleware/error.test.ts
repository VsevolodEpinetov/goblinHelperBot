import { describe, expect, it, vi } from 'vitest';

import { errorMiddleware } from './error';

const boom = vi.fn().mockRejectedValue(new Error('boom'));

describe('errorMiddleware', () => {
  it('answers the callback query with an alert when a button handler throws', async () => {
    const reply = vi.fn();
    const answerCbQuery = vi.fn();
    const ctx = {
      update: { update_id: 1, callback_query: {} },
      callbackQuery: { id: 'cb1' },
      from: { id: 1 },
      chat: { id: -100, type: 'supergroup' },
      reply,
      answerCbQuery,
    };
    await errorMiddleware(ctx as never, boom);
    expect(answerCbQuery).toHaveBeenCalledWith(expect.any(String), { show_alert: true });
    expect(reply).not.toHaveBeenCalled();
  });

  it('replies in private chats', async () => {
    const reply = vi.fn();
    const ctx = {
      update: { update_id: 1, message: {} },
      from: { id: 1 },
      chat: { id: 1, type: 'private' },
      reply,
    };
    await errorMiddleware(ctx as never, boom);
    expect(reply).toHaveBeenCalled();
  });

  it('stays silent in group chats', async () => {
    const reply = vi.fn();
    const ctx = {
      update: { update_id: 1, message: {} },
      from: { id: 1 },
      chat: { id: -100, type: 'supergroup' },
      reply,
    };
    await errorMiddleware(ctx as never, boom);
    expect(reply).not.toHaveBeenCalled();
  });

  it('swallows errors from answerCbQuery itself', async () => {
    const answerCbQuery = vi.fn().mockRejectedValue(new Error('query is too old'));
    const ctx = {
      update: { update_id: 1, callback_query: {} },
      callbackQuery: { id: 'cb1' },
      from: { id: 1 },
      chat: { id: 1, type: 'private' },
      reply: vi.fn(),
      answerCbQuery,
    };
    await expect(errorMiddleware(ctx as never, boom)).resolves.toBeUndefined();
  });
});
