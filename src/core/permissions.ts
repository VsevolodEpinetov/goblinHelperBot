import type { Context, MiddlewareFn } from 'telegraf';

import { isApprovedMember } from '../shared/user-status';

import { gateKeyboard } from './nav';
import { logger } from './observability';

const MEMBER_DENY =
  '🌑 Стоять, чужак. Это добро для своих. Кнопки ниже — глянь, что тут за место, или сразу ступай на обряд допуска.';

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

/**
 * Gate a member-only command. Approved members pass through; outsiders get the
 * onboarding pitch (in DM) instead of silence, so commands and their callback
 * twins enforce the same boundary.
 */
export function requireApprovedMember(): MiddlewareFn<Context> {
  return async (ctx, next) => {
    const roles = ctx.state.roles ?? [];
    if (isApprovedMember(roles)) return next();
    logger.debug(
      { userRoles: roles, userId: ctx.from?.id },
      'permission denied: requireApprovedMember',
    );
    if (ctx.chat?.type === 'private') {
      await ctx.reply(MEMBER_DENY, gateKeyboard());
    }
  };
}

const ADMIN_RANKS = ['admin', 'adminPlus', 'super'];

/** True if the user holds any admin-rank role (admin, adminPlus, super). */
export function hasAdminRank(roles: readonly string[]): boolean {
  return roles.some((r) => ADMIN_RANKS.includes(r));
}

/** Middleware twin of hasAdminRank for admin-only commands/callbacks. */
export function requireAdmin(): MiddlewareFn<Context> {
  return requireRoles(...ADMIN_RANKS);
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
