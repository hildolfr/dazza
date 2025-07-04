class UserService {
    constructor(db, logger) {
        this.db = db;
        this.logger = logger;
    }

    async init() {
        // Create user tables
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS user_stats (
                username TEXT PRIMARY KEY,
                first_seen INTEGER NOT NULL,
                last_seen INTEGER NOT NULL,
                message_count INTEGER DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS user_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                event_type TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                room TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS user_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                url TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                is_active INTEGER DEFAULT 1,
                pruned_reason TEXT,
                failure_count INTEGER DEFAULT 0,
                first_failure_at INTEGER,
                last_check_at INTEGER,
                next_check_at INTEGER,
                recheck_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(username, url)
            )
        `);

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS user_gallery_locks (
                username TEXT PRIMARY KEY,
                is_locked INTEGER DEFAULT 0,
                locked_at INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes
        await this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_user_events_username ON user_events(username);
            CREATE INDEX IF NOT EXISTS idx_user_events_timestamp ON user_events(timestamp);
            CREATE INDEX IF NOT EXISTS idx_user_images_username ON user_images(username);
            CREATE INDEX IF NOT EXISTS idx_user_images_active ON user_images(is_active);
            CREATE INDEX IF NOT EXISTS idx_user_images_next_check ON user_images(next_check_at) 
                WHERE is_active = 0 AND next_check_at IS NOT NULL;
        `);
    }

    // ===== User Stats =====

    async updateUserStats(username, timestamp = Date.now()) {
        const existing = await this.db.get(
            'SELECT * FROM user_stats WHERE username = ?',
            [username]
        );

        if (existing) {
            await this.db.run(
                `UPDATE user_stats 
                 SET last_seen = ?, 
                     message_count = message_count + 1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE username = ?`,
                [timestamp, username]
            );
        } else {
            await this.db.run(
                `INSERT INTO user_stats (username, first_seen, last_seen, message_count)
                 VALUES (?, ?, ?, 1)`,
                [username, timestamp, timestamp]
            );
        }
    }

    async getUserStats(username) {
        return await this.db.get(
            'SELECT * FROM user_stats WHERE username = ?',
            [username]
        );
    }

    async getActiveUsers(hours = 24, limit = 50) {
        const since = Date.now() - (hours * 60 * 60 * 1000);
        
        return await this.db.all(
            `SELECT * FROM user_stats 
             WHERE last_seen > ?
             ORDER BY last_seen DESC
             LIMIT ?`,
            [since, limit]
        );
    }

    // ===== User Events =====

    async recordUserEvent(username, eventType, timestamp = Date.now(), room = null) {
        await this.db.run(
            `INSERT INTO user_events (username, event_type, timestamp, room)
             VALUES (?, ?, ?, ?)`,
            [username, eventType, timestamp, room]
        );

        // Update user stats on join
        if (eventType === 'join') {
            await this.updateUserStats(username, timestamp);
        }
    }

    async getUserEvents(username, options = {}) {
        const { limit = 100, eventType = null, room = null } = options;

        let query = 'SELECT * FROM user_events WHERE username = ?';
        const params = [username];

        if (eventType) {
            query += ' AND event_type = ?';
            params.push(eventType);
        }

        if (room) {
            query += ' AND room = ?';
            params.push(room);
        }

        query += ' ORDER BY timestamp DESC LIMIT ?';
        params.push(limit);

        return await this.db.all(query, params);
    }

    async getRecentJoins(minutes = 30, room = null) {
        const since = Date.now() - (minutes * 60 * 1000);

        let query = `
            SELECT DISTINCT username, MAX(timestamp) as last_join
            FROM user_events
            WHERE event_type = 'join' AND timestamp > ?
        `;
        const params = [since];

        if (room) {
            query += ' AND room = ?';
            params.push(room);
        }

        query += ' GROUP BY username ORDER BY last_join DESC';

        return await this.db.all(query, params);
    }

    // ===== User Images =====

    async addUserImage(username, url, timestamp = Date.now()) {
        try {
            // Check if image was previously pruned
            const existing = await this.db.get(
                'SELECT * FROM user_images WHERE username = ? AND url = ?',
                [username, url]
            );

            if (existing && !existing.is_active) {
                // Reactivate pruned image
                await this.db.run(
                    `UPDATE user_images 
                     SET is_active = 1, 
                         pruned_reason = NULL,
                         failure_count = 0,
                         first_failure_at = NULL,
                         last_check_at = NULL,
                         next_check_at = NULL,
                         timestamp = ?
                     WHERE id = ?`,
                    [timestamp, existing.id]
                );
                return { success: true, reactivated: true, id: existing.id };
            }

            const result = await this.db.run(
                `INSERT INTO user_images (username, url, timestamp)
                 VALUES (?, ?, ?)`,
                [username, url, timestamp]
            );

            return { success: true, id: result.lastID };
        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) {
                return { success: false, error: 'Image already exists' };
            }
            throw error;
        }
    }

    async getUserImages(username, activeOnly = true) {
        let query = 'SELECT * FROM user_images WHERE username = ?';
        const params = [username];

        if (activeOnly) {
            query += ' AND is_active = 1';
        }

        query += ' ORDER BY timestamp DESC';

        return await this.db.all(query, params);
    }

    async removeUserImage(imageId, reason = 'User requested') {
        const result = await this.db.run(
            `UPDATE user_images 
             SET is_active = 0, pruned_reason = ?
             WHERE id = ?`,
            [reason, imageId]
        );

        return result.changes > 0;
    }

    async getImageById(imageId) {
        return await this.db.get(
            'SELECT * FROM user_images WHERE id = ?',
            [imageId]
        );
    }

    async isGalleryLocked(username) {
        const lock = await this.db.get(
            'SELECT is_locked FROM user_gallery_locks WHERE username = ?',
            [username]
        );

        return lock?.is_locked === 1;
    }

    async setGalleryLock(username, locked) {
        const existing = await this.db.get(
            'SELECT * FROM user_gallery_locks WHERE username = ?',
            [username]
        );

        if (existing) {
            await this.db.run(
                `UPDATE user_gallery_locks 
                 SET is_locked = ?, locked_at = ?
                 WHERE username = ?`,
                [locked ? 1 : 0, locked ? Date.now() : null, username]
            );
        } else {
            await this.db.run(
                `INSERT INTO user_gallery_locks (username, is_locked, locked_at)
                 VALUES (?, ?, ?)`,
                [username, locked ? 1 : 0, locked ? Date.now() : null]
            );
        }
    }

    // ===== Image Health Management =====

    async markImageFailure(imageId, reason) {
        const image = await this.getImageById(imageId);
        if (!image) return;

        const now = Date.now();
        const failureCount = image.failure_count + 1;
        const firstFailure = image.first_failure_at || now;

        // Calculate next check time with exponential backoff
        const backoffHours = Math.min(Math.pow(2, failureCount - 1), 168); // Max 1 week
        const nextCheck = now + (backoffHours * 60 * 60 * 1000);

        await this.db.run(
            `UPDATE user_images 
             SET failure_count = ?,
                 first_failure_at = ?,
                 last_check_at = ?,
                 next_check_at = ?,
                 pruned_reason = ?
             WHERE id = ?`,
            [failureCount, firstFailure, now, nextCheck, reason, imageId]
        );

        // Mark as inactive after 3 failures
        if (failureCount >= 3) {
            await this.db.run(
                'UPDATE user_images SET is_active = 0 WHERE id = ?',
                [imageId]
            );
        }
    }

    async getImagesForHealthCheck(limit = 50) {
        const now = Date.now();

        return await this.db.all(
            `SELECT * FROM user_images 
             WHERE is_active = 1 
                OR (is_active = 0 AND next_check_at <= ?)
             ORDER BY last_check_at ASC NULLS FIRST
             LIMIT ?`,
            [now, limit]
        );
    }

    async markImageHealthy(imageId) {
        await this.db.run(
            `UPDATE user_images 
             SET failure_count = 0,
                 first_failure_at = NULL,
                 last_check_at = ?,
                 next_check_at = NULL,
                 pruned_reason = NULL,
                 is_active = 1
             WHERE id = ?`,
            [Date.now(), imageId]
        );
    }
}

module.exports = UserService;