import BaseModule from '../../core/BaseModule.js';
import PermissionChecker from './services/PermissionChecker.js';
import RoleManager from './services/RoleManager.js';
import AuditLogger from './services/AuditLogger.js';

class PermissionsModule extends BaseModule {
    constructor(context) {
        super(context);
        this.permissionChecker = null;
        this.roleManager = null;
        this.auditLogger = null;
        this.config = {
            defaultAdmins: ["ilovechinks", "hildolfr", "Spazztik"],
            roles: {
                owner: {
                    level: 100,
                    permissions: ["*"]
                },
                admin: {
                    level: 80,
                    permissions: ["admin.*", "command.*", "bot.*"]
                },
                moderator: {
                    level: 60,
                    permissions: ["moderation.*", "command.basic.*"]
                },
                user: {
                    level: 20,
                    permissions: ["command.basic.*"]
                }
            },
            auditEnabled: true,
            cacheTtl: 300000,
            defaultRole: "user",
            ...context.userConfig
        };
    }

    async init() {
        await super.init();
        
        // Initialize services
        this.permissionChecker = new PermissionChecker(this.logger);
        this.permissionChecker.cacheTtl = this.config.cacheTtl;
        
        this.roleManager = new RoleManager(this.db, this.logger);
        await this.roleManager.init();
        
        this.auditLogger = new AuditLogger(
            this.db, 
            this.logger, 
            this.config.auditEnabled
        );
        await this.auditLogger.init();
        
        // Set up role definitions
        this.roleManager.setRoleDefinitions(this.config.roles);
        
        // Initialize default admins
        await this.roleManager.initializeDefaultAdmins(this.config.defaultAdmins);
        
        // Set up cache cleanup interval
        this.cacheCleanupInterval = setInterval(() => {
            this.permissionChecker.cleanExpiredCache();
        }, 60000); // Clean every minute
        
        this.logger.info('Permissions module initialized');
    }

    async start() {
        await super.start();
        
        // Register permissions service for other modules to use
        this.eventBus.emit('service:register', { 
            name: 'permissions', 
            service: {
                isAdmin: this.isAdmin.bind(this),
                checkPermission: this.checkPermission.bind(this),
                setUserRole: this.setUserRole.bind(this),
                removeUserRole: this.removeUserRole.bind(this),
                getUserRole: this.getUserRole.bind(this),
                getUserLevel: this.getUserLevel.bind(this),
                getUserPermissions: this.getUserPermissions.bind(this),
                hasRole: this.hasRole.bind(this),
                getUsersWithRole: this.getUsersWithRole.bind(this),
                getRoleDefinitions: this.getRoleDefinitions.bind(this),
                getRoleHierarchy: this.getRoleHierarchy.bind(this),
                canGrantRole: this.canGrantRole.bind(this),
                getUserAuditLog: this.getUserAuditLog.bind(this),
                getRecentAuditLog: this.getRecentAuditLog.bind(this),
                getAuditStats: this.getAuditStats.bind(this)
            }
        });
        
        // Provide permission checking capabilities via events (legacy)
        this.eventBus.on('permissions.check', this.checkPermission.bind(this));
        this.eventBus.on('permissions.grant', this.grantPermission.bind(this));
        this.eventBus.on('permissions.revoke', this.revokePermission.bind(this));
        this.eventBus.on('permissions.setRole', this.setUserRole.bind(this));
        this.eventBus.on('permissions.isAdmin', this.isAdmin.bind(this));
        
        // Subscribe to user events for audit logging
        this.subscribe('user.join', this.handleUserJoin.bind(this));
        this.subscribe('user.leave', this.handleUserLeave.bind(this));
        
        this.logger.info('Permissions module started');
    }

    async stop() {
        await super.stop();
        
        // Clear cache cleanup interval
        if (this.cacheCleanupInterval) {
            clearInterval(this.cacheCleanupInterval);
        }
        
        // Clean up services
        if (this.permissionChecker) {
            this.permissionChecker.clearCache();
        }
        
        if (this.roleManager) {
            await this.roleManager.cleanup();
        }
        
        this.logger.info('Permissions module stopped');
    }

    // Public API Methods

    /**
     * Check if a user has a specific permission
     * @param {string} username - The username to check
     * @param {string} permission - The permission to check
     * @param {string} actor - Who is performing the check (optional)
     * @returns {boolean} - True if user has permission
     */
    async checkPermission(username, permission, actor = null) {
        try {
            const userRoles = this.roleManager.getUserRoles();
            const roleDefinitions = this.roleManager.getRoleDefinitions();
            
            const hasPermission = this.permissionChecker.checkPermission(
                username, 
                permission, 
                userRoles, 
                roleDefinitions
            );
            
            // Log the permission check
            await this.auditLogger.logPermissionCheck(username, permission, hasPermission, actor);
            
            // Emit event
            this.emit('permissions.checked', {
                username: username,
                permission: permission,
                result: hasPermission,
                actor: actor
            });
            
            return hasPermission;
        } catch (error) {
            this.logger.error('Error checking permission:', error);
            return false;
        }
    }

    /**
     * Check if a user is an admin (backward compatibility)
     * @param {string} username - The username to check
     * @returns {boolean} - True if user is admin or higher
     */
    async isAdmin(username) {
        try {
            const userRoles = this.roleManager.getUserRoles();
            const roleDefinitions = this.roleManager.getRoleDefinitions();
            
            return this.permissionChecker.isAdmin(username, userRoles, roleDefinitions);
        } catch (error) {
            this.logger.error('Error checking admin status:', error);
            return false;
        }
    }

    /**
     * Set a user's role
     * @param {string} username - The username
     * @param {string} role - The role to set
     * @param {string} grantedBy - Who granted the role
     * @returns {boolean} - True if successful
     */
    async setUserRole(username, role, grantedBy = 'system') {
        try {
            const oldRole = this.roleManager.getUserRole(username);
            const success = await this.roleManager.setUserRole(username, role, grantedBy);
            
            if (success) {
                // Clear user's permission cache
                this.permissionChecker.clearUserCache(username);
                
                // Log the role change
                await this.auditLogger.logRoleChange(username, oldRole, role, grantedBy);
                
                // Emit event
                this.emit('permissions.granted', {
                    username: username,
                    role: role,
                    oldRole: oldRole,
                    grantedBy: grantedBy
                });
                
                return true;
            }
            
            return false;
        } catch (error) {
            this.logger.error('Error setting user role:', error);
            await this.auditLogger.logFailedAction(username, 'set_role', error.message, grantedBy);
            return false;
        }
    }

    /**
     * Remove a user's role
     * @param {string} username - The username
     * @param {string} removedBy - Who removed the role
     * @returns {boolean} - True if successful
     */
    async removeUserRole(username, removedBy = 'system') {
        try {
            const oldRole = this.roleManager.getUserRole(username);
            const success = await this.roleManager.removeUserRole(username, removedBy);
            
            if (success) {
                // Clear user's permission cache
                this.permissionChecker.clearUserCache(username);
                
                // Log the role change
                await this.auditLogger.logRoleChange(username, oldRole, 'user', removedBy);
                
                // Emit event
                this.emit('permissions.revoked', {
                    username: username,
                    oldRole: oldRole,
                    removedBy: removedBy
                });
                
                return true;
            }
            
            return false;
        } catch (error) {
            this.logger.error('Error removing user role:', error);
            await this.auditLogger.logFailedAction(username, 'remove_role', error.message, removedBy);
            return false;
        }
    }

    /**
     * Get a user's role
     * @param {string} username - The username
     * @returns {string} - The user's role
     */
    getUserRole(username) {
        return this.roleManager.getUserRole(username);
    }

    /**
     * Get a user's permission level
     * @param {string} username - The username
     * @returns {number} - The user's permission level
     */
    getUserLevel(username) {
        const userRoles = this.roleManager.getUserRoles();
        const roleDefinitions = this.roleManager.getRoleDefinitions();
        
        return this.permissionChecker.getUserLevel(username, userRoles, roleDefinitions);
    }

    /**
     * Get all permissions for a user
     * @param {string} username - The username
     * @returns {string[]} - Array of permissions
     */
    getUserPermissions(username) {
        const userRoles = this.roleManager.getUserRoles();
        const roleDefinitions = this.roleManager.getRoleDefinitions();
        
        return this.permissionChecker.getUserPermissions(username, userRoles, roleDefinitions);
    }

    /**
     * Check if a user has a specific role
     * @param {string} username - The username
     * @param {string} role - The role to check
     * @returns {boolean} - True if user has the role
     */
    hasRole(username, role) {
        const userRoles = this.roleManager.getUserRoles();
        return this.permissionChecker.hasRole(username, role, userRoles);
    }

    /**
     * Get all users with a specific role
     * @param {string} role - The role to search for
     * @returns {string[]} - Array of usernames
     */
    async getUsersWithRole(role) {
        return await this.roleManager.getUsersWithRole(role);
    }

    /**
     * Get all role definitions
     * @returns {object} - Role definitions
     */
    getRoleDefinitions() {
        return this.roleManager.getRoleDefinitions();
    }

    /**
     * Get role hierarchy sorted by level
     * @returns {Array} - Array of [roleName, roleData] sorted by level
     */
    getRoleHierarchy() {
        return this.roleManager.getRoleHierarchy();
    }

    /**
     * Check if a user can grant a specific role
     * @param {string} granter - The user granting the role
     * @param {string} targetRole - The role to grant
     * @returns {boolean} - True if can grant
     */
    canGrantRole(granter, targetRole) {
        const granterRole = this.roleManager.getUserRole(granter);
        return this.roleManager.canGrantRole(granterRole, targetRole);
    }

    /**
     * Get audit log for a user
     * @param {string} username - The username
     * @param {number} limit - Maximum number of entries
     * @returns {Array} - Audit log entries
     */
    async getUserAuditLog(username, limit = 100) {
        return await this.auditLogger.getUserAuditLog(username, limit);
    }

    /**
     * Get recent audit log
     * @param {number} limit - Maximum number of entries
     * @returns {Array} - Audit log entries
     */
    async getRecentAuditLog(limit = 100) {
        return await this.auditLogger.getRecentAuditLog(limit);
    }

    /**
     * Get audit statistics
     * @returns {object} - Audit statistics
     */
    async getAuditStats() {
        return await this.auditLogger.getAuditStats();
    }

    // Event handlers

    async handleUserJoin(data) {
        const { username } = data;
        // Log user join for audit purposes
        await this.auditLogger.logFailedAction(username, 'join', 'user_joined', null);
    }

    async handleUserLeave(data) {
        const { username } = data;
        // Log user leave for audit purposes
        await this.auditLogger.logFailedAction(username, 'leave', 'user_left', null);
    }

    // Legacy compatibility methods

    /**
     * Legacy method for backward compatibility
     * @param {string} username - The username to check
     * @returns {boolean} - True if user is admin
     */
    async isAdminLegacy(username) {
        return await this.isAdmin(username);
    }

    /**
     * Get admin list for backward compatibility
     * @returns {string[]} - Array of admin usernames
     */
    async getAdmins() {
        return await this.getUsersWithRole('admin');
    }

    /**
     * Grant permission (alias for setUserRole)
     * @param {string} username - The username
     * @param {string} role - The role to grant
     * @param {string} grantedBy - Who granted the role
     * @returns {boolean} - True if successful
     */
    async grantPermission(username, role, grantedBy = 'system') {
        return await this.setUserRole(username, role, grantedBy);
    }

    /**
     * Revoke permission (alias for removeUserRole)
     * @param {string} username - The username
     * @param {string} removedBy - Who removed the role
     * @returns {boolean} - True if successful
     */
    async revokePermission(username, removedBy = 'system') {
        return await this.removeUserRole(username, removedBy);
    }
}

export default PermissionsModule;