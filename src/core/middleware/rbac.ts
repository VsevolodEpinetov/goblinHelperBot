import type { Context, MiddlewareFn } from 'telegraf';

import { db } from '../../db/client';
import { getRolesForUser } from '../../db/repos/user-roles';
import { logger } from '../observability';

export function createRbacMiddleware(
  getRoles: (userId: number) => Promise<string[]>,
): MiddlewareFn<Context> {
  return async (ctx, next) => {
    if (!ctx.from) {
      ctx.state.roles = [];
      return next();
    }
    try {
      ctx.state.roles = await getRoles(ctx.from.id);
    } catch (err) {
      logger.warn(
        { err, userId: ctx.from.id },
        'rbac middleware: role lookup failed; defaulting to []',
      );
      ctx.state.roles = [];
    }
    return next();
  };
}

export const rbacMiddleware: MiddlewareFn<Context> = createRbacMiddleware((id) =>
  getRolesForUser(db, id),
);
