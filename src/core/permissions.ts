import type { Context, MiddlewareFn } from 'telegraf';

import { logger } from './observability';

export function requireRoles(...required: string[]): MiddlewareFn<Context> {
  return async (ctx, next) => {
    const roles = ctx.state.roles ?? [];
    if (required.some((r) => roles.includes(r))) {
      return next();
    }
    logger.debug(
      { required, userRoles: roles, userId: ctx.from?.id },
      'permission denied: requireRoles',
    );
    if ('answerCbQuery' in ctx && typeof ctx.answerCbQuery === 'function') {
      try {
        await ctx.answerCbQuery('Недостаточно прав');
      } catch {
        /* ignore */
      }
    }
  };
}

export function requireDM(): MiddlewareFn<Context> {
  return async (ctx, next) => {
    if (ctx.chat?.type === 'private') return next();
    logger.debug({ chatType: ctx.chat?.type }, 'permission denied: requireDM');
  };
}

export function requireGroup(chatId: number): MiddlewareFn<Context> {
  return async (ctx, next) => {
    if (ctx.chat?.id === chatId) return next();
    logger.debug({ expected: chatId, got: ctx.chat?.id }, 'permission denied: requireGroup');
  };
}
