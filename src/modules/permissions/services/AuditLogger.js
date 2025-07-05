class AuditLogger {
    constructor(database, logger = null, enabled = true) {
        this.db = database;
        this.logger = logger || console;
        this.enabled = enabled;
        this.initialized = false;
    }

    async init() {
        if (this.initialized || !this.enabled) {
            return;
        }

        try {
            await this.createAuditTable();
            this.initialized = true;
            this.logger.debug('AuditLogger initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize AuditLogger:', error);
            throw error;
        }
    }

    async createAuditTable() {
        const query = `
            CREATE TABLE IF NOT EXISTS permission_audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                action TEXT NOT NULL,
                permission TEXT,
                role TEXT,
                old_value TEXT,
                new_value TEXT,
                actor TEXT,
                result TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        await this.db.run(query);
        
        // Create indexes for better performance
        await this.db.run('CREATE INDEX IF NOT EXISTS idx_permission_audit_username ON permission_audit(username)');
        await this.db.run('CREATE INDEX IF NOT EXISTS idx_permission_audit_timestamp ON permission_audit(timestamp)');
        await this.db.run('CREATE INDEX IF NOT EXISTS idx_permission_audit_action ON permission_audit(action)');
        
        this.logger.debug('Permission audit table created/verified');
    }

    async logPermissionCheck(username, permission, result, actor = null) {
        if (!this.enabled || !this.initialized) {
            return;
        }

        try {
            const query = `
                INSERT INTO permission_audit (username, action, permission, result, actor, timestamp)
                VALUES (?, 'check', ?, ?, ?, ?)
            `;
            
            await this.db.run(query, [
                username.toLowerCase(),
                permission,
                result ? 'granted' : 'denied',
                actor,
                Date.now()
            ]);
        } catch (error) {
            this.logger.error('Failed to log permission check:', error);
        }
    }

    async logRoleChange(username, oldRole, newRole, actor = 'system') {
        if (!this.enabled || !this.initialized) {
            return;
        }

        try {
            const query = `
                INSERT INTO permission_audit (username, action, role, old_value, new_value, actor, result, timestamp)
                VALUES (?, 'role_change', ?, ?, ?, ?, 'success', ?)
            `;
            
            await this.db.run(query, [
                username.toLowerCase(),
                newRole,
                oldRole || 'none',
                newRole,
                actor,
                Date.now()
            ]);
            
            this.logger.info(`Role change audit: ${username} ${oldRole || 'none'} → ${newRole} by ${actor}`);
        } catch (error) {
            this.logger.error('Failed to log role change:', error);
        }
    }

    async logPermissionGrant(username, permission, actor = 'system') {
        if (!this.enabled || !this.initialized) {
            return;
        }

        try {
            const query = `
                INSERT INTO permission_audit (username, action, permission, actor, result, timestamp)
                VALUES (?, 'grant', ?, ?, 'success', ?)
            `;
            
            await this.db.run(query, [
                username.toLowerCase(),
                permission,
                actor,
                Date.now()
            ]);
            
            this.logger.info(`Permission granted: ${username} → ${permission} by ${actor}`);
        } catch (error) {
            this.logger.error('Failed to log permission grant:', error);
        }
    }

    async logPermissionRevoke(username, permission, actor = 'system') {
        if (!this.enabled || !this.initialized) {
            return;
        }

        try {
            const query = `
                INSERT INTO permission_audit (username, action, permission, actor, result, timestamp)
                VALUES (?, 'revoke', ?, ?, 'success', ?)
            `;
            
            await this.db.run(query, [
                username.toLowerCase(),
                permission,
                actor,
                Date.now()
            ]);
            
            this.logger.info(`Permission revoked: ${username} → ${permission} by ${actor}`);
        } catch (error) {
            this.logger.error('Failed to log permission revoke:', error);
        }
    }

    async logFailedAction(username, action, reason, actor = null) {
        if (!this.enabled || !this.initialized) {
            return;
        }

        try {
            const query = `
                INSERT INTO permission_audit (username, action, result, actor, old_value, timestamp)
                VALUES (?, ?, 'failed', ?, ?, ?)
            `;
            
            await this.db.run(query, [
                username.toLowerCase(),
                action,
                actor,
                reason,
                Date.now()
            ]);
            
            this.logger.warn(`Failed permission action: ${username} → ${action} (${reason}) by ${actor}`);
        } catch (error) {
            this.logger.error('Failed to log failed action:', error);
        }
    }

    async getUserAuditLog(username, limit = 100) {
        if (!this.enabled || !this.initialized) {
            return [];
        }

        try {
            const query = `
                SELECT * FROM permission_audit 
                WHERE username = ? 
                ORDER BY timestamp DESC 
                LIMIT ?
            `;
            
            const rows = await this.db.all(query, [username.toLowerCase(), limit]);
            return rows;
        } catch (error) {
            this.logger.error('Failed to get user audit log:', error);
            return [];
        }
    }

    async getAuditLogByAction(action, limit = 100) {
        if (!this.enabled || !this.initialized) {
            return [];
        }

        try {
            const query = `
                SELECT * FROM permission_audit 
                WHERE action = ? 
                ORDER BY timestamp DESC 
                LIMIT ?
            `;
            
            const rows = await this.db.all(query, [action, limit]);
            return rows;
        } catch (error) {
            this.logger.error('Failed to get audit log by action:', error);
            return [];
        }
    }

    async getRecentAuditLog(limit = 100) {
        if (!this.enabled || !this.initialized) {
            return [];
        }

        try {
            const query = `
                SELECT * FROM permission_audit 
                ORDER BY timestamp DESC 
                LIMIT ?
            `;
            
            const rows = await this.db.all(query, [limit]);
            return rows;
        } catch (error) {
            this.logger.error('Failed to get recent audit log:', error);
            return [];
        }
    }

    async getAuditStats() {
        if (!this.enabled || !this.initialized) {
            return {};
        }

        try {
            const queries = [
                'SELECT COUNT(*) as total FROM permission_audit',
                'SELECT COUNT(*) as checks FROM permission_audit WHERE action = "check"',
                'SELECT COUNT(*) as role_changes FROM permission_audit WHERE action = "role_change"',
                'SELECT COUNT(*) as grants FROM permission_audit WHERE action = "grant"',
                'SELECT COUNT(*) as revokes FROM permission_audit WHERE action = "revoke"',
                'SELECT COUNT(*) as failed FROM permission_audit WHERE result = "failed"'
            ];
            
            const results = await Promise.all(queries.map(query => this.db.get(query)));
            
            return {
                total: results[0].total,
                checks: results[1].checks,
                roleChanges: results[2].role_changes,
                grants: results[3].grants,
                revokes: results[4].revokes,
                failed: results[5].failed
            };
        } catch (error) {
            this.logger.error('Failed to get audit stats:', error);
            return {};
        }
    }

    async cleanupOldAuditLogs(olderThanDays = 90) {
        if (!this.enabled || !this.initialized) {
            return 0;
        }

        try {
            const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
            const query = 'DELETE FROM permission_audit WHERE timestamp < ?';
            const result = await this.db.run(query, [cutoffTime]);
            
            if (result.changes > 0) {
                this.logger.info(`Cleaned up ${result.changes} old audit log entries`);
            }
            
            return result.changes;
        } catch (error) {
            this.logger.error('Failed to cleanup old audit logs:', error);
            return 0;
        }
    }

    setEnabled(enabled) {
        this.enabled = enabled;
    }

    isEnabled() {
        return this.enabled;
    }
}

export default AuditLogger;