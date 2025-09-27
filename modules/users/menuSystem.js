const { Markup } = require('telegraf');
const { 
  getSuperUserMenu,
  getApprovedUserMenu,
  getMainUserMenu,
  getPreapprovedUserMenu,
  getPendingUserMenu,
  getRejectedUserMenu,
  getBannedUserMenu,
  getSelfBannedUserMenu,
  getNewUserMenu,
  getDepartedMenu,
  markInvitationUsed
} = require('./menus');
const { hasPermission } = require('../rbac/permissions');
const { userHasRole } = require('../rbac/roleManager');
const { hasAchievement } = require('../loyalty/achievementsService');

function getCurrentPeriod(ctx) {
  const util = require('../util');
  return util.getCurrentPeriod(ctx).period;
}

/**
 * Comprehensive User Menu System
 * Handles different user states and provides appropriate menus
 */

/**
 * Check if user has specific achievements required for menu access
 * @param {number} userId - User ID
 * @param {string[]} requiredAchievements - Array of achievement types required
 * @returns {Promise<boolean>} - Whether user has all required achievements
 */
async function checkAchievementRequirements(userId, requiredAchievements = []) {
  if (!requiredAchievements || requiredAchievements.length === 0) {
    return true; // No achievements required
  }
  
  try {
    for (const achievementType of requiredAchievements) {
      const hasAchievement = await hasAchievement(userId, achievementType);
      if (!hasAchievement) {
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('Error checking achievement requirements:', error);
    return false;
  }
}

/**
 * Check if user has permission to access a specific menu
 * @param {number} userId - User ID
 * @param {string[]} userRoles - User roles array
 * @param {string} menuType - Type of menu to check access for
 * @param {string[]} requiredAchievements - Optional array of achievement types required
 * @returns {Promise<boolean>} - Whether user has permission
 */
async function checkMenuPermission(userId, userRoles, menuType, requiredAchievements = []) {
  try {
    // First check if user has required achievements
    const hasRequiredAchievements = await checkAchievementRequirements(userId, requiredAchievements);
    if (!hasRequiredAchievements) {
      return false;
    }
    
    switch (menuType) {
      case 'super':
        return userRoles.includes('super') && hasPermission(userRoles, 'admin:super:roles:manage');
      
      case 'admin':
        return (userRoles.includes('admin') || userRoles.includes('adminPlus') || userRoles.includes('adminPolls')) &&
               hasPermission(userRoles, 'admin:users:view');
      
      case 'goblin':
        const hasGoblinRole = userRoles.includes('goblin') && hasPermission(userRoles, 'goblin:premium:access');
        
        return hasGoblinRole;
      
      case 'protector':
        return userRoles.includes('protector') && hasPermission(userRoles, 'admin:requests:view');
      
      case 'departed':
        return userRoles.includes('departed');
      
      case 'preapproved':
        return userRoles.includes('preapproved');
      
      case 'pending':
        return userRoles.includes('pending');
      
      case 'rejected':
        return userRoles.includes('rejected');
      
      case 'banned':
        return userRoles.includes('banned');
      
      case 'selfbanned':
        return userRoles.includes('selfbanned');
      
      case 'new':
        // New users have no specific permissions, so they can access new user menu
        return !userRoles.some(role => ['super', 'admin', 'adminPlus', 'adminPolls', 'goblin', 'protector', 'departed', 'preapproved', 'pending', 'rejected', 'banned', 'selfbanned'].includes(role));
      
      default:
        return false;
    }
  } catch (error) {
    console.error('Error checking menu permission:', error);
    return false;
  }
}

/**
 * Get user menu based on their current state with permission validation
 */
async function getUserMenu(ctx, userData) {
  const userId = ctx.from.id;
  const roles = userData?.roles || [];
  
  // Check super user menu with permission validation
  if (roles.includes('super')) {
    const hasPermission = await checkMenuPermission(userId, roles, 'super');
    if (hasPermission) {
      return getSuperUserMenu(ctx, userData);
    }
  }
  
  // Admin-based menu for admins (admin, adminPlus, adminPolls) with permission validation
  if (roles.includes('admin') || roles.includes('adminPlus') || roles.includes('adminPolls')) {
    const hasPermission = await checkMenuPermission(userId, roles, 'admin');
    if (hasPermission) {
      const keyboard = [];
      let message = '⚙️ <b>Панель старейшин</b>\n\nВыберите действие:';
      keyboard.push([Markup.button.callback('🧭 Присоединиться к текущему месяцу', 'join_current_month')]);
      keyboard.push([Markup.button.callback('📚 Старые месяцы', 'old_months')]);
      if (roles.includes('adminPlus')) {
        keyboard.push([Markup.button.callback('🧭 Присоединиться к текущему PLUS', 'join_current_plus')]);
      }
      if (roles.includes('adminPolls') || roles.includes('polls')) {
        keyboard.push([Markup.button.callback('🗳️ Голосования', 'adminPolls')]);
      }
      if (roles.includes('protector') || roles.includes('admin') || roles.includes('adminPlus')) {
        keyboard.push([Markup.button.callback('📋 Заявки на вступление', 'adminPendingApplications')]);
        keyboard.push([Markup.button.callback('🔍 Поиск заявки', 'searchRequest')]);
      }
      keyboard.push([Markup.button.callback('👤 Открыть пользовательское меню', 'refreshUserStatus')]);
      return { message, keyboard };
    }
  }

  // Goblin/Protector menu with permission validation
  if (roles.includes('goblin') || roles.includes('protector')) {
    const hasPermission = await checkMenuPermission(userId, roles, 'goblin');
    if (hasPermission) {
      return await getApprovedUserMenu(ctx, userData);
    }
  }
  
  // Departed menu with permission validation
  if (roles.includes('departed')) {
    const hasPermission = await checkMenuPermission(userId, roles, 'departed');
    if (hasPermission) {
      return getDepartedMenu(ctx, userData);
    }
  }
  
  // Preapproved menu with permission validation
  if (roles.includes('preapproved')) {
    const hasPermission = await checkMenuPermission(userId, roles, 'preapproved');
    if (hasPermission) {
      return getPreapprovedUserMenu(ctx, userData);
    }
  }
  
  // Pending menu with permission validation
  if (roles.includes('pending')) {
    const hasPermission = await checkMenuPermission(userId, roles, 'pending');
    if (hasPermission) {
      return getPendingUserMenu(ctx, userData);
    }
  }
  
  // Rejected menu with permission validation
  if (roles.includes('rejected')) {
    const hasPermission = await checkMenuPermission(userId, roles, 'rejected');
    if (hasPermission) {
      return getRejectedUserMenu(ctx, userData);
    }
  }
  
  // Banned menu with permission validation
  if (roles.includes('banned')) {
    const hasPermission = await checkMenuPermission(userId, roles, 'banned');
    if (hasPermission) {
      return getBannedUserMenu();
    }
  }
  
  // Self-banned menu with permission validation
  if (roles.includes('selfbanned')) {
    const hasPermission = await checkMenuPermission(userId, roles, 'selfbanned');
    if (hasPermission) {
      return getSelfBannedUserMenu(ctx, userData);
    }
  }
  
  // Default to new user menu (no permission check needed for new users)
  return getNewUserMenu(ctx, userData);
}

module.exports = {
  getUserMenu,
  markInvitationUsed,
  getCurrentPeriod,
  checkMenuPermission,
  checkAchievementRequirements
};