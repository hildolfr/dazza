import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import { createLogger } from '../../utils/logger.js';

export default class MediaTracker {
    constructor() {
        this.logger = createLogger('MediaTracker');
        this.db = null;
        this.enabled = false;
        this.roomId = null;
        
        // Promisified database methods
        this.dbRun = null;
        this.dbGet = null;
        this.dbAll = null;
    }

    initialize(config) {
        try {
            this.roomId = config.roomId;
            
            // Initialize database
            const dbPath = path.join(process.cwd(), 'media_encountered.db');
            this.db = new sqlite3.Database(dbPath);
            
            // Promisify database methods
            this.dbRun = promisify(this.db.run.bind(this.db));
            this.dbGet = promisify(this.db.get.bind(this.db));
            this.dbAll = promisify(this.db.all.bind(this.db));
            
            // Create table if it doesn't exist
            this.db.serialize(() => {
                this.db.run(`
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
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_media_url ON media_history(url)`);
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_media_room ON media_history(room_id)`);
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_media_added_by ON media_history(added_by)`);
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_media_first_seen ON media_history(first_seen)`);
            });

            this.enabled = true;
            this.logger.info(`Media tracker initialized for room ${this.roomId}`);
        } catch (error) {
            this.logger.error('Failed to initialize media tracker:', error);
            this.enabled = false;
        }
    }

    /**
     * Record media when it starts playing
     */
    async recordMediaPlay(media) {
        if (!this.enabled || !media) return;

        try {
            // Handle different media data structures
            let id, title, type, queueby, roomId;
            
            // Extract room ID (for multi-room support)
            roomId = media._roomId || this.roomId;
            
            // CyTube sends media info directly in changeMedia event
            if (media.id) {
                id = media.id;
                title = media.title;
                type = media.type;
                queueby = media.queueby || 'Unknown';
            } else if (media.media) {
                // Playlist item structure
                id = media.media.id;
                title = media.media.title;
                type = media.media.type;
                queueby = media.queueby || 'Unknown';
            } else {
                this.logger.warn('Unknown media structure - unable to extract ID and title');
                return;
            }
            const now = Date.now();

            // Build URL from media ID and type
            const url = this.buildMediaUrl(id, type);
            if (!url) {
                this.logger.warn(`Could not build URL for media type: ${type}`);
                return;
            }

            // Check if media already exists
            const existing = await this.dbGet(
                'SELECT * FROM media_history WHERE url = ? AND room_id = ?',
                [url, roomId]
            );

            if (existing) {
                // Update existing entry
                await this.dbRun(`
                    UPDATE media_history 
                    SET last_seen = ?, 
                        play_count = play_count + 1,
                        title = COALESCE(?, title),
                        added_by = COALESCE(?, added_by),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE url = ? AND room_id = ?
                `, [now, title || existing.title, queueby || existing.added_by, url, roomId]);

                this.logger.debug(`Updated media play: ${title || 'Unknown'} (${url})`);
            } else {
                // Insert new entry
                await this.dbRun(`
                    INSERT INTO media_history (url, title, added_by, room_id, first_seen, last_seen)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [url, title || 'Unknown', queueby || 'Unknown', roomId, now, now]);

                this.logger.info(`New media recorded: ${title || 'Unknown'} by ${queueby || 'Unknown'} (${url})`);
            }
        } catch (error) {
            this.logger.error('Error recording media play:', error);
        }
    }

    /**
     * Record media when it's added to queue
     */
    async recordMediaQueued(item) {
        if (!this.enabled || !item || !item.media) return;

        try {
            const { id, title, type } = item.media;
            const { queueby } = item;
            const roomId = item._roomId || this.roomId;
            const now = Date.now();

            // Build URL from media ID and type
            const url = this.buildMediaUrl(id, type);
            if (!url) {
                this.logger.warn(`Could not build URL for media type: ${type}`);
                return;
            }

            // Check if media already exists
            const existing = await this.dbGet(
                'SELECT * FROM media_history WHERE url = ? AND room_id = ?',
                [url, roomId]
            );

            if (existing) {
                // Update queue count
                await this.dbRun(`
                    UPDATE media_history 
                    SET queue_count = queue_count + 1,
                        title = COALESCE(?, title),
                        added_by = COALESCE(?, added_by),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE url = ? AND room_id = ?
                `, [title || existing.title, queueby || existing.added_by, url, roomId]);

                this.logger.debug(`Updated media queue count: ${title || 'Unknown'} (${url})`);
            } else {
                // Insert new entry (queued but not played yet)
                await this.dbRun(`
                    INSERT INTO media_history (url, title, added_by, room_id, first_seen, last_seen, play_count, queue_count)
                    VALUES (?, ?, ?, ?, ?, ?, 0, 1)
                `, [url, title || 'Unknown', queueby || 'Unknown', roomId, now, now]);

                this.logger.info(`New media queued: ${title || 'Unknown'} by ${queueby || 'Unknown'} (${url})`);
            }
        } catch (error) {
            this.logger.error('Error recording media queue:', error);
        }
    }

    /**
     * Build media URL from ID and type
     */
    buildMediaUrl(id, type) {
        switch (type) {
            case 'yt':
                return `https://www.youtube.com/watch?v=${id}`;
            case 'vi':
                return `https://vimeo.com/${id}`;
            case 'dm':
                return `https://www.dailymotion.com/video/${id}`;
            case 'sc':
                return `https://soundcloud.com/${id}`;
            case 'tw':
                return `https://www.twitch.tv/videos/${id}`;
            case 'gd':
                return `https://drive.google.com/file/d/${id}/view`;
            case 'fi':
                // Direct file URLs are already complete
                return id;
            case 'hb':
                return `https://www.hitbox.tv/video/${id}`;
            case 'us':
                return `https://www.ustream.tv/recorded/${id}`;
            case 'im':
                return `https://imgur.com/${id}`;
            case 'hl':
                // HLS streams
                return id;
            case 'sb':
                return `https://streamable.com/${id}`;
            case 'tc':
                return `https://clips.twitch.tv/${id}`;
            case 'cm':
                // Custom media embeds
                return id;
            default:
                this.logger.warn(`Unknown media type: ${type}`);
                return null;
        }
    }

    /**
     * Get statistics about tracked media
     */
    async getStats() {
        if (!this.enabled) return null;

        try {
            const stats = await this.dbGet(`
                SELECT 
                    COUNT(DISTINCT url) as unique_media,
                    COUNT(DISTINCT added_by) as unique_users,
                    SUM(play_count) as total_plays,
                    SUM(queue_count) as total_queues
                FROM media_history
                WHERE room_id = ?
            `, [this.roomId]);

            return stats;
        } catch (error) {
            this.logger.error('Error getting media stats:', error);
            return null;
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        this.enabled = false;
    }
}