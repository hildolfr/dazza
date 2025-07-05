# Permissions Module

The permissions module provides a comprehensive role-based access control system for the Dazza bot. It replaces the simple admin system with a flexible, hierarchical permission management system.

## Features

- **Role-Based Access Control**: Hierarchical permission system with configurable roles
- **Permission Checking**: Wildcard pattern matching for flexible permission definitions
- **Audit Logging**: Complete audit trail of all permission changes and checks
- **Database Storage**: Persistent storage of user roles and permissions
- **Caching**: Performance-optimized permission checking with TTL cache
- **Backward Compatibility**: Maintains compatibility with existing `isAdmin()` calls
- **Dynamic Management**: Runtime role and permission management
- **Event Integration**: Emits events for permission lifecycle

## Architecture

### Services

- **PermissionChecker**: Core permission checking logic with caching
- **RoleManager**: Role assignment and management with database persistence
- **AuditLogger**: Comprehensive audit logging of all permission activities

### Database Schema

#### user_permissions
- `username` (TEXT PRIMARY KEY) - Username (lowercase)
- `role` (TEXT) - Assigned role
- `granted_by` (TEXT) - Who granted the role
- `granted_at` (INTEGER) - When role was granted (timestamp)
- `updated_at` (INTEGER) - Last update timestamp
- `created_at` (DATETIME) - Creation timestamp

#### permission_audit
- `id` (INTEGER PRIMARY KEY) - Audit entry ID
- `username` (TEXT) - Username being audited
- `action` (TEXT) - Action performed (check, grant, revoke, role_change)
- `permission` (TEXT) - Permission involved
- `role` (TEXT) - Role involved
- `old_value` (TEXT) - Previous value
- `new_value` (TEXT) - New value
- `actor` (TEXT) - Who performed the action
- `result` (TEXT) - Result (granted, denied, success, failed)
- `timestamp` (INTEGER) - When action occurred
- `created_at` (DATETIME) - Creation timestamp

## Role System

### Default Roles

#### Owner (Level 100)
- **Permissions**: `["*"]` (all permissions)
- **Description**: Full system access

#### Admin (Level 80)
- **Permissions**: `["admin.*", "command.*", "bot.*"]`
- **Description**: Administrative access to bot functions

#### Moderator (Level 60)
- **Permissions**: `["moderation.*", "command.basic.*"]`
- **Description**: Moderation tools and basic commands

#### User (Level 20)
- **Permissions**: `["command.basic.*"]`
- **Description**: Basic command access

### Permission Patterns

- **Exact Match**: `command.help` - Matches exactly
- **Wildcard**: `command.*` - Matches all commands
- **Hierarchical**: `admin.users.ban` - Specific admin function
- **Global**: `*` - Matches everything

## Configuration

```json
{
  "defaultAdmins": ["ilovechinks", "hildolfr", "Spazztik"],
  "roles": {
    "owner": {
      "level": 100,
      "permissions": ["*"]
    },
    "admin": {
      "level": 80,
      "permissions": ["admin.*", "command.*", "bot.*"]
    },
    "moderator": {
      "level": 60,
      "permissions": ["moderation.*", "command.basic.*"]
    },
    "user": {
      "level": 20,
      "permissions": ["command.basic.*"]
    }
  },
  "auditEnabled": true,
  "cacheTtl": 300000,
  "defaultRole": "user"
}
```

## Usage

### Permission Checking

```javascript
// Check specific permission
const hasPermission = await permissions.checkPermission('username', 'command.help');

// Check admin status (backward compatibility)
const isAdmin = await permissions.isAdmin('username');

// Check specific role
const hasRole = permissions.hasRole('username', 'admin');
```

### Role Management

```javascript
// Set user role
await permissions.setUserRole('username', 'admin', 'granter');

// Remove user role
await permissions.removeUserRole('username', 'remover');

// Get user role
const role = permissions.getUserRole('username');

// Get user permission level
const level = permissions.getUserLevel('username');
```

### Permission Queries

```javascript
// Get all user permissions
const perms = permissions.getUserPermissions('username');

// Get users with specific role
const admins = await permissions.getUsersWithRole('admin');

// Get role hierarchy
const hierarchy = permissions.getRoleHierarchy();
```

### Audit Logging

```javascript
// Get user audit log
const auditLog = await permissions.getUserAuditLog('username', 50);

// Get recent audit activity
const recentAudit = await permissions.getRecentAuditLog(100);

// Get audit statistics
const stats = await permissions.getAuditStats();
```

## Events

### Subscribed Events
- `user.join` - Logs user join events
- `user.leave` - Logs user leave events

### Emitted Events
- `permissions.checked` - When permission is checked
- `permissions.granted` - When permission/role is granted
- `permissions.revoked` - When permission/role is revoked
- `permissions.failed` - When permission operation fails

## Integration

### Command Integration

The permissions module integrates with the command system to provide:

- Role-based command access
- Permission-based command filtering
- Audit trail for command execution
- Dynamic permission checking

### Backward Compatibility

The module maintains backward compatibility with existing code:

- `bot.isAdmin(username)` continues to work
- Existing admin lists are migrated to the new system
- Command permission patterns remain unchanged

## Migration

### From Legacy Admin System

1. **Admin List Migration**: Existing admins are automatically granted 'admin' role
2. **Permission Mapping**: `adminOnly: true` maps to admin-level permissions
3. **User Arrays**: `users: ['username']` continues to work with role system

### Command Updates

Commands can be updated to use the new permission system:

```javascript
// Old way
if (bot.isAdmin(username)) {
    // Admin only code
}

// New way
if (await bot.permissions.checkPermission(username, 'admin.users')) {
    // Permission-based code
}
```

## Security Features

- **Hierarchical Permissions**: Higher roles include lower role permissions
- **Audit Trail**: Complete logging of all permission activities
- **Cache Security**: Automatic cache invalidation on role changes
- **Database Integrity**: Referential integrity with proper indexing
- **Input Validation**: Comprehensive validation of all inputs

## Performance

- **Caching**: In-memory cache with configurable TTL
- **Database Indexing**: Optimized database queries with proper indexes
- **Batch Operations**: Efficient bulk permission checking
- **Memory Management**: Automatic cleanup of expired cache entries

## Administration

### Adding New Roles

1. Update module configuration with new role definition
2. Restart bot to load new roles
3. Assign users to new roles using commands

### Managing Permissions

1. Use admin commands to grant/revoke roles
2. Monitor audit logs for permission changes
3. Regular cleanup of old audit entries

The permissions module provides a solid foundation for scalable access control that can grow with the bot's needs while maintaining security and auditability.