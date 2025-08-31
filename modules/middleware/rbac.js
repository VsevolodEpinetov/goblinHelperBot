const { hasPermission, isAdmin, isSuperAdmin } = require('../rbac/permissions');

/**
 * RBAC Middleware for Telegram Bot
 * 
 * This middleware provides permission checking for bot actions.
 * It can be used to restrict access to certain commands or actions
 * based on user roles and permissions.
 */

/**
 * Middleware to check if user has a specific permission
 * @param {string} permission - Permission to check
 * @param {string} errorMessage - Custom error message (optional)
 * @returns {Function} - Middleware function
 */
function requirePermission(permission, errorMessage = null) {
  return async (ctx, next) => {
    try {
      // Get user data from context
      const userId = ctx.from?.id || ctx.message?.from?.id;
      if (!userId) {
        await ctx.reply('❌ Не удалось определить пользователя');
        return;
      }

      // Get user roles from database or context
      let userRoles = [];
      
      // Try to get roles from context first (if already loaded)
      if (ctx.userData && ctx.userData.roles) {
        userRoles = ctx.userData.roles;
      } else if (ctx.users && ctx.users.list && ctx.users.list[userId]) {
        userRoles = ctx.users.list[userId].roles || [];
      } else {
        // Load user data from database
        const { getUser } = require('../db/helpers');
        const userData = await getUser(userId);
        userRoles = userData ? userData.roles : [];
      }

      // Check permission
      if (!hasPermission(userRoles, permission)) {
        const message = errorMessage || '❌ У вас нет прав для выполнения этого действия';
        await ctx.reply(message);
        return;
      }

      // Permission granted, continue
      await next();
    } catch (error) {
      console.error('RBAC middleware error:', error);
      await ctx.reply('❌ Произошла ошибка при проверке прав доступа');
    }
  };
}

/**
 * Middleware to check if user is an admin
 * @param {string} errorMessage - Custom error message (optional)
 * @returns {Function} - Middleware function
 */
function requireAdmin(errorMessage = null) {
  return async (ctx, next) => {
    try {
      const userId = ctx.from?.id || ctx.message?.from?.id;
      if (!userId) {
        await ctx.reply('❌ Не удалось определить пользователя');
        return;
      }

      let userRoles = [];
      
      if (ctx.userData && ctx.userData.roles) {
        userRoles = ctx.userData.roles;
      } else if (ctx.users && ctx.users.list && ctx.users.list[userId]) {
        userRoles = ctx.users.list[userId].roles || [];
      } else {
        const { getUser } = require('../db/helpers');
        const userData = await getUser(userId);
        userRoles = userData ? userData.roles : [];
      }

      if (!isAdmin(userRoles)) {
        const message = errorMessage || '❌ Требуются права администратора';
        await ctx.reply(message);
        return;
      }

      await next();
    } catch (error) {
      console.error('Admin middleware error:', error);
      await ctx.reply('❌ Произошла ошибка при проверке прав администратора');
    }
  };
}

/**
 * Middleware to check if user is a super admin
 * @param {string} errorMessage - Custom error message (optional)
 * @returns {Function} - Middleware function
 */
function requireSuperAdmin(errorMessage = null) {
  return async (ctx, next) => {
    try {
      const userId = ctx.from?.id || ctx.message?.from?.id;
      if (!userId) {
        await ctx.reply('❌ Не удалось определить пользователя');
        return;
      }

      let userRoles = [];
      
      if (ctx.userData && ctx.userData.roles) {
        userRoles = ctx.userData.roles;
      } else if (ctx.users && ctx.users.list && ctx.users.list[userId]) {
        userRoles = ctx.users.list[userId].roles || [];
      } else {
        const { getUser } = require('../db/helpers');
        const userData = await getUser(userId);
        userRoles = userData ? userData.roles : [];
      }

      if (!isSuperAdmin(userRoles)) {
        const message = errorMessage || '❌ Требуются права супер-администратора';
        await ctx.reply(message);
        return;
      }

      await next();
    } catch (error) {
      console.error('Super admin middleware error:', error);
      await ctx.reply('❌ Произошла ошибка при проверке прав супер-администратора');
    }
  };
}

/**
 * Middleware to check if user has any of the specified permissions
 * @param {string[]} permissions - Array of permissions to check
 * @param {string} errorMessage - Custom error message (optional)
 * @returns {Function} - Middleware function
 */
function requireAnyPermission(permissions, errorMessage = null) {
  return async (ctx, next) => {
    try {
      const userId = ctx.from?.id || ctx.message?.from?.id;
      if (!userId) {
        await ctx.reply('❌ Не удалось определить пользователя');
        return;
      }

      let userRoles = [];
      
      if (ctx.userData && ctx.userData.roles) {
        userRoles = ctx.userData.roles;
      } else if (ctx.users && ctx.users.list && ctx.users.list[userId]) {
        userRoles = ctx.users.list[userId].roles || [];
      } else {
        const { getUser } = require('../db/helpers');
        const userData = await getUser(userId);
        userRoles = userData ? userData.roles : [];
      }

      // Check if user has any of the required permissions
      const hasAnyPermission = permissions.some(permission => 
        hasPermission(userRoles, permission)
      );

      if (!hasAnyPermission) {
        const message = errorMessage || '❌ У вас нет необходимых прав для выполнения этого действия';
        await ctx.reply(message);
        return;
      }

      await next();
    } catch (error) {
      console.error('Any permission middleware error:', error);
      await ctx.reply('❌ Произошла ошибка при проверке прав доступа');
    }
  };
}

/**
 * Middleware to check if user has all of the specified permissions
 * @param {string[]} permissions - Array of permissions to check
 * @param {string} errorMessage - Custom error message (optional)
 * @returns {Function} - Middleware function
 */
function requireAllPermissions(permissions, errorMessage = null) {
  return async (ctx, next) => {
    try {
      const userId = ctx.from?.id || ctx.message?.from?.id;
      if (!userId) {
        await ctx.reply('❌ Не удалось определить пользователя');
        return;
      }

      let userRoles = [];
      
      if (ctx.userData && ctx.userData.roles) {
        userRoles = ctx.userData.roles;
      } else if (ctx.users && ctx.users.list && ctx.users.list[userId]) {
        userRoles = ctx.users.list[userId].roles || [];
      } else {
        const { getUser } = require('../db/helpers');
        const userData = await getUser(userId);
        userRoles = userData ? userData.roles : [];
      }

      // Check if user has all of the required permissions
      const hasAllPermissions = permissions.every(permission => 
        hasPermission(userRoles, permission)
      );

      if (!hasAllPermissions) {
        const message = errorMessage || '❌ У вас нет всех необходимых прав для выполнения этого действия';
        await ctx.reply(message);
        return;
      }

      await next();
    } catch (error) {
      console.error('All permissions middleware error:', error);
      await ctx.reply('❌ Произошла ошибка при проверке прав доступа');
    }
  };
}

module.exports = {
  requirePermission,
  requireAdmin,
  requireSuperAdmin,
  requireAnyPermission,
  requireAllPermissions
};
