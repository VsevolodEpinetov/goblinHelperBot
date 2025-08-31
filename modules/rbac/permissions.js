/**
 * RBAC (Role-Based Access Control) Permissions Configuration
 * 
 * This file defines the permissions for different roles in the system.
 * Each role has specific permissions that determine what actions they can perform.
 */

const PERMISSIONS = {
  // Regular user permissions
  user: {
    // Basic user actions
    'user:profile:view': true,
    'user:profile:edit': true,
    'user:payments:view': true,
    'user:payments:request': true,
    'user:kickstarters:view': true,
    'user:kickstarters:join': true,
    'user:lots:view': true,
    'user:lots:join': true,
    'user:lots:leave': true,
    'user:polls:view': true,
    'user:polls:vote': true,
    
    // No admin actions
    'admin:*': false,
    'admin:users:*': false,
    'admin:content:*': false,
    'admin:payments:*': false,
    'admin:reports:*': false
  },

  // Goblin role (premium user)
  goblin: {
    // Inherit all user permissions
    ...PERMISSIONS.user,
    
    // Additional goblin-specific permissions
    'goblin:premium:access': true,
    'goblin:files:download': true,
    'goblin:groups:plus': true,
    
    // Still no admin actions
    'admin:*': false
  },

  // Polls admin (can manage polls)
  polls: {
    // Inherit user permissions
    ...PERMISSIONS.user,
    
    // Poll management permissions
    'admin:polls:create': true,
    'admin:polls:edit': true,
    'admin:polls:delete': true,
    'admin:polls:launch': true,
    'admin:polls:results': true,
    
    // Limited admin access
    'admin:users:*': false,
    'admin:content:*': false,
    'admin:payments:*': false,
    'admin:reports:*': false
  },

  // Regular admin
  admin: {
    // Inherit user permissions
    ...PERMISSIONS.user,
    
    // User management
    'admin:users:view': true,
    'admin:users:edit': true,
    'admin:users:roles:manage': true,
    'admin:users:balance:manage': true,
    'admin:users:months:manage': true,
    
    // Content management
    'admin:content:months:manage': true,
    'admin:content:kickstarters:manage': true,
    'admin:content:files:manage': true,
    'admin:content:links:manage': true,
    
    // Payment management
    'admin:payments:view': true,
    'admin:payments:confirm': true,
    'admin:payments:remind': true,
    
    // Polls management
    'admin:polls:*': true,
    
    // Reports and analytics
    'admin:reports:basic': true,
    'admin:reports:users': true,
    
    // No super admin actions
    'admin:super:*': false,
    'admin:system:*': false
  },

  // Admin Plus (extended admin)
  adminPlus: {
    // Inherit all admin permissions
    ...PERMISSIONS.admin,
    
    // Extended permissions
    'admin:users:delete': true,
    'admin:users:ban': true,
    'admin:content:delete': true,
    'admin:payments:refund': true,
    'admin:reports:advanced': true,
    'admin:notifications:send': true,
    
    // Still no super admin actions
    'admin:super:*': false,
    'admin:system:*': false
  },

  // Super admin (full system access)
  super: {
    // Inherit all permissions
    ...PERMISSIONS.adminPlus,
    
    // Super admin permissions
    'admin:super:roles:manage': true,
    'admin:super:permissions:manage': true,
    'admin:super:users:promote': true,
    'admin:super:system:config': true,
    'admin:super:backup:manage': true,
    'admin:super:logs:view': true,
    
    // System-level permissions
    'admin:system:database:manage': true,
    'admin:system:notifications:global': true,
    'admin:system:maintenance:mode': true
  }
};

/**
 * Permission checking function
 * @param {string[]} userRoles - Array of user roles
 * @param {string} permission - Permission to check (e.g., 'admin:users:view')
 * @returns {boolean} - Whether user has permission
 */
function hasPermission(userRoles, permission) {
  if (!userRoles || !Array.isArray(userRoles)) {
    return false;
  }

  // Check if user has any role that grants this permission
  for (const role of userRoles) {
    if (PERMISSIONS[role] && PERMISSIONS[role][permission]) {
      return true;
    }
  }

  return false;
}

/**
 * Get all permissions for a user
 * @param {string[]} userRoles - Array of user roles
 * @returns {Object} - Object with all permissions for the user
 */
function getUserPermissions(userRoles) {
  if (!userRoles || !Array.isArray(userRoles)) {
    return {};
  }

  const userPerms = {};
  
  for (const role of userRoles) {
    if (PERMISSIONS[role]) {
      Object.assign(userPerms, PERMISSIONS[role]);
    }
  }

  return userPerms;
}

/**
 * Check if user has any admin permissions
 * @param {string[]} userRoles - Array of user roles
 * @returns {boolean} - Whether user has any admin permissions
 */
function isAdmin(userRoles) {
  return hasPermission(userRoles, 'admin:users:view') || 
         hasPermission(userRoles, 'admin:content:months:manage') ||
         hasPermission(userRoles, 'admin:polls:create');
}

/**
 * Check if user is super admin
 * @param {string[]} userRoles - Array of user roles
 * @returns {boolean} - Whether user is super admin
 */
function isSuperAdmin(userRoles) {
  return hasPermission(userRoles, 'admin:super:roles:manage');
}

module.exports = {
  PERMISSIONS,
  hasPermission,
  getUserPermissions,
  isAdmin,
  isSuperAdmin
};
