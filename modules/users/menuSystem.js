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
  markInvitationUsed
} = require('./menus');

function getCurrentPeriod(ctx) {
  const util = require('../util');
  return util.getCurrentPeriod(ctx).period;
}

/**
 * Comprehensive User Menu System
 * Handles different user states and provides appropriate menus
 */

/**
 * Get user menu based on their current state
 */
async function getUserMenu(ctx, userData) {
  const roles = userData?.roles || [];
  
  if (roles.includes('super')) {
    return getSuperUserMenu(ctx, userData);
  }
  
  // Admin-based menu for admins (admin, adminPlus, adminPolls)
  if (roles.includes('admin') || roles.includes('adminPlus') || roles.includes('adminPolls')) {
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
    keyboard.push([Markup.button.callback('👤 Открыть пользовательское меню', 'refreshUserStatus')]);
    return { message, keyboard };
  }

  if (roles.includes('goblin')) {
    return await getApprovedUserMenu(ctx, userData);
  }
  
  if (roles.includes('preapproved')) {
    return getPreapprovedUserMenu(ctx, userData);
  }
  
  if (roles.includes('pending')) {
    return getPendingUserMenu(ctx, userData);
  }
  
  if (roles.includes('rejected')) {
    return getRejectedUserMenu(ctx, userData);
  }
  
  if (roles.includes('banned')) {
    return getBannedUserMenu();
  }
  
  if (roles.includes('selfbanned')) {
    return getSelfBannedUserMenu(ctx, userData);
  }
  
  return getNewUserMenu(ctx, userData);
}

module.exports = {
  getUserMenu,
  markInvitationUsed,
  getCurrentPeriod
};