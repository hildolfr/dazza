class MessageService {
    constructor(db, logger) {
        this.db = db;
        this.logger = logger;
    }

    async init() {
        // Ensure messages table exists
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                room TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes
        await this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_messages_username ON messages(username);
            CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
            CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room);
        `);
    }

    async saveMessage(username, message, timestamp = Date.now(), room = null) {
        try {
            const result = await this.db.run(
                'INSERT INTO messages (username, message, timestamp, room) VALUES (?, ?, ?, ?)',
                [username, message, timestamp, room]
            );
            return { success: true, id: result.lastID };
        } catch (error) {
            this.logger.error('Failed to save message:', error);
            return { success: false, error: error.message };
        }
    }

    async getMessages(options = {}) {
        const {
            username = null,
            room = null,
            limit = 100,
            offset = 0,
            startTime = null,
            endTime = null,
            search = null
        } = options;

        let query = 'SELECT * FROM messages WHERE 1=1';
        const params = [];

        if (username) {
            query += ' AND username = ?';
            params.push(username);
        }

        if (room) {
            query += ' AND room = ?';
            params.push(room);
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

    async getMessageCount(username = null, room = null) {
        let query = 'SELECT COUNT(*) as count FROM messages WHERE 1=1';
        const params = [];

        if (username) {
            query += ' AND username = ?';
            params.push(username);
        }

        if (room) {
            query += ' AND room = ?';
            params.push(room);
        }

        const result = await this.db.get(query, params);
        return result.count;
    }

    async getRecentMessages(minutes = 5, room = null) {
        const since = Date.now() - (minutes * 60 * 1000);
        
        let query = 'SELECT * FROM messages WHERE timestamp > ?';
        const params = [since];

        if (room) {
            query += ' AND room = ?';
            params.push(room);
        }

        query += ' ORDER BY timestamp DESC';

        return await this.db.all(query, params);
    }

    async searchMessages(searchTerm, options = {}) {
        const { username = null, room = null, limit = 100 } = options;

        let query = `
            SELECT * FROM messages 
            WHERE message LIKE ?
        `;
        const params = [`%${searchTerm}%`];

        if (username) {
            query += ' AND username = ?';
            params.push(username);
        }

        if (room) {
            query += ' AND room = ?';
            params.push(room);
        }

        query += ' ORDER BY timestamp DESC LIMIT ?';
        params.push(limit);

        return await this.db.all(query, params);
    }

    async getTopChatters(days = 30, room = null, limit = 10) {
        const since = Date.now() - (days * 24 * 60 * 60 * 1000);

        let query = `
            SELECT username, COUNT(*) as message_count
            FROM messages
            WHERE timestamp > ?
        `;
        const params = [since];

        if (room) {
            query += ' AND room = ?';
            params.push(room);
        }

        query += `
            GROUP BY username
            ORDER BY message_count DESC
            LIMIT ?
        `;
        params.push(limit);

        return await this.db.all(query, params);
    }

    async pruneOldMessages(days = 90) {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        
        const result = await this.db.run(
            'DELETE FROM messages WHERE timestamp < ?',
            [cutoff]
        );

        this.logger.info(`Pruned ${result.changes} old messages`);
        return result.changes;
    }
}

module.exports = MessageService;