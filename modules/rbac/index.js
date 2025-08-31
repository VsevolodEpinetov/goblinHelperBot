/**
 * RBAC (Role-Based Access Control) System
 * 
 * This module provides a comprehensive role-based access control system
 * for the Telegram bot, allowing fine-grained permission management.
 */

const permissions = require('./permissions');
const middleware = require('../middleware/rbac');
const roleManager = require('./roleManager');

module.exports = {
  // Permission checking functions
  hasPermission: permissions.hasPermission,
  getUserPermissions: permissions.getUserPermissions,
  isAdmin: permissions.isAdmin,
  isSuperAdmin: permissions.isSuperAdmin,
  
  // Permission definitions
  PERMISSIONS: permissions.PERMISSIONS,
  
  // Middleware functions
  requirePermission: middleware.requirePermission,
  requireAdmin: middleware.requireAdmin,
  requireSuperAdmin: middleware.requireSuperAdmin,
  requireAnyPermission: middleware.requireAnyPermission,
  requireAllPermissions: middleware.requireAllPermissions,
  
  // Role management functions
  addUserRole: roleManager.addUserRole,
  removeUserRole: roleManager.removeUserRole,
  getUserRoles: roleManager.getUserRoles,
  setUserRoles: roleManager.setUserRoles,
  userHasRole: roleManager.userHasRole,
  getUsersWithRole: roleManager.getUsersWithRole,
  getAdminUsers: roleManager.getAdminUsers,
  getPollsAdminUsers: roleManager.getPollsAdminUsers,
  promoteToAdmin: roleManager.promoteToAdmin,
  demoteAdmin: roleManager.demoteAdmin,
  getRoleHierarchy: roleManager.getRoleHierarchy
};
