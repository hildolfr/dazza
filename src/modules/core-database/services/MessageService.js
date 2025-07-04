class MessageService {
    constructor(db, module) {
        this.db = db;
        this.module = module;
        this.logger = module.logger;
    }
    
    async init() {
        // Any initialization logic
    }
    
    // ===== Message Storage =====
    
    async saveMessage(username, message, timestamp = Date.now()) {
        try {
            await this.db.run(
                `INSERT INTO messages (username, message, timestamp) 
                 VALUES (?, ?, ?)`,
                [username, message, timestamp]
            );
            
            // Update user stats
            await this.updateUserMessageCount(username);
            
        } catch (error) {
            this.logger.error('Failed to save message:', error);
            throw error;
        }
    }
    
    async updateUserMessageCount(username) {
        await this.db.run(
            `UPDATE user_stats 
             SET message_count = message_count + 1,
                 last_seen = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE username = ?`,
            [Date.now(), username]
        );
    }
    
    // ===== Message Retrieval =====
    
    async getMessages(options = {}) {
        const {
            username,
            limit = 100,
            offset = 0,
            startTime,
            endTime,
            search
        } = options;
        
        let query = 'SELECT * FROM messages WHERE 1=1';
        const params = [];
        
        if (username) {
            query += ' AND username = ?';
            params.push(username);
        }
        
        if (startTime) {
            query += ' AND timestamp >= ?';
            params.push(startTime);
        }
        
        if (endTime) {
            query += ' AND timestamp <= ?';
            params.push(endTime);
        }
        
        if (search) {
            query += ' AND message LIKE ?';
            params.push(`%${search}%`);
        }
        
        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        
        return await this.db.all(query, params);
    }
    
    async getMessageCount(username = null) {
        if (username) {
            const result = await this.db.get(
                'SELECT COUNT(*) as count FROM messages WHERE username = ?',
                [username]
            );
            return result.count;
        } else {
            const result = await this.db.get(
                'SELECT COUNT(*) as count FROM messages'
            );
            return result.count;
        }
    }
    
    async getRecentMessages(minutes = 5) {
        const since = Date.now() - (minutes * 60 * 1000);
        
        return await this.db.all(
            `SELECT * FROM messages 
             WHERE timestamp > ? 
             ORDER BY timestamp DESC`,
            [since]
        );
    }
    
    // ===== Statistics =====
    
    async getTopChatters(limit = 10, days = 30) {
        const since = Date.now() - (days * 24 * 60 * 60 * 1000);
        
        return await this.db.all(
            `SELECT username, COUNT(*) as message_count
             FROM messages
             WHERE timestamp > ?
             GROUP BY username
             ORDER BY message_count DESC
             LIMIT ?`,
            [since, limit]
        );
    }
    
    async getChatActivity(days = 7) {
        const since = Date.now() - (days * 24 * 60 * 60 * 1000);
        
        return await this.db.all(
            `SELECT 
                date(timestamp/1000, 'unixepoch') as date,
                COUNT(*) as message_count,
                COUNT(DISTINCT username) as unique_users
             FROM messages
             WHERE timestamp > ?
             GROUP BY date
             ORDER BY date DESC`,
            [since]
        );
    }
    
    async getHourlyActivity() {
        return await this.db.all(
            `SELECT 
                strftime('%H', timestamp/1000, 'unixepoch') as hour,
                COUNT(*) as message_count
             FROM messages
             WHERE timestamp > ?
             GROUP BY hour
             ORDER BY hour`,
            [Date.now() - (7 * 24 * 60 * 60 * 1000)]
        );
    }
    
    // ===== Search =====
    
    async searchMessages(searchTerm, options = {}) {
        const { limit = 50, username } = options;
        
        let query = `
            SELECT * FROM messages 
            WHERE message LIKE ?
        `;
        const params = [`%${searchTerm}%`];
        
        if (username) {
            query += ' AND username = ?';
            params.push(username);
        }
        
        query += ' ORDER BY timestamp DESC LIMIT ?';
        params.push(limit);
        
        return await this.db.all(query, params);
    }
    
    // ===== Maintenance =====
    
    async pruneOldMessages(days = 30) {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        
        const result = await this.db.run(
            'DELETE FROM messages WHERE timestamp < ?',
            [cutoff]
        );
        
        return result.changes;
    }
}

module.exports = MessageService;