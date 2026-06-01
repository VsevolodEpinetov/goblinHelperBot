import type { Context, MiddlewareFn } from 'telegraf';

import { isApprovedMember } from '../shared/user-status';

import { logger } from './observability';

const MEMBER_DENY =
  '🌑 Стоять, чужак. Это не для тебя — сперва пройди обряд через /start, потом и поговорим.';

/**
 * Authorize a member-only callback. Returns true for an approved member;
 * otherwise answers the callback query with a denial and returns false.
 * Callbacks must call this themselves — a hidden menu is never the gate, since
 * any user can replay any callback at any time.
 */
export async function ensureApprovedMember(ctx: Context): Promise<boolean> {
  const roles = ctx.state.roles ?? [];
  if (isApprovedMember(roles)) return true;
  if ('answerCbQuery' in ctx && typeof ctx.answerCbQuery === 'function') {
    try {
      await ctx.answerCbQuery(MEMBER_DENY);
    } catch {
      /* ignore */
    }
  }
  return false;
}

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
