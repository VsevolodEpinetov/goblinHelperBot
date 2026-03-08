# RBAC (Role-Based Access Control) System

This module provides role-based access control for the Telegram bot. Access is determined only by **roles**; there are no permission strings. Each command or action checks at the start whether the user has one of the allowed roles.

## Overview

The RBAC system consists of:

1. **Middleware** (`middleware/rbac.js`) – `ensureRoles` (inline helper), `requireRoles`, `requireAdmin`, `requireSuperAdmin`
2. **Role Manager** (`roleManager.js`) – Utilities for managing user roles in the database

## Role hierarchy

```
user (level 1) - Basic user
├── goblin (level 2) - Premium user
├── polls (level 3) - Polls administrator
├── adminPolls (level 3) - Admin with polls access
├── protector (level 3) - Can manage requests and applications
├── admin (level 4) - Regular administrator
├── adminPlus (level 5) - Extended administrator
└── super (level 6) - Super administrator
```

## Usage

### Inline check at start of command/action

Use `ensureRoles(ctx, allowedRoles, options)` at the beginning of a handler. It loads the user, checks roles, and replies with an error if not allowed.

```javascript
const { ensureRoles } = require('../rbac');

const POLLS_ROLES = ['polls', 'adminPolls', 'admin', 'adminPlus', 'super'];

module.exports = Composer.action('adminPolls', async (ctx) => {
  const check = await ensureRoles(ctx, POLLS_ROLES, { errorMessage: '❌ Нет прав' });
  if (!check.allowed) return;
  // check.userData is available if you need it
  // ... rest of handler
});
```

### Middleware

Use `requireRoles`, `requireAdmin`, or `requireSuperAdmin` when you want the check to run as middleware before the handler.

```javascript
const { requireRoles, requireAdmin, requireSuperAdmin } = require('../rbac');

// Any of these roles
bot.command('manage_users',
  requireRoles(['admin', 'adminPlus', 'super'], '❌ Требуются права администратора'),
  async (ctx) => { /* ... */ }
);

// Shorthand for admin roles
bot.command('admin_panel', requireAdmin(), async (ctx) => { /* ... */ });

// Super only
bot.command('super_cmd', requireSuperAdmin(), async (ctx) => { /* ... */ });
```

### Role management

```javascript
const {
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
} = require('../rbac');

await addUserRole(userId, 'admin');
await removeUserRole(userId, 'admin');
const roles = await getUserRoles(userId);
const hasAdmin = await userHasRole(userId, 'admin');
```

## API summary

| Function | Description |
|----------|-------------|
| `ensureRoles(ctx, allowedRoles, options)` | Inline check. Returns `{ allowed, userData }`. Replies and returns `{ allowed: false }` if user has none of the roles. |
| `requireRoles(allowedRoles, errorMessage)` | Middleware: only allows users with one of the roles. |
| `requireAdmin(errorMessage)` | Middleware: allows `admin`, `adminPlus`, `super`. |
| `requireSuperAdmin(errorMessage)` | Middleware: allows only `super`. |

Role manager: `addUserRole`, `removeUserRole`, `getUserRoles`, `setUserRoles`, `userHasRole`, `getUsersWithRole`, `getAdminUsers`, `getPollsAdminUsers`, `getProtectorUsers`, `promoteToAdmin`, `demoteAdmin`, `getRoleHierarchy`.

## Configuration

- `users` table and `userRoles` table with `userId` and `role` columns.
- No permission tables; access is determined only by presence of roles.

## Example

See `modules/admin/commands/rbacExample.js` for a full example using role checks and role management.
