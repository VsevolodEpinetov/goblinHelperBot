const { getUser } = require('../db/helpers');

const DEFAULT_ERROR = '❌ У вас нет прав для выполнения этого действия';
const DEFAULT_NO_USER = '❌ Не удалось определить пользователя';

/**
 * Inline role check: loads user, checks if they have any of allowedRoles.
 * Use at the start of a command/action handler.
 * @param {object} ctx - Telegraf context
 * @param {string[]} allowedRoles - Roles that may access (e.g. ['admin','adminPlus','super'])
 * @param {{ errorMessage?: string }} options - Optional error message
 * @returns {Promise<{ allowed: boolean, userData?: object }>}
 */
async function ensureRoles(ctx, allowedRoles, options = {}) {
  const errorMessage = options.errorMessage || DEFAULT_ERROR;
  const userId = ctx.from?.id || ctx.message?.from?.id || ctx.callbackQuery?.from?.id;
  if (!userId) {
    if (ctx.reply) await ctx.reply(DEFAULT_NO_USER);
    return { allowed: false };
  }

  let userData = ctx.userData;
  if (!userData || !userData.roles) {
    userData = await getUser(userId);
  }
  if (!userData || !userData.roles || !userData.roles.some(r => allowedRoles.includes(r))) {
    if (ctx.callbackQuery) {
      try { await ctx.answerCbQuery(errorMessage); } catch (_) {}
    }
    if (ctx.reply) await ctx.reply(errorMessage);
    return { allowed: false };
  }
  return { allowed: true, userData };
}

/**
 * Middleware: only allows requests from users that have one of the given roles.
 * @param {string[]} allowedRoles - Roles that may access
 * @param {string} errorMessage - Optional custom error message
 * @returns {Function} - Middleware function
 */
function requireRoles(allowedRoles, errorMessage = null) {
  return async (ctx, next) => {
    try {
      const result = await ensureRoles(ctx, allowedRoles, { errorMessage: errorMessage || DEFAULT_ERROR });
      if (!result.allowed) return;
      ctx.userData = ctx.userData || result.userData;
      await next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      if (ctx.reply) await ctx.reply('❌ Произошла ошибка при проверке прав доступа');
    }
  };
}

function requireAdmin(errorMessage = null) {
  return requireRoles(['admin', 'adminPlus', 'super'], errorMessage || '❌ Требуются права администратора');
}

function requireSuperAdmin(errorMessage = null) {
  return requireRoles(['super'], errorMessage || '❌ Требуются права супер-администратора');
}

module.exports = {
  ensureRoles,
  requireRoles,
  requireAdmin,
  requireSuperAdmin
};
