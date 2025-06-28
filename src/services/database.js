import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { heistSchema } from '../modules/heist/schema.js';

class Database {
    constructor(dbPath, botUsername = 'dazza') {
        this.dbPath = dbPath;
        this.botUsername = botUsername.toLowerCase();
        this.db = null;
        
        // Bind promisified methods after database is initialized
        this.run = null;
        this.get = null;
        this.all = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Failed to open database:', err);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    
                    // Create promisified methods
                    this.get = promisify(this.db.get.bind(this.db));
                    this.all = promisify(this.db.all.bind(this.db));
                    
                    // Custom run method to properly return lastID
                    this.run = (sql, params = []) => {
                        return new Promise((resolve, reject) => {
                            this.db.run(sql, params, function(err) {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve({ lastID: this.lastID, changes: this.changes });
                                }
                            });
                        });
                    };
                    
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        // Create messages table
        await this.run(`
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create user_events table for join/leave tracking
        await this.run(`
            CREATE TABLE IF NOT EXISTS user_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                event_type TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create user_stats table for aggregated stats
        await this.run(`
            CREATE TABLE IF NOT EXISTS user_stats (
                username TEXT PRIMARY KEY,
                first_seen INTEGER NOT NULL,
                last_seen INTEGER NOT NULL,
                message_count INTEGER DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create bong_counter table
        await this.run(`
            CREATE TABLE IF NOT EXISTS bong_counter (
                date TEXT PRIMARY KEY,
                count INTEGER DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create user_bongs table for per-user bong tracking
        await this.run(`
            CREATE TABLE IF NOT EXISTS user_bongs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create reminders table
        await this.run(`
            CREATE TABLE IF NOT EXISTS reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_user TEXT NOT NULL,
                to_user TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                remind_at INTEGER NOT NULL,
                delivered INTEGER DEFAULT 0
            )
        `);

        // Create tells table
        await this.run(`
            CREATE TABLE IF NOT EXISTS tells (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_user TEXT NOT NULL,
                to_user TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                delivered INTEGER DEFAULT 0
            )
        `);

        // Create private_messages table
        await this.run(`
            CREATE TABLE IF NOT EXISTS private_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_user TEXT NOT NULL,
                to_user TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create connection_log table for tracking connection attempts
        await this.run(`
            CREATE TABLE IF NOT EXISTS connection_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                details TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create posted_urls table for tracking URLs
        await this.run(`
            CREATE TABLE IF NOT EXISTS posted_urls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                url TEXT NOT NULL,
                normalized_url TEXT NOT NULL,
                domain TEXT NOT NULL,
                url_type TEXT NOT NULL,
                message_id INTEGER,
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (message_id) REFERENCES messages(id)
            )
        `);

        // Create indexes for better performance
        await this.run('CREATE INDEX IF NOT EXISTS idx_messages_username ON messages(username)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_user_events_username ON user_events(username)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_user_events_timestamp ON user_events(timestamp)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_user_bongs_username ON user_bongs(username)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_user_bongs_timestamp ON user_bongs(timestamp)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_tells_to_user ON tells(to_user)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_posted_urls_username ON posted_urls(username)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_posted_urls_domain ON posted_urls(domain)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_posted_urls_timestamp ON posted_urls(timestamp)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_private_messages_from_user ON private_messages(from_user)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_private_messages_to_user ON private_messages(to_user)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_private_messages_timestamp ON private_messages(timestamp)');

        // Initialize heist schema
        await heistSchema.initialize(this);

        console.log('Database tables created successfully');
    }

    async logMessage(username, message) {
        const timestamp = Date.now();
        
        const result = await this.run(
            'INSERT INTO messages (username, message, timestamp) VALUES (?, ?, ?)',
            [username, message, timestamp]
        );

        // Update user stats
        await this.updateUserStats(username, timestamp);
        
        // Return the message ID for linking URLs
        return result.lastID;
    }

    async logUserEvent(username, eventType) {
        const timestamp = Date.now();
        
        await this.run(
            'INSERT INTO user_events (username, event_type, timestamp) VALUES (?, ?, ?)',
            [username, eventType, timestamp]
        );

        // Update user stats for join events
        if (eventType === 'join') {
            await this.updateUserStats(username, timestamp);
        }
    }

    async updateUserStats(username, timestamp) {
        await this.run(`
            INSERT INTO user_stats (username, first_seen, last_seen, message_count)
            VALUES (?, ?, ?, 1)
            ON CONFLICT(username) DO UPDATE SET
                last_seen = ?,
                message_count = message_count + 1,
                updated_at = CURRENT_TIMESTAMP
        `, [username, timestamp, timestamp, timestamp]);
    }

    async getUserStats(username) {
        const stats = await this.get(
            'SELECT * FROM user_stats WHERE LOWER(username) = LOWER(?)',
            [username]
        );

        if (stats) {
            // Get actual message count from messages table
            const msgCount = await this.get(
                'SELECT COUNT(*) as count FROM messages WHERE LOWER(username) = LOWER(?)',
                [username]
            );
            stats.message_count = msgCount.count;
        }

        return stats;
    }

    async getAllUserStats() {
        return await this.all(`
            SELECT username, first_seen, last_seen, 
                   (SELECT COUNT(*) FROM messages WHERE LOWER(messages.username) = LOWER(user_stats.username)) as message_count
            FROM user_stats
            ORDER BY last_seen DESC
        `);
    }

    async getRecentMessages(limit = 100) {
        return await this.all(
            'SELECT * FROM messages ORDER BY timestamp DESC LIMIT ?',
            [limit]
        );
    }

    async getMessagesSince(timestamp) {
        return await this.all(
            'SELECT * FROM messages WHERE timestamp >= ? ORDER BY timestamp ASC',
            [timestamp]
        );
    }

    async getRandomMessage() {
        // Get a random message that's not a bot command and not from bot or system
        const message = await this.get(`
            SELECT username, message, timestamp 
            FROM messages 
            WHERE message NOT LIKE '!%'
            AND LOWER(username) != ?
            AND LOWER(username) != '[server]'
            AND username NOT LIKE '[%]'
            AND LENGTH(message) > 10
            ORDER BY RANDOM() 
            LIMIT 1
        `, [this.botUsername]);
        
        return message;
    }

    async getUserRandomMessage(username) {
        // Get a random message from specific user that's not a bot command
        const message = await this.get(`
            SELECT username, message, timestamp 
            FROM messages 
            WHERE LOWER(username) = LOWER(?)
            AND message NOT LIKE '!%'
            ORDER BY RANDOM() 
            LIMIT 1
        `, [username]);
        
        return message;
    }

    async getBongCount(date) {
        const result = await this.get(
            'SELECT count FROM bong_counter WHERE date = ?',
            [date]
        );
        
        return result ? result.count : 0;
    }

    async incrementBongCount(date) {
        await this.run(`
            INSERT INTO bong_counter (date, count)
            VALUES (?, 1)
            ON CONFLICT(date) DO UPDATE SET
                count = count + 1,
                updated_at = CURRENT_TIMESTAMP
        `, [date]);
        
        // Return the new count
        return await this.getBongCount(date);
    }

    async logUserBong(username) {
        const timestamp = Date.now();
        
        await this.run(
            'INSERT INTO user_bongs (username, timestamp) VALUES (?, ?)',
            [username, timestamp]
        );
    }

    async getUserBongCount(username) {
        const result = await this.get(
            'SELECT COUNT(*) as count FROM user_bongs WHERE LOWER(username) = LOWER(?)',
            [username]
        );
        
        return result ? result.count : 0;
    }

    async getTopTalkers(limit = 10) {
        return await this.all(`
            SELECT username, COUNT(*) as message_count
            FROM messages
            WHERE LOWER(username) NOT IN (?, '[server]')
            AND username NOT LIKE '[%]'
            GROUP BY LOWER(username)
            ORDER BY message_count DESC
            LIMIT ?
        `, [this.botUsername, limit]);
    }

    async getTopBongUsers(limit = 10) {
        // Get users who used !bong the most from dedicated table
        return await this.all(`
            SELECT username, COUNT(*) as bong_count
            FROM user_bongs
            GROUP BY LOWER(username)
            ORDER BY bong_count DESC
            LIMIT ?
        `, [limit]);
    }

    async getTopQuotedUsers(limit = 10) {
        // Count non-command messages per user
        return await this.all(`
            SELECT username, COUNT(*) as quotable_messages
            FROM messages
            WHERE message NOT LIKE '!%'
            AND LOWER(username) NOT IN (?, '[server]')
            AND username NOT LIKE '[%]'
            GROUP BY LOWER(username)
            ORDER BY quotable_messages DESC
            LIMIT ?
        `, [this.botUsername, limit]);
    }

    async getChannelStats() {
        // Get various channel statistics
        const totalMessages = await this.get('SELECT COUNT(*) as count FROM messages');
        const totalUsers = await this.get('SELECT COUNT(DISTINCT LOWER(username)) as count FROM messages');
        const messagesLast24h = await this.get(
            'SELECT COUNT(*) as count FROM messages WHERE timestamp > ?',
            [Date.now() - 86400000]
        );
        const mostActiveHour = await this.get(`
            SELECT strftime('%H', datetime(timestamp/1000, 'unixepoch')) as hour, COUNT(*) as count
            FROM messages
            GROUP BY hour
            ORDER BY count DESC
            LIMIT 1
        `);
        
        // Get today's bong count
        const today = new Date().toDateString();
        const todayBongs = await this.getBongCount(today);
        
        // Get total bongs all time
        const totalBongs = await this.get('SELECT SUM(count) as total FROM bong_counter');
        
        return {
            totalMessages: totalMessages.count,
            totalUsers: totalUsers.count,
            messagesLast24h: messagesLast24h.count,
            mostActiveHour: mostActiveHour ? parseInt(mostActiveHour.hour) : null,
            todayBongs: todayBongs,
            totalBongs: totalBongs.total || 0
        };
    }

    // Reminder methods
    async addReminder(fromUser, toUser, message, remindAt) {
        const createdAt = Date.now();
        
        await this.run(
            'INSERT INTO reminders (from_user, to_user, message, created_at, remind_at) VALUES (?, ?, ?, ?, ?)',
            [fromUser, toUser, message, createdAt, remindAt]
        );
    }

    async getDueReminders() {
        const now = Date.now();
        return await this.all(
            'SELECT * FROM reminders WHERE remind_at <= ? AND delivered = 0',
            [now]
        );
    }

    async markReminderDelivered(id) {
        await this.run(
            'UPDATE reminders SET delivered = 1 WHERE id = ?',
            [id]
        );
    }

    // Tell methods
    async addTell(fromUser, toUser, message) {
        const createdAt = Date.now();
        
        await this.run(
            'INSERT INTO tells (from_user, to_user, message, created_at) VALUES (?, ?, ?, ?)',
            [fromUser, toUser, message, createdAt]
        );
    }

    async getTellsForUser(username) {
        return await this.all(
            'SELECT * FROM tells WHERE LOWER(to_user) = LOWER(?) AND delivered = 0',
            [username]
        );
    }

    async markTellDelivered(id) {
        await this.run(
            'UPDATE tells SET delivered = 1 WHERE id = ?',
            [id]
        );
    }

    async logUrl(username, urlData, messageId = null) {
        const timestamp = Date.now();
        
        await this.run(`
            INSERT INTO posted_urls (
                username, url, normalized_url, domain, 
                url_type, message_id, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            username,
            urlData.url,
            urlData.normalized,
            urlData.domain,
            urlData.type,
            messageId,
            timestamp
        ]);
    }

    async getRecentUrls(limit = 50) {
        return await this.all(
            'SELECT * FROM posted_urls ORDER BY timestamp DESC LIMIT ?',
            [limit]
        );
    }

    async getUrlsByUser(username, limit = 50) {
        return await this.all(
            'SELECT * FROM posted_urls WHERE LOWER(username) = LOWER(?) ORDER BY timestamp DESC LIMIT ?',
            [username, limit]
        );
    }

    async getUrlsByDomain(domain, limit = 50) {
        return await this.all(
            'SELECT * FROM posted_urls WHERE LOWER(domain) = LOWER(?) ORDER BY timestamp DESC LIMIT ?',
            [domain, limit]
        );
    }

    async getUrlStats() {
        const totalUrls = await this.get('SELECT COUNT(*) as count FROM posted_urls');
        const uniqueDomains = await this.get('SELECT COUNT(DISTINCT domain) as count FROM posted_urls');
        const topDomains = await this.all(`
            SELECT domain, COUNT(*) as count 
            FROM posted_urls 
            GROUP BY domain 
            ORDER BY count DESC 
            LIMIT 10
        `);
        const topPosters = await this.all(`
            SELECT username, COUNT(*) as count 
            FROM posted_urls 
            GROUP BY username 
            ORDER BY count DESC 
            LIMIT 10
        `);
        
        return {
            totalUrls: totalUrls.count,
            uniqueDomains: uniqueDomains.count,
            topDomains,
            topPosters
        };
    }

    async logConnectionEvent(eventType, details = null) {
        await this.run(
            'INSERT INTO connection_log (event_type, timestamp, details) VALUES (?, ?, ?)',
            [eventType, Date.now(), details ? JSON.stringify(details) : null]
        );
    }

    async getLastConnectionTime(eventType = 'connect') {
        const result = await this.get(
            'SELECT timestamp FROM connection_log WHERE event_type = ? ORDER BY timestamp DESC LIMIT 1',
            [eventType]
        );
        return result ? result.timestamp : null;
    }

    async canConnect(minDelayMs = 30000) {
        const lastConnect = await this.getLastConnectionTime('connect');
        if (!lastConnect) return true;
        
        const timeSinceLastConnect = Date.now() - lastConnect;
        return timeSinceLastConnect >= minDelayMs;
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

export default Database;