import { Composer, Context } from 'telegraf';
import type { Update } from 'telegraf/types';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createRouter } from './router';

function makeFakeCtx(overrides: Partial<{ callbackQuery: { data: string } }>): Context {
  const update: Update = overrides.callbackQuery
    ? ({
        update_id: 1,
        callback_query: {
          id: 'cb-1',
          from: { id: 1, is_bot: false, first_name: 'Test' },
          chat_instance: 'chat-1',
          data: overrides.callbackQuery.data,
        },
      } as unknown as Update)
    : ({
        update_id: 2,
        message: {
          message_id: 1,
          date: 0,
          chat: { id: 1, type: 'private', first_name: 'Test' },
          text: 'hi',
        },
      } as unknown as Update);
  const ctx = new Context(update, {} as never, {} as never);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ctx as any).answerCbQuery = vi.fn().mockResolvedValue(undefined);
  return ctx;
}

describe('router', () => {
  it('encodes a payload to a short callback_data string', () => {
    const router = createRouter();
    const schema = z.discriminatedUnion('a', [
      z.object({ a: z.literal('payMonth'), year: z.number(), month: z.number() }),
    ]);

    const encoded = router.encode(schema, { a: 'payMonth', year: 2026, month: 5 });

    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeLessThanOrEqual(64);
  });

  it('round-trips a payload via encode → handler', async () => {
    const router = createRouter();
    const schema = z.discriminatedUnion('a', [
      z.object({ a: z.literal('payMonth'), year: z.number(), month: z.number() }),
    ]);
    const handler = vi.fn();
    router.on(schema, handler);

    const encoded = router.encode(schema, { a: 'payMonth', year: 2026, month: 5 });

    const composer = new Composer();
    composer.use(router.middleware());

    const ctx = makeFakeCtx({ callbackQuery: { data: encoded } });
    await (composer.middleware() as any)(ctx, async () => {});
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][1]).toEqual({ a: 'payMonth', year: 2026, month: 5 });
  });

  it('throws when two schemas claim the same action discriminator', () => {
    const router = createRouter();
    const a = z.discriminatedUnion('a', [z.object({ a: z.literal('go') })]);
    const b = z.discriminatedUnion('a', [z.object({ a: z.literal('go') })]);
    router.on(a, async () => {});
    expect(() => router.on(b, async () => {})).toThrow(/duplicate/i);
  });

  it('falls through (calls next) for unknown callback_data', async () => {
    const router = createRouter();
    const composer = new Composer();
    composer.use(router.middleware());

    const fallback = vi.fn();
    const ctx = makeFakeCtx({ callbackQuery: { data: 'totally-unknown' } });
    await (composer.middleware() as any)(ctx, fallback);
    expect(fallback).toHaveBeenCalled();
  });

  it('falls through when there is no callback_query at all', async () => {
    const router = createRouter();
    const composer = new Composer();
    composer.use(router.middleware());

    const fallback = vi.fn();
    const ctx = makeFakeCtx({});
    await (composer.middleware() as any)(ctx, fallback);
    expect(fallback).toHaveBeenCalled();
  });

  it('does not call the handler when payload fails schema validation', async () => {
    const router = createRouter();
    const schema = z.discriminatedUnion('a', [z.object({ a: z.literal('x'), n: z.number() })]);
    const handler = vi.fn();
    router.on(schema, handler);

    const composer = new Composer();
    composer.use(router.middleware());

    // Hand-craft a payload with n as a string (will fail schema)
    const badData = 'x|{"n":"not-a-number"}';
    const ctx = makeFakeCtx({ callbackQuery: { data: badData } });
    await (composer.middleware() as any)(ctx, async () => {});
    expect(handler).not.toHaveBeenCalled();
  });
});
