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
  try {
    if (ctx.globalSession?.current?.year && ctx.globalSession?.current?.month) {
      return `${ctx.globalSession.current.year}_${ctx.globalSession.current.month}`;
    }
  } catch (error) {
    console.error('❌ Global session access error:', error.message);
  }
  
  // Fallback to current date
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  console.log(`⚠️  Using fallback period: ${year}_${month}`);
  return `${year}_${month}`;
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
  
  if (roles.includes('goblin') || roles.includes('admin') || roles.includes('adminPlus')) {
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