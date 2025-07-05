class PermissionChecker {
    constructor(logger = null) {
        this.logger = logger || console;
        this.cache = new Map();
        this.cacheTtl = 300000; // 5 minutes
    }

    /**
     * Check if a user has a specific permission
     * @param {string} username - The username to check
     * @param {string} permission - The permission to check (e.g., 'admin.*', 'command.help')
     * @param {object} userRoles - User roles data
     * @param {object} roleDefinitions - Role definitions with permissions
     * @returns {boolean} - True if user has permission
     */
    checkPermission(username, permission, userRoles, roleDefinitions) {
        const cacheKey = `${username.toLowerCase()}:${permission}`;
        const cached = this.cache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < this.cacheTtl) {
            return cached.result;
        }

        const result = this._checkPermissionInternal(username, permission, userRoles, roleDefinitions);
        
        // Cache result
        this.cache.set(cacheKey, {
            result: result,
            timestamp: Date.now()
        });

        return result;
    }

    _checkPermissionInternal(username, permission, userRoles, roleDefinitions) {
        const usernameLower = username.toLowerCase();
        const userRole = userRoles[usernameLower];

        if (!userRole) {
            // User has no specific role, check default role
            return this._checkRolePermission('user', permission, roleDefinitions);
        }

        return this._checkRolePermission(userRole, permission, roleDefinitions);
    }

    _checkRolePermission(role, permission, roleDefinitions) {
        const roleData = roleDefinitions[role];
        if (!roleData) {
            return false;
        }

        const permissions = roleData.permissions || [];
        
        // Check for wildcard permission
        if (permissions.includes('*')) {
            return true;
        }

        // Check for exact permission match
        if (permissions.includes(permission)) {
            return true;
        }

        // Check for wildcard pattern matches
        for (const perm of permissions) {
            if (perm.endsWith('*')) {
                const prefix = perm.slice(0, -1);
                if (permission.startsWith(prefix)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if a user is an admin (backward compatibility)
     * @param {string} username - The username to check
     * @param {object} userRoles - User roles data
     * @param {object} roleDefinitions - Role definitions
     * @returns {boolean} - True if user is admin or higher
     */
    isAdmin(username, userRoles, roleDefinitions) {
        const usernameLower = username.toLowerCase();
        const userRole = userRoles[usernameLower];

        if (!userRole) {
            return false;
        }

        const roleData = roleDefinitions[userRole];
        if (!roleData) {
            return false;
        }

        // Consider admin level and above as admin
        return roleData.level >= 80;
    }

    /**
     * Check if a user has a specific role
     * @param {string} username - The username to check
     * @param {string} role - The role to check
     * @param {object} userRoles - User roles data
     * @returns {boolean} - True if user has the role
     */
    hasRole(username, role, userRoles) {
        const usernameLower = username.toLowerCase();
        const userRole = userRoles[usernameLower];
        return userRole === role;
    }

    /**
     * Get user's role level
     * @param {string} username - The username to check
     * @param {object} userRoles - User roles data
     * @param {object} roleDefinitions - Role definitions
     * @returns {number} - User's role level
     */
    getUserLevel(username, userRoles, roleDefinitions) {
        const usernameLower = username.toLowerCase();
        const userRole = userRoles[usernameLower];

        if (!userRole) {
            return roleDefinitions.user?.level || 0;
        }

        const roleData = roleDefinitions[userRole];
        return roleData?.level || 0;
    }

    /**
     * Get all permissions for a user
     * @param {string} username - The username
     * @param {object} userRoles - User roles data
     * @param {object} roleDefinitions - Role definitions
     * @returns {string[]} - Array of permissions
     */
    getUserPermissions(username, userRoles, roleDefinitions) {
        const usernameLower = username.toLowerCase();
        const userRole = userRoles[usernameLower] || 'user';
        
        const roleData = roleDefinitions[userRole];
        if (!roleData) {
            return [];
        }

        return roleData.permissions || [];
    }

    /**
     * Clear permission cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Clear cache for a specific user
     * @param {string} username - The username
     */
    clearUserCache(username) {
        const usernameLower = username.toLowerCase();
        const keysToDelete = [];
        
        for (const [key] of this.cache) {
            if (key.startsWith(`${usernameLower}:`)) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => this.cache.delete(key));
    }

    /**
     * Clean expired cache entries
     */
    cleanExpiredCache() {
        const now = Date.now();
        const keysToDelete = [];
        
        for (const [key, value] of this.cache) {
            if ((now - value.timestamp) >= this.cacheTtl) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => this.cache.delete(key));
    }
}

export default PermissionChecker;