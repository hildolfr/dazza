class UserService {
    constructor(db, module) {
        this.db = db;
        this.module = module;
        this.logger = module.logger;
    }
    
    async init() {
        // Any initialization logic
    }
    
    // ===== User Stats Management =====
    
    async updateUserStats(username, eventType = null) {
        const now = Date.now();
        
        try {
            // Check if user exists
            const user = await this.db.get(
                'SELECT * FROM user_stats WHERE username = ?',
                [username]
            );
            
            if (!user) {
                // Create new user
                await this.db.run(
                    `INSERT INTO user_stats (username, first_seen, last_seen, message_count)
                     VALUES (?, ?, ?, 0)`,
                    [username, now, now]
                );
            } else {
                // Update last seen
                await this.db.run(
                    `UPDATE user_stats 
                     SET last_seen = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE username = ?`,
                    [now, username]
                );
            }
            
            // Record event if specified
            if (eventType) {
                await this.recordUserEvent(username, eventType, now);
            }
            
        } catch (error) {
            this.logger.error('Failed to update user stats:', error);
            throw error;
        }
    }
    
    async getUserStats(username, roomId = null) {
        try {
            const user = await this.db.get(
                'SELECT * FROM user_stats WHERE username = ?',
                [username]
            );
            
            return user;
        } catch (error) {
            this.logger.error('Failed to get user stats:', error);
            throw error;
        }
    }
    
    // ===== Bong Tracking =====
    
    async getUserBongCount(username, roomId = null) {
        try {
            const result = await this.db.get(
                'SELECT COUNT(*) as count FROM user_bongs WHERE username = ?',
                [username]
            );
            
            return result ? result.count : 0;
        } catch (error) {
            this.logger.error('Failed to get user bong count:', error);
            throw error;
        }
    }
    
    async logUserBong(username, roomId = null) {
        try {
            const now = Date.now();
            
            await this.db.run(
                'INSERT INTO user_bongs (username, timestamp) VALUES (?, ?)',
                [username, now]
            );
            
            return true;
        } catch (error) {
            this.logger.error('Failed to log user bong:', error);
            throw error;
        }
    }
    
    async incrementBongCount(date, roomId = null) {
        try {
            // Get current count
            const current = await this.db.get(
                'SELECT count FROM bong_counter WHERE date = ?',
                [date]
            );
            
            if (current) {
                // Increment existing count
                await this.db.run(
                    'UPDATE bong_counter SET count = count + 1, updated_at = CURRENT_TIMESTAMP WHERE date = ?',
                    [date]
                );
                
                return current.count + 1;
            } else {
                // Create new entry
                await this.db.run(
                    'INSERT INTO bong_counter (date, count) VALUES (?, 1)',
                    [date]
                );
                
                return 1;
            }
        } catch (error) {
            this.logger.error('Failed to increment bong count:', error);
            throw error;
        }
    }
    
    // ===== Drink Tracking =====
    
    async getUserDrinkCount(username, roomId = null) {
        try {
            const result = await this.db.get(
                'SELECT COUNT(*) as count FROM user_drinks WHERE username = ?',
                [username]
            );
            
            return result ? result.count : 0;
        } catch (error) {
            this.logger.error('Failed to get user drink count:', error);
            throw error;
        }
    }
    
    async logUserDrink(username, roomId = null) {
        try {
            const now = Date.now();
            
            await this.db.run(
                'INSERT INTO user_drinks (username, timestamp) VALUES (?, ?)',
                [username, now]
            );
            
            return true;
        } catch (error) {
            this.logger.error('Failed to log user drink:', error);
            throw error;
        }
    }
    
    async incrementDrinkCount(date, roomId = null) {
        try {
            // Get current count
            const current = await this.db.get(
                'SELECT count FROM drink_counter WHERE date = ?',
                [date]
            );
            
            if (current) {
                // Increment existing count
                await this.db.run(
                    'UPDATE drink_counter SET count = count + 1, updated_at = CURRENT_TIMESTAMP WHERE date = ?',
                    [date]
                );
                
                return current.count + 1;
            } else {
                // Create new entry
                await this.db.run(
                    'INSERT INTO drink_counter (date, count) VALUES (?, 1)',
                    [date]
                );
                
                return 1;
            }
        } catch (error) {
            this.logger.error('Failed to increment drink count:', error);
            throw error;
        }
    }
    
    // ===== Image/Gallery Methods =====
    
    async saveUserImage(username, url, timestamp = Date.now()) {
        try {
            await this.db.run(
                `INSERT OR REPLACE INTO user_images (username, url, timestamp, is_active)
                 VALUES (?, ?, ?, 1)`,
                [username, url, timestamp]
            );
            
            return true;
        } catch (error) {
            this.logger.error('Failed to save user image:', error);
            throw error;
        }
    }
    
    async getUserImages(username, options = {}) {
        try {
            const { limit = 50, offset = 0, activeOnly = true } = options;
            
            let query = 'SELECT * FROM user_images WHERE username = ?';
            let params = [username];
            
            if (activeOnly) {
                query += ' AND is_active = 1';
            }
            
            query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);
            
            const images = await this.db.all(query, params);
            return images;
        } catch (error) {
            this.logger.error('Failed to get user images:', error);
            throw error;
        }
    }
    
    async deleteUserImage(username, url) {
        try {
            const result = await this.db.run(
                'UPDATE user_images SET is_active = 0, pruned_reason = ? WHERE username = ? AND url = ?',
                ['deleted', username, url]
            );
            
            return result.changes > 0;
        } catch (error) {
            this.logger.error('Failed to delete user image:', error);
            throw error;
        }
    }
    
    async getUserImageCount(username) {
        try {
            const result = await this.db.get(
                'SELECT COUNT(*) as count FROM user_images WHERE username = ? AND is_active = 1',
                [username]
            );
            
            return result ? result.count : 0;
        } catch (error) {
            this.logger.error('Failed to get user image count:', error);
            throw error;
        }
    }
    
    async isGalleryLocked(username) {
        try {
            const result = await this.db.get(
                'SELECT is_locked FROM user_gallery_locks WHERE username = ?',
                [username]
            );
            
            return result ? result.is_locked === 1 : false;
        } catch (error) {
            this.logger.error('Failed to check gallery lock:', error);
            throw error;
        }
    }
    
    async lockGallery(username) {
        try {
            await this.db.run(
                `INSERT OR REPLACE INTO user_gallery_locks (username, is_locked, locked_at)
                 VALUES (?, 1, ?)`,
                [username, Date.now()]
            );
            
            return true;
        } catch (error) {
            this.logger.error('Failed to lock gallery:', error);
            throw error;
        }
    }
    
    async unlockGallery(username) {
        try {
            await this.db.run(
                'UPDATE user_gallery_locks SET is_locked = 0 WHERE username = ?',
                [username]
            );
            
            return true;
        } catch (error) {
            this.logger.error('Failed to unlock gallery:', error);
            throw error;
        }
    }
    
    // ===== Event Tracking =====
    
    async recordUserEvent(username, eventType, timestamp = Date.now()) {
        try {
            await this.db.run(
                'INSERT INTO user_events (username, event_type, timestamp) VALUES (?, ?, ?)',
                [username, eventType, timestamp]
            );
            
            return true;
        } catch (error) {
            this.logger.error('Failed to record user event:', error);
            throw error;
        }
    }
    
    // ===== User Retrieval =====
    
    async getUser(username) {
        return await this.db.get(
            'SELECT * FROM user_stats WHERE username = ?',
            [username]
        );
    }
    
    async getAllUsers(options = {}) {
        const { limit = 100, offset = 0, orderBy = 'last_seen DESC' } = options;
        
        return await this.db.all(
            `SELECT * FROM user_stats 
             ORDER BY ${orderBy}
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );
    }
    
    async getActiveUsers(minutes = 60) {
        const since = Date.now() - (minutes * 60 * 1000);
        
        return await this.db.all(
            `SELECT * FROM user_stats 
             WHERE last_seen > ?
             ORDER BY last_seen DESC`,
            [since]
        );
    }
    
    // ===== User Events =====
    
    async getUserEvents(username, options = {}) {
        const { limit = 100, eventType } = options;
        
        let query = 'SELECT * FROM user_events WHERE username = ?';
        const params = [username];
        
        if (eventType) {
            query += ' AND event_type = ?';
            params.push(eventType);
        }
        
        query += ' ORDER BY timestamp DESC LIMIT ?';
        params.push(limit);
        
        return await this.db.all(query, params);
    }
    
    async getRecentJoins(limit = 10) {
        return await this.db.all(
            `SELECT * FROM user_events 
             WHERE event_type = 'join'
             ORDER BY timestamp DESC
             LIMIT ?`,
            [limit]
        );
    }
    
    // ===== Bong Counter =====
    
    async recordBong(username) {
        const now = Date.now();
        const dateStr = new Date().toDateString();
        
        // Record user bong
        await this.db.run(
            'INSERT INTO user_bongs (username, timestamp) VALUES (?, ?)',
            [username, now]
        );
        
        // Update daily counter
        await this.db.run(
            `INSERT INTO bong_counter (date, count) VALUES (?, 1)
             ON CONFLICT(date) DO UPDATE SET 
             count = count + 1,
             updated_at = CURRENT_TIMESTAMP`,
            [dateStr]
        );
    }
    
    async getBongCount(date = null) {
        if (!date) {
            date = new Date().toDateString();
        }
        
        const result = await this.db.get(
            'SELECT count FROM bong_counter WHERE date = ?',
            [date]
        );
        
        return result ? result.count : 0;
    }
    
    async getUserBongCount(username, days = 1) {
        const since = Date.now() - (days * 24 * 60 * 60 * 1000);
        
        const result = await this.db.get(
            `SELECT COUNT(*) as count FROM user_bongs 
             WHERE username = ? AND timestamp > ?`,
            [username, since]
        );
        
        return result.count;
    }
    
    // ===== Drink Counter =====
    
    async recordDrink(username) {
        const now = Date.now();
        const dateStr = new Date().toDateString();
        
        // Record user drink
        await this.db.run(
            'INSERT INTO user_drinks (username, timestamp) VALUES (?, ?)',
            [username, now]
        );
        
        // Update daily counter
        await this.db.run(
            `INSERT INTO drink_counter (date, count) VALUES (?, 1)
             ON CONFLICT(date) DO UPDATE SET 
             count = count + 1,
             updated_at = CURRENT_TIMESTAMP`,
            [dateStr]
        );
    }
    
    async getDrinkCount(date = null) {
        if (!date) {
            date = new Date().toDateString();
        }
        
        const result = await this.db.get(
            'SELECT count FROM drink_counter WHERE date = ?',
            [date]
        );
        
        return result ? result.count : 0;
    }
    
    // ===== User Images =====
    
    async addUserImage(username, url) {
        try {
            await this.db.run(
                `INSERT INTO user_images (username, url, timestamp)
                 VALUES (?, ?, ?)
                 ON CONFLICT(username, url) DO UPDATE SET
                 is_active = 1,
                 failure_count = 0,
                 first_failure_at = NULL,
                 pruned_reason = NULL,
                 recheck_count = 0,
                 timestamp = ?`,
                [username, url, Date.now(), Date.now()]
            );
            
            return { success: true };
            
        } catch (error) {
            this.logger.error('Failed to add user image:', error);
            return { success: false, error: error.message };
        }
    }
    
    async getUserImages(username, activeOnly = true) {
        let query = 'SELECT * FROM user_images WHERE username = ?';
        
        if (activeOnly) {
            query += ' AND is_active = 1';
        }
        
        query += ' ORDER BY timestamp DESC';
        
        return await this.db.all(query, [username]);
    }
    
    async markImageInactive(imageId, reason) {
        await this.db.run(
            `UPDATE user_images 
             SET is_active = 0, 
                 pruned_reason = ?,
                 next_check_at = ?
             WHERE id = ?`,
            [reason, Date.now() + (24 * 60 * 60 * 1000), imageId]
        );
    }
    
    async updateImageHealthCheck(imageId, success) {
        if (success) {
            await this.db.run(
                `UPDATE user_images 
                 SET failure_count = 0,
                     first_failure_at = NULL,
                     last_check_at = ?
                 WHERE id = ?`,
                [Date.now(), imageId]
            );
        } else {
            await this.db.run(
                `UPDATE user_images 
                 SET failure_count = failure_count + 1,
                     first_failure_at = COALESCE(first_failure_at, ?),
                     last_check_at = ?
                 WHERE id = ?`,
                [Date.now(), Date.now(), imageId]
            );
        }
    }
    
    async getImagesForHealthCheck(limit = 10) {
        return await this.db.all(
            `SELECT * FROM user_images 
             WHERE is_active = 1 
             AND (last_check_at IS NULL OR last_check_at < ?)
             ORDER BY last_check_at ASC NULLS FIRST
             LIMIT ?`,
            [Date.now() - (60 * 60 * 1000), limit] // Check images older than 1 hour
        );
    }
    
    // ===== Gallery Locks =====
    
    async isGalleryLocked(username) {
        const result = await this.db.get(
            'SELECT is_locked FROM user_gallery_locks WHERE username = ?',
            [username]
        );
        
        return result ? result.is_locked === 1 : false;
    }
    
    async setGalleryLock(username, locked) {
        await this.db.run(
            `INSERT INTO user_gallery_locks (username, is_locked, locked_at)
             VALUES (?, ?, ?)
             ON CONFLICT(username) DO UPDATE SET
             is_locked = ?,
             locked_at = CASE WHEN ? = 1 THEN ? ELSE locked_at END`,
            [username, locked ? 1 : 0, Date.now(), locked ? 1 : 0, locked ? 1 : 0, Date.now()]
        );
    }
    
    // ===== Statistics =====
    
    async getUserStatistics(username) {
        const stats = await this.getUser(username);
        if (!stats) return null;
        
        // Get additional stats
        const [bongCount, drinkCount, imageCount] = await Promise.all([
            this.getUserBongCount(username, 30),
            this.db.get(
                `SELECT COUNT(*) as count FROM user_drinks 
                 WHERE username = ? AND timestamp > ?`,
                [username, Date.now() - (30 * 24 * 60 * 60 * 1000)]
            ),
            this.db.get(
                'SELECT COUNT(*) as count FROM user_images WHERE username = ? AND is_active = 1',
                [username]
            )
        ]);
        
        return {
            ...stats,
            bongs_30d: bongCount,
            drinks_30d: drinkCount.count,
            active_images: imageCount.count
        };
    }
}

module.exports = UserService;