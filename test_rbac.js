#!/usr/bin/env node

/**
 * Test script for RBAC system
 * Run with: node test_rbac.js
 */

const { 
  hasPermission, 
  getUserPermissions, 
  isAdmin, 
  isSuperAdmin,
  getRoleHierarchy 
} = require('./modules/rbac');

console.log('🔐 Testing RBAC System\n');

// Test permission checking
console.log('📋 Testing Permission Checking:');
console.log('User with no roles:');
console.log('  - admin:users:view:', hasPermission([], 'admin:users:view'));
console.log('  - user:profile:view:', hasPermission([], 'user:profile:view'));

console.log('\nUser with "user" role:');
console.log('  - admin:users:view:', hasPermission(['user'], 'admin:users:view'));
console.log('  - user:profile:view:', hasPermission(['user'], 'user:profile:view'));

console.log('\nUser with "admin" role:');
console.log('  - admin:users:view:', hasPermission(['admin'], 'admin:users:view'));
console.log('  - admin:super:roles:manage:', hasPermission(['admin'], 'admin:super:roles:manage'));

console.log('\nUser with "super" role:');
console.log('  - admin:super:roles:manage:', hasPermission(['super'], 'admin:super:roles:manage'));
console.log('  - admin:system:database:manage:', hasPermission(['super'], 'admin:system:database:manage'));

// Test admin checking
console.log('\n👑 Testing Admin Checking:');
console.log('User with no roles - isAdmin:', isAdmin([]));
console.log('User with "user" role - isAdmin:', isAdmin(['user']));
console.log('User with "polls" role - isAdmin:', isAdmin(['polls']));
console.log('User with "admin" role - isAdmin:', isAdmin(['admin']));
console.log('User with "super" role - isAdmin:', isAdmin(['super']));

// Test super admin checking
console.log('\n🌟 Testing Super Admin Checking:');
console.log('User with no roles - isSuperAdmin:', isSuperAdmin([]));
console.log('User with "admin" role - isSuperAdmin:', isSuperAdmin(['admin']));
console.log('User with "adminPlus" role - isSuperAdmin:', isSuperAdmin(['adminPlus']));
console.log('User with "super" role - isSuperAdmin:', isSuperAdmin(['super']));

// Test permission inheritance
console.log('\n🔄 Testing Permission Inheritance:');
const userPerms = getUserPermissions(['user']);
const goblinPerms = getUserPermissions(['goblin']);
const adminPerms = getUserPermissions(['admin']);
const superPerms = getUserPermissions(['super']);

console.log('User permissions count:', Object.keys(userPerms).length);
console.log('Goblin permissions count:', Object.keys(goblinPerms).length);
console.log('Admin permissions count:', Object.keys(adminPerms).length);
console.log('Super permissions count:', Object.keys(superPerms).length);

// Test role hierarchy
console.log('\n📊 Role Hierarchy:');
const hierarchy = getRoleHierarchy();
Object.entries(hierarchy).forEach(([role, info]) => {
  console.log(`${role} (level ${info.level}): ${info.description}`);
  if (info.inherits.length > 0) {
    console.log(`  Inherits: ${info.inherits.join(', ')}`);
  }
});

console.log('\n✅ RBAC system test completed!');
