/**
 * RBAC (Role-Based Access Control) System
 * Role-only checks: use ensureRoles in handlers or requireRoles/requireAdmin/requireSuperAdmin as middleware.
 */

const middleware = require('../middleware/rbac');
const roleManager = require('./roleManager');

module.exports = {
  // Inline role check (use at start of command/action)
  ensureRoles: middleware.ensureRoles,

  // Middleware
  requireRoles: middleware.requireRoles,
  requireAdmin: middleware.requireAdmin,
  requireSuperAdmin: middleware.requireSuperAdmin,

  // Role management
  addUserRole: roleManager.addUserRole,
  removeUserRole: roleManager.removeUserRole,
  getUserRoles: roleManager.getUserRoles,
  setUserRoles: roleManager.setUserRoles,
  userHasRole: roleManager.userHasRole,
  getUsersWithRole: roleManager.getUsersWithRole,
  getAdminUsers: roleManager.getAdminUsers,
  getPollsAdminUsers: roleManager.getPollsAdminUsers,
  getProtectorUsers: roleManager.getProtectorUsers,
  promoteToAdmin: roleManager.promoteToAdmin,
  demoteAdmin: roleManager.demoteAdmin,
  getRoleHierarchy: roleManager.getRoleHierarchy
};
