import type { Context, MiddlewareFn } from 'telegraf';
import { Composer } from 'telegraf';
import type { z, ZodDiscriminatedUnion, ZodLiteral, ZodObject } from 'zod';

import { logger } from './observability';

type ActionName = string;

interface Entry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: ZodDiscriminatedUnion<'a', any>;
  handler: (ctx: Context, payload: unknown) => Promise<void> | void;
}

export interface Router {
  on<S extends ZodDiscriminatedUnion<'a', readonly ZodObject<{ a: ZodLiteral<ActionName> }>[]>>(
    schema: S,
    handler: (ctx: Context, payload: z.infer<S>) => Promise<void> | void,
  ): void;
  encode<S extends ZodDiscriminatedUnion<'a', readonly ZodObject<{ a: ZodLiteral<ActionName> }>[]>>(
    schema: S,
    payload: z.infer<S>,
  ): string;
  middleware(): MiddlewareFn<Context>;
}

const MAX_CALLBACK_LEN = 64;
const SEPARATOR = '|';

function actionsOf(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: ZodDiscriminatedUnion<'a', any>,
): ActionName[] {
  const actions: ActionName[] = [];
  for (const option of schema.options) {
    const aField = option.shape.a;
    if (aField && '_def' in aField) {
      const literal = (aField as { _def: { value: ActionName } })._def.value;
      actions.push(literal);
    }
  }
  return actions;
}

export function createRouter(): Router {
  const entries = new Map<ActionName, Entry>();

  return {
    on(schema, handler) {
      for (const action of actionsOf(schema)) {
        if (entries.has(action)) {
          throw new Error(
            `Router: duplicate action "${action}". Two schemas claim the same discriminator.`,
          );
        }
        entries.set(action, { schema, handler: handler as Entry['handler'] });
      }
    },

    encode(schema, payload) {
      const parsed = schema.parse(payload);
      const action = (parsed as { a: ActionName }).a;
      const rest: Record<string, unknown> = { ...(parsed as Record<string, unknown>) };
      delete rest.a;
      const encoded = `${action}${SEPARATOR}${JSON.stringify(rest)}`;
      if (encoded.length > MAX_CALLBACK_LEN) {
        throw new Error(
          `Router: encoded callback_data exceeds ${MAX_CALLBACK_LEN} bytes (got ${encoded.length}): ${encoded}`,
        );
      }
      return encoded;
    },

    middleware() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return Composer.action(/.+/, async (ctx: any, next) => {
        const data =
          ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
        if (typeof data !== 'string') return next();

        const idx = data.indexOf(SEPARATOR);
        const action = idx >= 0 ? data.slice(0, idx) : data;
        const restJson = idx >= 0 ? data.slice(idx + 1) : '{}';

        const entry = entries.get(action);
        if (!entry) return next();

        let rest: unknown;
        try {
          rest = JSON.parse(restJson);
        } catch (err) {
          logger.warn({ err, data }, 'Router: failed to JSON.parse payload');
          return next();
        }
        const merged = { a: action, ...(rest as Record<string, unknown>) };
        const parseResult = entry.schema.safeParse(merged);
        if (!parseResult.success) {
          logger.warn(
            { data, error: parseResult.error.format() },
            'Router: payload failed schema validation',
          );
          return next();
        }

        try {
          await entry.handler(ctx, parseResult.data);
        } catch (err) {
          logger.error({ err, action }, 'Router: handler threw');
          throw err;
        }
      });
    },
  };
}
