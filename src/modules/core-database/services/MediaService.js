class MediaService {
    constructor(db, module) {
        this.db = db;
        this.module = module;
        this.logger = module.logger;
    }
    
    async init() {
        // Run media database migrations
        await this.runMediaMigrations();
    }
    
    async runMediaMigrations() {
        try {
            // Create media_history table if not exists
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
            
        } catch (error) {
            this.logger.error('Media migration failed:', error);
            throw error;
        }
    }
    
    // ===== Media Tracking =====
    
    async trackMedia(data) {
        const { url, title, addedBy, roomId } = data;
        const now = Date.now();
        
        try {
            await this.db.run(
                `INSERT INTO media_history (url, title, added_by, room_id, first_seen, last_seen)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(url, room_id) DO UPDATE SET
                 title = COALESCE(?, title),
                 last_seen = ?,
                 play_count = play_count + 1,
                 updated_at = CURRENT_TIMESTAMP`,
                [url, title, addedBy, roomId, now, now, title, now]
            );
            
        } catch (error) {
            this.logger.error('Failed to track media:', error);
            throw error;
        }
    }
    
    async trackQueue(data) {
        const { url, title, addedBy, roomId } = data;
        const now = Date.now();
        
        try {
            await this.db.run(
                `INSERT INTO media_history (url, title, added_by, room_id, first_seen, last_seen, play_count, queue_count)
                 VALUES (?, ?, ?, ?, ?, ?, 0, 1)
                 ON CONFLICT(url, room_id) DO UPDATE SET
                 title = COALESCE(?, title),
                 added_by = COALESCE(?, added_by),
                 queue_count = queue_count + 1,
                 updated_at = CURRENT_TIMESTAMP`,
                [url, title, addedBy, roomId, now, now, title, addedBy]
            );
            
        } catch (error) {
            this.logger.error('Failed to track queue:', error);
            throw error;
        }
    }
    
    // ===== Media Retrieval =====
    
    async getMediaHistory(options = {}) {
        const {
            roomId,
            addedBy,
            limit = 100,
            offset = 0,
            orderBy = 'last_seen DESC'
        } = options;
        
        let query = 'SELECT * FROM media_history WHERE 1=1';
        const params = [];
        
        if (roomId) {
            query += ' AND room_id = ?';
            params.push(roomId);
        }
        
        if (addedBy) {
            query += ' AND added_by = ?';
            params.push(addedBy);
        }
        
        query += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        
        return await this.db.all(query, params);
    }
    
    async getMediaByUrl(url, roomId = null) {
        if (roomId) {
            return await this.db.get(
                'SELECT * FROM media_history WHERE url = ? AND room_id = ?',
                [url, roomId]
            );
        } else {
            return await this.db.all(
                'SELECT * FROM media_history WHERE url = ?',
                [url]
            );
        }
    }
    
    async searchMedia(searchTerm, options = {}) {
        const { roomId, limit = 50 } = options;
        
        let query = `
            SELECT * FROM media_history 
            WHERE (title LIKE ? OR url LIKE ?)
        `;
        const params = [`%${searchTerm}%`, `%${searchTerm}%`];
        
        if (roomId) {
            query += ' AND room_id = ?';
            params.push(roomId);
        }
        
        query += ' ORDER BY play_count DESC LIMIT ?';
        params.push(limit);
        
        return await this.db.all(query, params);
    }
    
    // ===== Statistics =====
    
    async getMostPlayedMedia(roomId = null, limit = 10, days = 30) {
        const since = Date.now() - (days * 24 * 60 * 60 * 1000);
        
        let query = `
            SELECT url, title, added_by, play_count, queue_count
            FROM media_history
            WHERE last_seen > ?
        `;
        const params = [since];
        
        if (roomId) {
            query += ' AND room_id = ?';
            params.push(roomId);
        }
        
        query += ' ORDER BY play_count DESC LIMIT ?';
        params.push(limit);
        
        return await this.db.all(query, params);
    }
    
    async getTopAdders(roomId = null, limit = 10) {
        let query = `
            SELECT added_by, 
                   COUNT(DISTINCT url) as unique_media,
                   SUM(play_count) as total_plays,
                   SUM(queue_count) as total_queues
            FROM media_history
            WHERE added_by IS NOT NULL
        `;
        const params = [];
        
        if (roomId) {
            query += ' AND room_id = ?';
            params.push(roomId);
        }
        
        query += ' GROUP BY added_by ORDER BY unique_media DESC LIMIT ?';
        params.push(limit);
        
        return await this.db.all(query, params);
    }
    
    async getMediaStats(roomId = null) {
        let baseQuery = roomId ? ' WHERE room_id = ?' : '';
        const params = roomId ? [roomId] : [];
        
        const [totalMedia, totalPlays, uniqueAdders, recentMedia] = await Promise.all([
            this.db.get(`SELECT COUNT(DISTINCT url) as count FROM media_history${baseQuery}`, params),
            this.db.get(`SELECT SUM(play_count) as total FROM media_history${baseQuery}`, params),
            this.db.get(`SELECT COUNT(DISTINCT added_by) as count FROM media_history${baseQuery} AND added_by IS NOT NULL`, params),
            this.db.get(`SELECT COUNT(*) as count FROM media_history${baseQuery} AND last_seen > ?`, 
                [...params, Date.now() - (24 * 60 * 60 * 1000)])
        ]);
        
        return {
            totalUniqueMedia: totalMedia.count,
            totalPlays: totalPlays.total || 0,
            uniqueAdders: uniqueAdders.count,
            mediaLast24h: recentMedia.count
        };
    }
    
    async getRecentMedia(roomId = null, limit = 20) {
        let query = 'SELECT * FROM media_history';
        const params = [];
        
        if (roomId) {
            query += ' WHERE room_id = ?';
            params.push(roomId);
        }
        
        query += ' ORDER BY last_seen DESC LIMIT ?';
        params.push(limit);
        
        return await this.db.all(query, params);
    }
    
    // ===== Maintenance =====
    
    async pruneOldMedia(days = 365) {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        
        const result = await this.db.run(
            'DELETE FROM media_history WHERE last_seen < ? AND play_count < 5',
            [cutoff]
        );
        
        return result.changes;
    }
    
    async getDuplicateMedia(roomId = null) {
        let query = `
            SELECT url, COUNT(*) as count, GROUP_CONCAT(title, ' | ') as titles
            FROM media_history
        `;
        const params = [];
        
        if (roomId) {
            query += ' WHERE room_id = ?';
            params.push(roomId);
        }
        
        query += ' GROUP BY url HAVING count > 1 ORDER BY count DESC';
        
        return await this.db.all(query, params);
    }
}

export default MediaService;