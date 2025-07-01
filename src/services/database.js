import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { heistSchema } from '../modules/heist/schema.js';
import { videoPayoutSchema } from '../modules/video_payout/schema.js';
import { extractImageUrls } from '../utils/imageDetector.js';
import { cooldownSchema } from '../utils/cooldownSchema.js';
import MigrationRunner from '../migrations/runner.js';

class Database {
    constructor(dbPath, botUsername = 'dazza') {
        this.dbPath = dbPath;
        this.botUsername = botUsername.toLowerCase();
        this.db = null;
        this.bot = null; // Bot reference for WebSocket events
        
        // Bind promisified methods after database is initialized
        this.run = null;
        this.get = null;
        this.all = null;
    }
    
    setBot(bot) {
        this.bot = bot;
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
                    
                    this.createTables()
                        .then(() => this.runMigrations())
                        .then(resolve)
                        .catch(reject);
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

        // Create drink_counter table
        await this.run(`
            CREATE TABLE IF NOT EXISTS drink_counter (
                date TEXT PRIMARY KEY,
                count INTEGER DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create user_drinks table for per-user drink tracking
        await this.run(`
            CREATE TABLE IF NOT EXISTS user_drinks (
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
        await this.run('CREATE INDEX IF NOT EXISTS idx_user_drinks_username ON user_drinks(username)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_user_drinks_timestamp ON user_drinks(timestamp)');
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

        // Initialize video payout schema
        await videoPayoutSchema.initialize(this);

        // Initialize cooldown schema
        await cooldownSchema.initialize(this);

        // Add migration for tells table via_pm column
        try {
            await this.run('ALTER TABLE tells ADD COLUMN via_pm INTEGER DEFAULT 0');
            console.log('Added via_pm column to tells table');
        } catch (error) {
            // Column might already exist, ignore error
            if (!error.message.includes('duplicate column name')) {
                console.error('Error adding via_pm column:', error.message);
            }
        }

        console.log('Database tables created successfully');
    }

    async runMigrations() {
        try {
            const runner = new MigrationRunner(this);
            await runner.runMigrations();
        } catch (error) {
            console.error('Failed to run migrations:', error);
            throw error;
        }
    }

    async logMessage(username, message) {
        const timestamp = Date.now();
        
        const result = await this.run(
            'INSERT INTO messages (username, message, timestamp) VALUES (?, ?, ?)',
            [username, message, timestamp]
        );

        // Update user stats
        await this.updateUserStats(username, timestamp);
        
        // Extract and save any image URLs
        const imageUrls = extractImageUrls(message);
        const restoredImages = [];
        let limitEnforced = false;
        
        for (const url of imageUrls) {
            const imageResult = await this.addUserImage(username, url);
            if (imageResult.restored) {
                restoredImages.push({
                    url,
                    previousReason: imageResult.previousReason
                });
            }
            if (imageResult.limitEnforced) {
                limitEnforced = true;
            }
        }
        
        // Return the message ID and any restored images
        return {
            messageId: result.lastID,
            restoredImages,
            limitEnforced
        };
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
        // Calculate hour in UTC+10 (server is UTC-8, so +18 hours)
        const TIMEZONE_OFFSET = 18 * 60 * 60 * 1000;
        const adjustedTime = new Date(timestamp + TIMEZONE_OFFSET);
        const hour = adjustedTime.getUTCHours();
        
        await this.run(
            'INSERT INTO user_bongs (username, timestamp, hour) VALUES (?, ?, ?)',
            [username, timestamp, hour]
        );
        
        // Update session data
        await this.updateBongSession(username, timestamp);
        
        // Update streak data
        await this.updateBongStreak(username, timestamp);
    }

    async getUserBongCount(username) {
        const result = await this.get(
            'SELECT COUNT(*) as count FROM user_bongs WHERE LOWER(username) = LOWER(?)',
            [username]
        );
        
        return result ? result.count : 0;
    }

    async getDrinkCount(date) {
        const result = await this.get(
            'SELECT count FROM drink_counter WHERE date = ?',
            [date]
        );
        
        return result ? result.count : 0;
    }

    async incrementDrinkCount(date) {
        await this.run(`
            INSERT INTO drink_counter (date, count)
            VALUES (?, 1)
            ON CONFLICT(date) DO UPDATE SET
                count = count + 1,
                updated_at = CURRENT_TIMESTAMP
        `, [date]);
        
        // Return the new count
        return await this.getDrinkCount(date);
    }

    async logUserDrink(username) {
        const timestamp = Date.now();
        
        await this.run(
            'INSERT INTO user_drinks (username, timestamp) VALUES (?, ?)',
            [username, timestamp]
        );
    }

    async getUserDrinkCount(username) {
        const result = await this.get(
            'SELECT COUNT(*) as count FROM user_drinks WHERE LOWER(username) = LOWER(?)',
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

    async getTopDrinkers(limit = 10) {
        // Get users who used !drink the most from dedicated table
        return await this.all(`
            SELECT username, COUNT(*) as drink_count
            FROM user_drinks
            GROUP BY LOWER(username)
            ORDER BY drink_count DESC
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

    async getTopGamblers(limit = 10) {
        // Get biggest single gambling wins from economy transactions with details
        return await this.all(`
            WITH ranked_wins AS (
                SELECT 
                    username,
                    amount as biggest_win,
                    transaction_type,
                    description,
                    ROW_NUMBER() OVER (PARTITION BY LOWER(username) ORDER BY amount DESC) as rn
                FROM economy_transactions
                WHERE transaction_type IN ('pokies', 'scratchie', 'tab')
                AND amount > 0
            )
            SELECT username, biggest_win, transaction_type, description
            FROM ranked_wins
            WHERE rn = 1
            ORDER BY biggest_win DESC
            LIMIT ?
        `, [limit]);
    }

    async getTopFishers(limit = 10) {
        // Get biggest fish catches from economy transactions with fish names
        return await this.all(`
            WITH parsed_catches AS (
                SELECT 
                    username,
                    CAST(SUBSTR(description, 1, INSTR(description, 'kg') - 1) AS REAL) as biggest_catch,
                    SUBSTR(description, INSTR(description, 'kg') + 3) as fish_type,
                    description
                FROM economy_transactions
                WHERE transaction_type = 'fishing'
                AND description LIKE '%kg%'
            ),
            ranked_catches AS (
                SELECT 
                    username,
                    biggest_catch,
                    fish_type,
                    description,
                    ROW_NUMBER() OVER (PARTITION BY LOWER(username) ORDER BY biggest_catch DESC) as rn
                FROM parsed_catches
            )
            SELECT username, biggest_catch, fish_type, description
            FROM ranked_catches
            WHERE rn = 1
            ORDER BY biggest_catch DESC
            LIMIT ?
        `, [limit]);
    }

    async getTopBottleCollectors(limit = 10) {
        // Get top bottle collectors by total earnings and collection count
        return await this.all(`
            SELECT 
                username,
                SUM(amount) as total_earnings,
                COUNT(*) as collection_count,
                AVG(amount) as avg_per_run,
                MAX(amount) as best_haul
            FROM economy_transactions
            WHERE transaction_type = 'bottles'
            AND amount > 0
            GROUP BY LOWER(username)
            ORDER BY total_earnings DESC
            LIMIT ?
        `, [limit]);
    }

    async getTopBeggars(limit = 10) {
        // Get shameless beggars with their stats
        return await this.all(`
            SELECT 
                username,
                COUNT(*) as times_begged,
                SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_received,
                SUM(CASE WHEN amount > 0 THEN 1 ELSE 0 END) as successful_begs,
                CAST(SUM(CASE WHEN amount > 0 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100 as success_rate,
                SUM(CASE WHEN amount < 0 THEN 1 ELSE 0 END) as times_robbed,
                SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_robbed,
                MAX(CASE WHEN amount > 0 THEN amount ELSE 0 END) as biggest_handout
            FROM economy_transactions
            WHERE transaction_type = 'beg'
            GROUP BY LOWER(username)
            ORDER BY times_begged DESC
            LIMIT ?
        `, [limit]);
    }

    async getTopCashieWorkers(limit = 10) {
        // Get top cashie workers by total earnings and job count
        return await this.all(`
            SELECT 
                username,
                SUM(amount) as total_earnings,
                COUNT(*) as job_count,
                AVG(amount) as avg_per_job,
                MAX(amount) as best_job
            FROM economy_transactions
            WHERE transaction_type = 'cashie'
            AND amount > 0
            GROUP BY LOWER(username)
            ORDER BY total_earnings DESC
            LIMIT ?
        `, [limit]);
    }

    async getTopSignSpinners(limit = 10) {
        // Get top sign spinners from the dedicated stats table
        return await this.all(`
            SELECT 
                username,
                total_spins,
                total_earnings,
                best_shift,
                perfect_days,
                cops_called,
                ROUND(CAST(total_earnings AS FLOAT) / NULLIF(total_spins, 0), 2) as avg_per_shift
            FROM sign_spinning_stats
            WHERE total_spins > 0
            ORDER BY total_earnings DESC
            LIMIT ?
        `, [limit]);
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
    async addTell(fromUser, toUser, message, viaPm = false) {
        const createdAt = Date.now();
        
        await this.run(
            'INSERT INTO tells (from_user, to_user, message, created_at, via_pm) VALUES (?, ?, ?, ?, ?)',
            [fromUser, toUser, message, createdAt, viaPm ? 1 : 0]
        );
    }

    async getTellsForUser(username) {
        return await this.all(
            'SELECT *, CASE WHEN via_pm IS NULL THEN 0 ELSE via_pm END as via_pm FROM tells WHERE LOWER(to_user) = LOWER(?) AND delivered = 0',
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
        
        // If it's an image URL, also add to user_images
        if (urlData.type === 'image') {
            await this.addUserImage(username, urlData.url, timestamp);
        }
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

    // Bladder management for pissing contest
    async updateBladder(username, drinkAmount = 1) {
        const timestamp = Date.now();
        
        await this.run(`
            INSERT INTO user_bladder (username, current_amount, last_drink_time, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                current_amount = current_amount + ?,
                last_drink_time = ?,
                updated_at = ?
        `, [username, drinkAmount, timestamp, timestamp, drinkAmount, timestamp, timestamp]);
    }

    async getBladderState(username) {
        const result = await this.get(
            'SELECT current_amount, last_drink_time, last_piss_time FROM user_bladder WHERE LOWER(username) = LOWER(?)',
            [username]
        );
        
        return result || { current_amount: 0, last_drink_time: null, last_piss_time: null };
    }

    async resetBladder(username) {
        const timestamp = Date.now();
        
        await this.run(`
            UPDATE user_bladder
            SET current_amount = 0, last_piss_time = ?, updated_at = ?
            WHERE LOWER(username) = LOWER(?)
        `, [timestamp, timestamp, username]);
    }

    // Pissing contest stats
    async getTopPissers(limit = 10) {
        return await this.all(`
            SELECT 
                username,
                total_matches,
                wins,
                losses,
                money_won,
                money_lost,
                best_distance,
                best_volume,
                best_aim,
                best_duration,
                rarest_characteristic,
                favorite_location,
                CAST(wins AS REAL) / NULLIF(total_matches, 0) * 100 as win_rate
            FROM pissing_contest_stats
            WHERE total_matches > 0
            ORDER BY wins DESC, win_rate DESC
            LIMIT ?
        `, [limit]);
    }

    async getPissingRecords() {
        return await this.all(`
            SELECT * FROM pissing_contest_records
            ORDER BY 
                CASE record_type
                    WHEN 'distance' THEN 1
                    WHEN 'volume' THEN 2
                    WHEN 'aim' THEN 3
                    WHEN 'duration' THEN 4
                    ELSE 5
                END
        `);
    }

    async updatePissingRecord(recordType, username, value, characteristic, location) {
        const timestamp = Date.now();
        
        await this.run(`
            INSERT INTO pissing_contest_records (record_type, username, value, characteristic, location, achieved_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(record_type) DO UPDATE SET
                username = ?,
                value = ?,
                characteristic = ?,
                location = ?,
                achieved_at = ?
            WHERE value < ?
        `, [
            recordType, username, value, characteristic, location, timestamp,
            username, value, characteristic, location, timestamp, value
        ]);
    }

    // User images methods
    async addUserImage(username, url) {
        const timestamp = Date.now();
        const IMAGE_LIMIT = 25;
        
        try {
            // Check if this URL was previously pruned
            const existingImage = await this.get(`
                SELECT username, is_active, pruned_reason
                FROM user_images
                WHERE url = ?
            `, [url]);
            
            if (existingImage && !existingImage.is_active) {
                console.log(`Restoring previously pruned image: ${url} (was: ${existingImage.pruned_reason})`);
            }
            
            // Check if user is at the image limit
            const activeCount = await this.get(`
                SELECT COUNT(*) as count
                FROM user_images
                WHERE username = ? AND is_active = 1
            `, [username]);
            
            // If at or over limit, mark oldest images as pruned
            if (activeCount.count >= IMAGE_LIMIT) {
                const imagesToRemove = activeCount.count - IMAGE_LIMIT + 1; // +1 to make room for new image
                
                await this.run(`
                    UPDATE user_images
                    SET is_active = 0, pruned_reason = 'Gallery limit (25 images)'
                    WHERE username = ? 
                    AND is_active = 1
                    AND url != ?
                    AND id IN (
                        SELECT id FROM user_images
                        WHERE username = ? AND is_active = 1 AND url != ?
                        ORDER BY timestamp ASC
                        LIMIT ?
                    )
                `, [username, url, username, url, imagesToRemove]);
                
                console.log(`Removed ${imagesToRemove} oldest images for ${username} to maintain ${IMAGE_LIMIT} image limit`);
            }
            
            await this.run(`
                INSERT INTO user_images (username, url, timestamp)
                VALUES (?, ?, ?)
                ON CONFLICT(username, url) DO UPDATE SET
                    timestamp = ?,
                    is_active = 1,
                    pruned_reason = NULL
            `, [username, url, timestamp, timestamp]);
            
            // Emit event for real-time updates
            if (this.bot && this.bot.apiServer) {
                this.bot.apiServer.broadcastToTopic('gallery', 'imageAdded', {
                    username,
                    url,
                    timestamp
                });
            }
            
            return { 
                success: true, 
                restored: existingImage && !existingImage.is_active,
                previousReason: existingImage?.pruned_reason,
                limitEnforced: activeCount.count >= IMAGE_LIMIT
            };
        } catch (error) {
            console.error('Error adding user image:', error);
            return { success: false, error: error.message };
        }
    }

    async getUserImages(username = null, activeOnly = true) {
        let query = `
            SELECT username, url, timestamp, is_active, pruned_reason
            FROM user_images
        `;
        const params = [];
        const conditions = [];

        if (username) {
            conditions.push('LOWER(username) = LOWER(?)');
            params.push(username);
        }

        if (activeOnly) {
            conditions.push('is_active = 1');
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY timestamp DESC';

        return await this.all(query, params);
    }

    async getAllUserImagesGrouped(activeOnly = true) {
        const images = await this.getUserImages(null, activeOnly);
        
        const grouped = {};
        for (const image of images) {
            if (!grouped[image.username]) {
                grouped[image.username] = [];
            }
            grouped[image.username].push(image);
        }

        return grouped;
    }

    async pruneUserImage(url, reason) {
        await this.run(`
            UPDATE user_images
            SET is_active = 0, pruned_reason = ?
            WHERE url = ?
        `, [reason, url]);
    }

    async getPrunedImages() {
        return await this.all(`
            SELECT username, url, timestamp, pruned_reason
            FROM user_images
            WHERE is_active = 0
            ORDER BY timestamp DESC
        `);
    }

    // Gallery lock methods
    async setGalleryLock(username, isLocked) {
        const timestamp = isLocked ? Date.now() : null;
        
        await this.run(`
            INSERT INTO user_gallery_locks (username, is_locked, locked_at)
            VALUES (?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                is_locked = ?,
                locked_at = ?
        `, [username, isLocked ? 1 : 0, timestamp, isLocked ? 1 : 0, timestamp]);
    }

    async isGalleryLocked(username) {
        const result = await this.get(`
            SELECT is_locked
            FROM user_gallery_locks
            WHERE LOWER(username) = LOWER(?)
        `, [username]);
        
        return result ? result.is_locked === 1 : false;
    }

    async getLockedGalleries() {
        return await this.all(`
            SELECT username
            FROM user_gallery_locks
            WHERE is_locked = 1
        `);
    }

    async updateBongSession(username, timestamp) {
        const SESSION_GAP = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
        
        // Check if there's an active session (last bong within 2 hours)
        const lastSession = await this.get(`
            SELECT * FROM bong_sessions 
            WHERE LOWER(username) = LOWER(?) 
            ORDER BY session_end DESC 
            LIMIT 1
        `, [username]);
        
        if (lastSession && (timestamp - lastSession.session_end) <= SESSION_GAP) {
            // Update existing session
            const sessionBongs = await this.all(`
                SELECT timestamp FROM user_bongs
                WHERE LOWER(username) = LOWER(?) AND timestamp >= ? AND timestamp <= ?
                ORDER BY timestamp
            `, [username, lastSession.session_start, timestamp]);
            
            const maxRate = this.calculateMaxConesPerHour(sessionBongs.map(b => b.timestamp));
            
            await this.run(`
                UPDATE bong_sessions 
                SET session_end = ?, 
                    cone_count = cone_count + 1,
                    max_cones_per_hour = ?
                WHERE id = ?
            `, [timestamp, maxRate, lastSession.id]);
        } else {
            // Create new session
            await this.run(`
                INSERT INTO bong_sessions (username, session_start, session_end, cone_count, max_cones_per_hour)
                VALUES (?, ?, ?, 1, 1)
            `, [username, timestamp, timestamp]);
        }
    }
    
    calculateMaxConesPerHour(timestamps) {
        if (timestamps.length <= 1) return timestamps.length;
        
        let maxRate = 0;
        const ONE_HOUR = 60 * 60 * 1000;
        
        for (let i = 0; i < timestamps.length; i++) {
            let count = 1;
            const windowEnd = timestamps[i] + ONE_HOUR;
            
            for (let j = i + 1; j < timestamps.length && timestamps[j] <= windowEnd; j++) {
                count++;
            }
            
            maxRate = Math.max(maxRate, count);
        }
        
        return maxRate;
    }
    
    async updateBongStreak(username, timestamp) {
        const TIMEZONE_OFFSET = 18 * 60 * 60 * 1000;
        const today = new Date(timestamp + TIMEZONE_OFFSET).toISOString().split('T')[0];
        
        const streakData = await this.get(
            'SELECT * FROM user_bong_streaks WHERE LOWER(username) = LOWER(?)',
            [username]
        );
        
        if (!streakData) {
            // First bong ever - create streak record
            await this.run(`
                INSERT INTO user_bong_streaks (username, current_streak, longest_streak, last_bong_date, streak_start_date)
                VALUES (?, 1, 1, ?, ?)
            `, [username, today, today]);
        } else {
            const lastBongDate = new Date(streakData.last_bong_date);
            const todayDate = new Date(today);
            const daysDiff = Math.floor((todayDate - lastBongDate) / (1000 * 60 * 60 * 24));
            
            if (daysDiff === 0) {
                // Same day - no streak update needed
                return;
            } else if (daysDiff === 1) {
                // Consecutive day - increase streak
                const newStreak = streakData.current_streak + 1;
                const longestStreak = Math.max(newStreak, streakData.longest_streak);
                
                await this.run(`
                    UPDATE user_bong_streaks 
                    SET current_streak = ?, 
                        longest_streak = ?, 
                        last_bong_date = ?
                    WHERE username = ?
                `, [newStreak, longestStreak, today, username]);
            } else {
                // Streak broken - reset to 1
                await this.run(`
                    UPDATE user_bong_streaks 
                    SET current_streak = 1, 
                        last_bong_date = ?,
                        streak_start_date = ?
                    WHERE username = ?
                `, [today, today, username]);
            }
        }
    }

    async cleanup() {
        try {
            // Rollback any pending transactions
            await this.run('ROLLBACK').catch(() => {
                // Ignore error if no transaction is active
            });
            
            // Force a checkpoint to ensure all changes are written to disk
            await this.run('PRAGMA wal_checkpoint(TRUNCATE)').catch(() => {
                // Ignore error if WAL mode is not enabled
            });
        } catch (error) {
            // Log but don't throw - cleanup should be best effort
            console.warn('Database cleanup warning:', error.message);
        }
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

export default Database;