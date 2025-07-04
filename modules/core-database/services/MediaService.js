class MediaService {
    constructor(db, logger) {
        this.db = db;
        this.logger = logger;
    }

    async init() {
        // Create media history table
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS media_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT NOT NULL,
                title TEXT,
                added_by TEXT,
                room_id TEXT NOT NULL,
                first_seen INTEGER NOT NULL,
                last_seen INTEGER NOT NULL,
                play_count INTEGER DEFAULT 1,
                queue_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(url, room_id)
            )
        `);

        // Create indexes
        await this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_media_history_url ON media_history(url);
            CREATE INDEX IF NOT EXISTS idx_media_history_room ON media_history(room_id);
            CREATE INDEX IF NOT EXISTS idx_media_history_added_by ON media_history(added_by);
            CREATE INDEX IF NOT EXISTS idx_media_history_last_seen ON media_history(last_seen);
        `);
    }

    // ===== Media Tracking =====

    async recordMedia(mediaInfo) {
        const {
            url,
            title = null,
            addedBy = null,
            roomId,
            timestamp = Date.now()
        } = mediaInfo;

        try {
            // Try to insert new record
            await this.db.run(
                `INSERT INTO media_history 
                 (url, title, added_by, room_id, first_seen, last_seen, play_count)
                 VALUES (?, ?, ?, ?, ?, ?, 1)`,
                [url, title, addedBy, roomId, timestamp, timestamp]
            );

            return { isNew: true, playCount: 1 };
        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) {
                // Update existing record
                const result = await this.db.run(
                    `UPDATE media_history 
                     SET last_seen = ?,
                         play_count = play_count + 1,
                         title = COALESCE(?, title),
                         added_by = COALESCE(?, added_by),
                         updated_at = CURRENT_TIMESTAMP
                     WHERE url = ? AND room_id = ?`,
                    [timestamp, title, addedBy, url, roomId]
                );

                const media = await this.getMedia(url, roomId);
                return { isNew: false, playCount: media.play_count };
            }
            throw error;
        }
    }

    async recordQueue(url, roomId, addedBy = null) {
        await this.db.run(
            `UPDATE media_history 
             SET queue_count = queue_count + 1,
                 added_by = COALESCE(?, added_by)
             WHERE url = ? AND room_id = ?`,
            [addedBy, url, roomId]
        );
    }

    async getMedia(url, roomId) {
        return await this.db.get(
            'SELECT * FROM media_history WHERE url = ? AND room_id = ?',
            [url, roomId]
        );
    }

    // ===== Media Queries =====

    async searchMedia(searchTerm, options = {}) {
        const { roomId = null, limit = 50 } = options;

        let query = `
            SELECT * FROM media_history 
            WHERE (url LIKE ? OR title LIKE ?)
        `;
        const params = [`%${searchTerm}%`, `%${searchTerm}%`];

        if (roomId) {
            query += ' AND room_id = ?';
            params.push(roomId);
        }

        query += ' ORDER BY last_seen DESC LIMIT ?';
        params.push(limit);

        return await this.db.all(query, params);
    }

    async getRecentMedia(options = {}) {
        const {
            roomId = null,
            hours = 24,
            limit = 50
        } = options;

        const since = Date.now() - (hours * 60 * 60 * 1000);

        let query = 'SELECT * FROM media_history WHERE last_seen > ?';
        const params = [since];

        if (roomId) {
            query += ' AND room_id = ?';
            params.push(roomId);
        }

        query += ' ORDER BY last_seen DESC LIMIT ?';
        params.push(limit);

        return await this.db.all(query, params);
    }

    async getTopMedia(options = {}) {
        const {
            roomId = null,
            days = 30,
            limit = 50,
            orderBy = 'play_count'
        } = options;

        const since = Date.now() - (days * 24 * 60 * 60 * 1000);

        let query = 'SELECT * FROM media_history WHERE last_seen > ?';
        const params = [since];

        if (roomId) {
            query += ' AND room_id = ?';
            params.push(roomId);
        }

        // Validate orderBy to prevent SQL injection
        const validOrderBy = ['play_count', 'queue_count', 'last_seen'];
        const safeOrderBy = validOrderBy.includes(orderBy) ? orderBy : 'play_count';

        query += ` ORDER BY ${safeOrderBy} DESC LIMIT ?`;
        params.push(limit);

        return await this.db.all(query, params);
    }

    async getUserMedia(username, options = {}) {
        const { roomId = null, limit = 50 } = options;

        let query = 'SELECT * FROM media_history WHERE added_by = ?';
        const params = [username];

        if (roomId) {
            query += ' AND room_id = ?';
            params.push(roomId);
        }

        query += ' ORDER BY last_seen DESC LIMIT ?';
        params.push(limit);

        return await this.db.all(query, params);
    }

    // ===== Statistics =====

    async getMediaStats(roomId = null) {
        let baseQuery = 'FROM media_history';
        const params = [];

        if (roomId) {
            baseQuery += ' WHERE room_id = ?';
            params.push(roomId);
        }

        const stats = await this.db.get(
            `SELECT 
                COUNT(*) as total_media,
                SUM(play_count) as total_plays,
                SUM(queue_count) as total_queues,
                AVG(play_count) as avg_plays,
                MAX(play_count) as max_plays
             ${baseQuery}`,
            params
        );

        // Get top contributors
        let contributorQuery = `
            SELECT added_by, COUNT(*) as media_count
            FROM media_history
        `;

        if (roomId) {
            contributorQuery += ' WHERE room_id = ?';
        }

        contributorQuery += `
            GROUP BY added_by
            ORDER BY media_count DESC
            LIMIT 10
        `;

        const topContributors = await this.db.all(contributorQuery, params);

        return {
            ...stats,
            topContributors
        };
    }

    async getRoomStats() {
        return await this.db.all(`
            SELECT 
                room_id,
                COUNT(*) as media_count,
                SUM(play_count) as total_plays,
                MAX(last_seen) as last_activity
            FROM media_history
            GROUP BY room_id
            ORDER BY media_count DESC
        `);
    }

    async getMediaHistory(url, roomId = null) {
        let query = `
            SELECT 
                room_id,
                first_seen,
                last_seen,
                play_count,
                queue_count,
                added_by
            FROM media_history
            WHERE url = ?
        `;
        const params = [url];

        if (roomId) {
            query += ' AND room_id = ?';
            params.push(roomId);
        }

        query += ' ORDER BY last_seen DESC';

        return await this.db.all(query, params);
    }

    // ===== Maintenance =====

    async pruneOldMedia(days = 365) {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

        const result = await this.db.run(
            'DELETE FROM media_history WHERE last_seen < ? AND play_count = 1',
            [cutoff]
        );

        this.logger.info(`Pruned ${result.changes} old media entries`);
        return result.changes;
    }

    async mergeMediaEntries(primaryUrl, secondaryUrl, roomId) {
        // Get both entries
        const primary = await this.getMedia(primaryUrl, roomId);
        const secondary = await this.getMedia(secondaryUrl, roomId);

        if (!primary || !secondary) {
            throw new Error('One or both media entries not found');
        }

        // Merge play counts and update timestamps
        await this.db.run(
            `UPDATE media_history 
             SET play_count = play_count + ?,
                 queue_count = queue_count + ?,
                 first_seen = MIN(first_seen, ?),
                 last_seen = MAX(last_seen, ?),
                 updated_at = CURRENT_TIMESTAMP
             WHERE url = ? AND room_id = ?`,
            [
                secondary.play_count,
                secondary.queue_count,
                secondary.first_seen,
                secondary.last_seen,
                primaryUrl,
                roomId
            ]
        );

        // Delete secondary entry
        await this.db.run(
            'DELETE FROM media_history WHERE url = ? AND room_id = ?',
            [secondaryUrl, roomId]
        );

        return { merged: true, totalPlays: primary.play_count + secondary.play_count };
    }

    // ===== Export/Import =====

    async exportMediaData(roomId = null, format = 'json') {
        let query = 'SELECT * FROM media_history';
        const params = [];

        if (roomId) {
            query += ' WHERE room_id = ?';
            params.push(roomId);
        }

        const data = await this.db.all(query, params);

        if (format === 'csv') {
            // Convert to CSV format
            const headers = Object.keys(data[0] || {}).join(',');
            const rows = data.map(row => 
                Object.values(row).map(v => 
                    typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v
                ).join(',')
            );
            return [headers, ...rows].join('\n');
        }

        return data;
    }
}

module.exports = MediaService;