const knex = require('../db/knex');
const { hasPermission, getUserPermissions } = require('./permissions');

/**
 * Role Manager Utility
 * 
 * Provides functions for managing user roles and permissions in the database
 */

/**
 * Add a role to a user
 * @param {number} userId - User ID
 * @param {string} role - Role to add
 * @returns {Promise<boolean>} - Success status
 */
async function addUserRole(userId, role) {
  try {
    await knex('userRoles').insert({ 
      userId: Number(userId), 
      role: role 
    }).onConflict(['userId', 'role']).ignore();
    
    return true;
  } catch (error) {
    console.error('Error adding user role:', error);
    return false;
  }
}

/**
 * Remove a role from a user
 * @param {number} userId - User ID
 * @param {string} role - Role to remove
 * @returns {Promise<boolean>} - Success status
 */
async function removeUserRole(userId, role) {
  try {
    await knex('userRoles').where({ 
      userId: Number(userId), 
      role: role 
    }).del();
    
    return true;
  } catch (error) {
    console.error('Error removing user role:', error);
    return false;
  }
}

/**
 * Get all roles for a user
 * @param {number} userId - User ID
 * @returns {Promise<string[]>} - Array of role names
 */
async function getUserRoles(userId) {
  try {
    const roles = await knex('userRoles')
      .where('userId', Number(userId))
      .select('role');
    
    return roles.map(r => r.role);
  } catch (error) {
    console.error('Error getting user roles:', error);
    return [];
  }
}

/**
 * Set all roles for a user (replaces existing roles)
 * @param {number} userId - User ID
 * @param {string[]} roles - Array of role names
 * @returns {Promise<boolean>} - Success status
 */
async function setUserRoles(userId, roles) {
  try {
    await knex.transaction(async (trx) => {
      // Remove existing roles
      await trx('userRoles').where('userId', Number(userId)).del();
      
      // Add new roles
      if (roles && roles.length > 0) {
        const roleInserts = roles.map(role => ({ 
          userId: Number(userId), 
          role: role 
        }));
        await trx('userRoles').insert(roleInserts);
      }
    });
    
    return true;
  } catch (error) {
    console.error('Error setting user roles:', error);
    return false;
  }
}

/**
 * Check if user has a specific role
 * @param {number} userId - User ID
 * @param {string} role - Role to check
 * @returns {Promise<boolean>} - Whether user has the role
 */
async function userHasRole(userId, role) {
  try {
    const userRole = await knex('userRoles')
      .where({ 
        userId: Number(userId), 
        role: role 
      })
      .first();
    
    return !!userRole;
  } catch (error) {
    console.error('Error checking user role:', error);
    return false;
  }
}

/**
 * Get all users with a specific role
 * @param {string} role - Role to search for
 * @returns {Promise<number[]>} - Array of user IDs
 */
async function getUsersWithRole(role) {
  try {
    const users = await knex('userRoles')
      .where('role', role)
      .select('userId');
    
    return users.map(u => u.userId);
  } catch (error) {
    console.error('Error getting users with role:', error);
    return [];
  }
}

/**
 * Get users with admin permissions
 * @returns {Promise<number[]>} - Array of admin user IDs
 */
async function getAdminUsers() {
  try {
    const adminRoles = ['admin', 'adminPlus', 'super'];
    const users = await knex('userRoles')
      .whereIn('role', adminRoles)
      .select('userId');
    
    return users.map(u => u.userId);
  } catch (error) {
    console.error('Error getting admin users:', error);
    return [];
  }
}

/**
 * Get users with polls admin permissions
 * @returns {Promise<number[]>} - Array of polls admin user IDs
 */
async function getPollsAdminUsers() {
  try {
    const pollsRoles = ['polls', 'admin', 'adminPlus', 'super'];
    const users = await knex('userRoles')
      .whereIn('role', pollsRoles)
      .select('userId');
    
    return users.map(u => u.userId);
  } catch (error) {
    console.error('Error getting polls admin users:', error);
    return [];
  }
}

/**
 * Get users with protector permissions
 * @returns {Promise<number[]>} - Array of protector user IDs
 */
async function getProtectorUsers() {
  try {
    const protectorRoles = ['protector', 'admin', 'adminPlus', 'super'];
    const users = await knex('userRoles')
      .whereIn('role', protectorRoles)
      .select('userId');
    
    return users.map(u => u.userId);
  } catch (error) {
    console.error('Error getting protector users:', error);
    return [];
  }
}

/**
 * Promote a user to admin role
 * @param {number} userId - User ID to promote
 * @param {string} adminType - Type of admin ('admin', 'adminPlus', 'super')
 * @returns {Promise<boolean>} - Success status
 */
async function promoteToAdmin(userId, adminType = 'admin') {
  try {
    // Validate admin type
    const validAdminTypes = ['admin', 'adminPlus', 'super'];
    if (!validAdminTypes.includes(adminType)) {
      throw new Error('Invalid admin type');
    }
    
    // Add admin role
    await addUserRole(userId, adminType);
    
    // Also add basic user role if not present
    await addUserRole(userId, 'user');
    
    return true;
  } catch (error) {
    console.error('Error promoting user to admin:', error);
    return false;
  }
}

/**
 * Demote an admin user
 * @param {number} userId - User ID to demote
 * @returns {Promise<boolean>} - Success status
 */
async function demoteAdmin(userId) {
  try {
    // Remove admin roles
    await knex('userRoles')
      .where('userId', Number(userId))
      .whereIn('role', ['admin', 'adminPlus', 'super'])
      .del();
    
    // Keep basic user role
    await addUserRole(userId, 'user');
    
    return true;
  } catch (error) {
    console.error('Error demoting admin:', error);
    return false;
  }
}

/**
 * Get role hierarchy information
 * @returns {Object} - Role hierarchy structure
 */
function getRoleHierarchy() {
  return {
    user: {
      level: 1,
      description: 'Basic user with limited access',
      inherits: []
    },
    goblin: {
      level: 2,
      description: 'Premium user with extended access',
      inherits: ['user']
    },
    polls: {
      level: 3,
      description: 'Polls administrator',
      inherits: ['user']
    },
    protector: {
      level: 3,
      description: 'Protector - can manage requests and applications',
      inherits: ['user']
    },
    admin: {
      level: 4,
      description: 'Regular administrator',
      inherits: ['user']
    },
    adminPlus: {
      level: 5,
      description: 'Extended administrator',
      inherits: ['user', 'admin']
    },
    super: {
      level: 6,
      description: 'Super administrator with full access',
      inherits: ['user', 'admin', 'adminPlus']
    }
  };
}

module.exports = {
  addUserRole,
  removeUserRole,
  getUserRoles,
  setUserRoles,
  userHasRole,
  getUsersWithRole,
  getAdminUsers,
  getPollsAdminUsers,
  getProtectorUsers,
  promoteToAdmin,
  demoteAdmin,
  getRoleHierarchy
};
