class RoleManager {
    constructor(database, logger = null) {
        this.db = database;
        this.logger = logger || console;
        this.userRoles = new Map();
        this.roleDefinitions = new Map();
        this.initialized = false;
    }

    async init() {
        if (this.initialized) {
            return;
        }

        try {
            // Create permissions table if it doesn't exist
            await this.createPermissionsTable();
            
            // Load existing roles from database
            await this.loadUserRoles();
            
            this.initialized = true;
            this.logger.info('RoleManager initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize RoleManager:', error);
            throw error;
        }
    }

    async createPermissionsTable() {
        const query = `
            CREATE TABLE IF NOT EXISTS user_permissions (
                username TEXT PRIMARY KEY,
                role TEXT NOT NULL DEFAULT 'user',
                granted_by TEXT,
                granted_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        await this.db.run(query);
        
        // Create index for faster lookups
        await this.db.run('CREATE INDEX IF NOT EXISTS idx_user_permissions_role ON user_permissions(role)');
        
        this.logger.debug('Permissions table created/verified');
    }

    async loadUserRoles() {
        try {
            const query = 'SELECT username, role FROM user_permissions';
            const rows = await this.db.all(query);
            
            this.userRoles.clear();
            
            for (const row of rows) {
                this.userRoles.set(row.username.toLowerCase(), row.role);
            }
            
            this.logger.debug(`Loaded ${rows.length} user roles from database`);
        } catch (error) {
            this.logger.error('Failed to load user roles:', error);
            throw error;
        }
    }

    setRoleDefinitions(roleDefinitions) {
        this.roleDefinitions.clear();
        for (const [roleName, roleData] of Object.entries(roleDefinitions)) {
            this.roleDefinitions.set(roleName, roleData);
        }
    }

    getRoleDefinitions() {
        return Object.fromEntries(this.roleDefinitions);
    }

    getUserRoles() {
        return Object.fromEntries(this.userRoles);
    }

    async setUserRole(username, role, grantedBy = 'system') {
        const usernameLower = username.toLowerCase();
        
        // Validate role exists
        if (!this.roleDefinitions.has(role)) {
            throw new Error(`Role '${role}' does not exist`);
        }

        const now = Date.now();
        
        try {
            // Check if user already has a role
            const existingRole = this.userRoles.get(usernameLower);
            
            if (existingRole) {
                // Update existing role
                const query = `
                    UPDATE user_permissions 
                    SET role = ?, granted_by = ?, updated_at = ?
                    WHERE username = ?
                `;
                await this.db.run(query, [role, grantedBy, now, usernameLower]);
            } else {
                // Insert new role
                const query = `
                    INSERT INTO user_permissions (username, role, granted_by, granted_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                `;
                await this.db.run(query, [usernameLower, role, grantedBy, now, now]);
            }
            
            // Update in-memory cache
            this.userRoles.set(usernameLower, role);
            
            this.logger.info(`Set role '${role}' for user '${username}' (granted by: ${grantedBy})`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to set role for user ${username}:`, error);
            throw error;
        }
    }

    async removeUserRole(username, removedBy = 'system') {
        const usernameLower = username.toLowerCase();
        
        try {
            const query = 'DELETE FROM user_permissions WHERE username = ?';
            const result = await this.db.run(query, [usernameLower]);
            
            if (result.changes > 0) {
                // Remove from in-memory cache
                this.userRoles.delete(usernameLower);
                
                this.logger.info(`Removed role for user '${username}' (removed by: ${removedBy})`);
                return true;
            }
            
            return false;
        } catch (error) {
            this.logger.error(`Failed to remove role for user ${username}:`, error);
            throw error;
        }
    }

    getUserRole(username) {
        const usernameLower = username.toLowerCase();
        return this.userRoles.get(usernameLower) || 'user';
    }

    async initializeDefaultAdmins(defaultAdmins) {
        if (!Array.isArray(defaultAdmins)) {
            return;
        }

        try {
            for (const admin of defaultAdmins) {
                const currentRole = this.getUserRole(admin);
                
                // Only set admin role if user doesn't have a higher role
                if (currentRole === 'user') {
                    await this.setUserRole(admin, 'admin', 'system');
                    this.logger.info(`Initialized default admin: ${admin}`);
                }
            }
        } catch (error) {
            this.logger.error('Failed to initialize default admins:', error);
        }
    }

    async getUsersWithRole(role) {
        try {
            const query = 'SELECT username FROM user_permissions WHERE role = ?';
            const rows = await this.db.all(query, [role]);
            return rows.map(row => row.username);
        } catch (error) {
            this.logger.error(`Failed to get users with role ${role}:`, error);
            return [];
        }
    }

    async getAllUserPermissions() {
        try {
            const query = `
                SELECT username, role, granted_by, granted_at, updated_at 
                FROM user_permissions 
                ORDER BY updated_at DESC
            `;
            const rows = await this.db.all(query);
            return rows;
        } catch (error) {
            this.logger.error('Failed to get all user permissions:', error);
            return [];
        }
    }

    getRoleHierarchy() {
        const roles = Array.from(this.roleDefinitions.entries());
        return roles.sort((a, b) => (b[1].level || 0) - (a[1].level || 0));
    }

    canGrantRole(granterRole, targetRole) {
        const granterData = this.roleDefinitions.get(granterRole);
        const targetData = this.roleDefinitions.get(targetRole);
        
        if (!granterData || !targetData) {
            return false;
        }
        
        // Can only grant roles with lower level than your own
        return granterData.level > targetData.level;
    }

    async cleanup() {
        if (this.userRoles) {
            this.userRoles.clear();
        }
        if (this.roleDefinitions) {
            this.roleDefinitions.clear();
        }
        this.initialized = false;
    }
}

module.exports = RoleManager;