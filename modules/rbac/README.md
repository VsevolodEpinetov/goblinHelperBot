# RBAC (Role-Based Access Control) System

This module provides a comprehensive role-based access control system for the Telegram bot, allowing fine-grained permission management.

## Overview

The RBAC system consists of three main components:

1. **Permissions Configuration** (`permissions.js`) - Defines what each role can do
2. **Middleware** (`middleware/rbac.js`) - Provides permission checking middleware
3. **Role Manager** (`roleManager.js`) - Utilities for managing user roles

## Roles and Permissions

### Role Hierarchy

```
user (level 1) - Basic user with limited access
├── goblin (level 2) - Premium user with extended access
├── polls (level 3) - Polls administrator
├── admin (level 4) - Regular administrator
├── adminPlus (level 5) - Extended administrator
└── super (level 6) - Super administrator with full access
```

### Permission Structure

Permissions follow the format: `category:action:resource`

Examples:
- `user:profile:view` - View user profile
- `admin:users:view` - View users (admin only)
- `admin:content:months:manage` - Manage content months
- `admin:super:roles:manage` - Manage roles (super admin only)

## Usage Examples

### 1. Basic Permission Checking

```javascript
const { hasPermission } = require('../rbac');

// Check if user has specific permission
if (hasPermission(userRoles, 'admin:users:view')) {
  // User can view users
}
```

### 2. Using Middleware

```javascript
const { requirePermission, requireAdmin } = require('../rbac');

// Require specific permission
bot.command('manage_users', 
  requirePermission('admin:users:view'),
  async (ctx) => {
    // Only users with admin:users:view permission can access this
  }
);

// Require admin role
bot.command('admin_panel', 
  requireAdmin(),
  async (ctx) => {
    // Only admins can access this
  }
);
```

### 3. Role Management

```javascript
const { 
  addUserRole, 
  removeUserRole, 
  promoteToAdmin 
} = require('../rbac');

// Add role to user
await addUserRole(userId, 'admin');

// Remove role from user
await removeUserRole(userId, 'admin');

// Promote user to admin
await promoteToAdmin(userId, 'adminPlus');
```

## Available Middleware Functions

### `requirePermission(permission, errorMessage)`
Checks if user has a specific permission.

```javascript
bot.command('example', 
  requirePermission('admin:users:view', '❌ Недостаточно прав'),
  async (ctx) => {
    // Command logic here
  }
);
```

### `requireAdmin(errorMessage)`
Checks if user has any admin permissions.

```javascript
bot.command('admin_only', 
  requireAdmin('❌ Требуются права администратора'),
  async (ctx) => {
    // Admin-only command
  }
);
```

### `requireSuperAdmin(errorMessage)`
Checks if user is a super admin.

```javascript
bot.command('super_admin', 
  requireSuperAdmin('❌ Требуются права супер-администратора'),
  async (ctx) => {
    // Super admin only command
  }
);
```

### `requireAnyPermission(permissions, errorMessage)`
Checks if user has any of the specified permissions.

```javascript
bot.command('any_admin', 
  requireAnyPermission(['admin:users:view', 'admin:content:manage']),
  async (ctx) => {
    // User needs at least one of these permissions
  }
);
```

### `requireAllPermissions(permissions, errorMessage)`
Checks if user has all of the specified permissions.

```javascript
bot.command('full_admin', 
  requireAllPermissions(['admin:users:view', 'admin:content:manage']),
  async (ctx) => {
    // User needs all of these permissions
  }
);
```

## Role Management Functions

### `addUserRole(userId, role)`
Adds a role to a user.

### `removeUserRole(userId, role)`
Removes a role from a user.

### `getUserRoles(userId)`
Gets all roles for a user.

### `setUserRoles(userId, roles)`
Sets all roles for a user (replaces existing).

### `userHasRole(userId, role)`
Checks if user has a specific role.

### `getUsersWithRole(role)`
Gets all users with a specific role.

### `getAdminUsers()`
Gets all users with admin permissions.

### `getPollsAdminUsers()`
Gets all users with polls admin permissions.

### `promoteToAdmin(userId, adminType)`
Promotes a user to admin role.

### `demoteAdmin(userId)`
Demotes an admin user.

## Permission Categories

### User Permissions
- `user:profile:view` - View own profile
- `user:profile:edit` - Edit own profile
- `user:payments:view` - View own payments
- `user:payments:request` - Request payment codes

### Goblin Permissions
- `goblin:premium:access` - Access premium features
- `goblin:files:download` - Download files
- `goblin:groups:plus` - Access plus groups

### Admin Permissions
- `admin:users:view` - View users
- `admin:users:edit` - Edit users
- `admin:users:roles:manage` - Manage user roles
- `admin:content:months:manage` - Manage content months
- `admin:content:kickstarters:manage` - Manage kickstarters
- `admin:payments:view` - View payments
- `admin:payments:confirm` - Confirm payments
- `admin:polls:*` - All polls management

### Super Admin Permissions
- `admin:super:roles:manage` - Manage all roles
- `admin:super:permissions:manage` - Manage permissions
- `admin:super:users:promote` - Promote users to admin
- `admin:system:database:manage` - Database management
- `admin:system:maintenance:mode` - Maintenance mode

## Best Practices

1. **Always check permissions** before allowing sensitive operations
2. **Use middleware** for consistent permission checking
3. **Follow the principle of least privilege** - only grant necessary permissions
4. **Log permission changes** for audit purposes
5. **Test permission boundaries** thoroughly

## Example Implementation

See `modules/admin/commands/rbacExample.js` for a complete example of how to use the RBAC system in practice.

## Configuration

The system is designed to work with your existing database structure. Make sure you have:

- `users` table with user information
- `userRoles` table with user-role relationships
- Proper indexes on `userId` and `role` columns

## Security Notes

- Permissions are checked on every request
- Role changes require appropriate permissions
- Super admin actions are logged
- No permission escalation is possible without proper authorization
