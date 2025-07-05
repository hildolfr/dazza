import { batchCheckImageHealth } from '../../services/imageMetadata.js';

export class ImageHealthChecker {
    constructor(bot) {
        this.bot = bot;
        this.checkInterval = 60 * 60 * 1000; // 1 hour
        this.recheckInterval = 3 * 60 * 60 * 1000; // 3 hours initial recheck
        this.batchSize = 50;
        this.isRunning = false;
        this.intervalId = null;
        this.recheckIntervalId = null;
        this.minFailureInterval = 5 * 60 * 1000; // 5 minutes between failures
        this.maxFailures = 3; // Number of failures before pruning
        this.maxRecheckHours = 48; // When to show gravestone badge
        
        // Timer tracking for cleanup
        this.timeouts = new Set();
        this.intervals = new Set();
        this.isShuttingDown = false;
        
        // Bind cleanup on process shutdown
        this.boundCleanup = this.cleanup.bind(this);
        process.on('SIGINT', this.boundCleanup);
        process.on('SIGTERM', this.boundCleanup);
    }

    start() {
        if (this.intervalId || this.isShuttingDown) return;
        
        this.bot.logger.info('[ImageHealthChecker] Starting periodic health checks');
        
        // Run initial check after 5 minutes - track timeout
        const initialTimeout = setTimeout(() => {
            this.timeouts.delete(initialTimeout);
            this.runHealthCheck();
        }, 5 * 60 * 1000);
        this.timeouts.add(initialTimeout);
        
        // Then run every hour - track interval
        this.intervalId = setInterval(() => {
            if (!this.isShuttingDown) {
                this.runHealthCheck();
            }
        }, this.checkInterval);
        this.intervals.add(this.intervalId);
        
        // Start recheck timer for pruned images - track interval
        this.recheckIntervalId = setInterval(() => {
            if (!this.isShuttingDown) {
                this.runRecheckPrunedImages();
            }
        }, 30 * 60 * 1000); // Check every 30 minutes for images due for recheck
        this.intervals.add(this.recheckIntervalId);
    }

    stop() {
        this.isShuttingDown = true;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervals.delete(this.intervalId);
            this.intervalId = null;
            this.bot.logger.info('[ImageHealthChecker] Stopped periodic health checks');
        }
        
        if (this.recheckIntervalId) {
            clearInterval(this.recheckIntervalId);
            this.intervals.delete(this.recheckIntervalId);
            this.recheckIntervalId = null;
        }
        
        this.cleanup();
    }

    isConnected() {
        // Check if the bot is connected to any room
        // Handle both single-room bot (with connection) and multi-room bot (with connections)
        
        // Multi-room bot
        if (this.bot.connections && this.bot.connections.size > 0) {
            // Check if at least one connection is active
            for (const [roomId, connection] of this.bot.connections) {
                if (connection && connection.isConnected()) {
                    return true;
                }
            }
            this.bot.logger.warn('[ImageHealthChecker] Bot is not connected to any rooms, skipping health check');
            return false;
        }
        
        // Single-room bot (backward compatibility)
        if (this.bot.connection && this.bot.connection.isConnected()) {
            return true;
        }
        
        this.bot.logger.warn('[ImageHealthChecker] Bot is not connected, skipping health check');
        return false;
    }

    async runHealthCheck() {
        if (this.isRunning || !this.isConnected()) {
            this.bot.logger.debug('[ImageHealthChecker] Health check skipped - already running or disconnected');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();
        
        try {
            this.bot.logger.info('[ImageHealthChecker] Starting image health check');
            
            // Get active images that haven't been checked recently
            // Prioritize images that haven't been checked in a while
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            const images = await this.bot.db.all(`
                SELECT url, username, id, failure_count, first_failure_at, last_check_at
                FROM user_images
                WHERE is_active = 1
                AND (last_check_at IS NULL OR last_check_at < ?)
                ORDER BY 
                    CASE WHEN last_check_at IS NULL THEN 0 ELSE last_check_at END ASC,
                    id ASC
                LIMIT ?
            `, [oneHourAgo, this.batchSize]);

            if (images.length === 0) {
                this.bot.logger.debug('[ImageHealthChecker] No images to check');
                return;
            }

            this.bot.logger.info(`[ImageHealthChecker] Checking ${images.length} images`);
            
            // Check image health in batches
            const urls = images.map(img => img.url);
            const results = await batchCheckImageHealth(urls, 10);
            
            // Process results
            let deadCount = 0;
            let temporaryFailures = 0;
            const deadImages = [];
            const now = Date.now();
            
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const image = images[i];
                
                if (!result.accessible) {
                    this.bot.logger.debug(`[ImageHealthChecker] Image failed: ${image.url} - ${result.error}`);
                    
                    // Check if enough time has passed since last failure
                    if (image.last_check_at && (now - image.last_check_at) < this.minFailureInterval) {
                        this.bot.logger.debug(`[ImageHealthChecker] Skipping failure count increment - too soon since last check`);
                        continue;
                    }
                    
                    const newFailureCount = (image.failure_count || 0) + 1;
                    const firstFailureAt = image.first_failure_at || now;
                    
                    if (newFailureCount >= this.maxFailures) {
                        // Mark as dead and set up for recheck
                        deadCount++;
                        deadImages.push({
                            id: image.id,
                            url: image.url,
                            username: image.username,
                            error: result.error || 'Unknown error'
                        });
                        
                        const nextCheckAt = now + this.recheckInterval;
                        
                        await this.bot.db.run(`
                            UPDATE user_images 
                            SET is_active = 0, 
                                pruned_reason = ?,
                                failure_count = ?,
                                first_failure_at = ?,
                                last_check_at = ?,
                                next_check_at = ?,
                                recheck_count = 0
                            WHERE id = ?
                        `, [
                            `Dead link: ${result.error || 'HTTP ' + result.statusCode}`,
                            newFailureCount,
                            firstFailureAt,
                            now,
                            nextCheckAt,
                            image.id
                        ]);
                        
                        this.bot.logger.info(`[ImageHealthChecker] Image pruned after ${newFailureCount} failures: ${image.url}`);
                    } else {
                        // Increment failure count
                        temporaryFailures++;
                        
                        await this.bot.db.run(`
                            UPDATE user_images 
                            SET failure_count = ?,
                                first_failure_at = ?,
                                last_check_at = ?
                            WHERE id = ?
                        `, [newFailureCount, firstFailureAt, now, image.id]);
                        
                        this.bot.logger.debug(`[ImageHealthChecker] Image failure ${newFailureCount}/${this.maxFailures}: ${image.url}`);
                    }
                } else {
                    // Image is accessible - reset failure count if it had any
                    if (image.failure_count > 0) {
                        await this.bot.db.run(`
                            UPDATE user_images 
                            SET failure_count = 0,
                                first_failure_at = NULL,
                                last_check_at = ?
                            WHERE id = ?
                        `, [now, image.id]);
                        
                        this.bot.logger.info(`[ImageHealthChecker] Image recovered: ${image.url}`);
                    }
                }
            }
            
            const duration = Date.now() - startTime;
            this.bot.logger.info(`[ImageHealthChecker] Health check completed in ${duration}ms. Found ${deadCount} dead images and ${temporaryFailures} temporary failures out of ${images.length} checked`);
            
            // Emit event for dead images found
            if (deadCount > 0 && this.bot.apiServer) {
                this.bot.emit('gallery:health:check', {
                    timestamp: Date.now(),
                    checked: images.length,
                    dead: deadCount,
                    temporaryFailures: temporaryFailures,
                    deadImages: deadImages
                });
            }
            
        } catch (error) {
            this.bot.logger.error('[ImageHealthChecker] Health check failed:', { error: error.message, stack: error.stack });
        } finally {
            this.isRunning = false;
        }
    }
    
    async runRecheckPrunedImages() {
        if (!this.isConnected()) {
            return;
        }
        
        const now = Date.now();
        
        try {
            this.bot.logger.debug('[ImageHealthChecker] Checking for pruned images due for recheck');
            
            // Get pruned images that are due for recheck
            const images = await this.bot.db.all(`
                SELECT id, url, username, recheck_count, next_check_at
                FROM user_images
                WHERE is_active = 0 
                AND next_check_at IS NOT NULL 
                AND next_check_at <= ?
                LIMIT 20
            `, [now]);
            
            if (images.length === 0) {
                return;
            }
            
            this.bot.logger.info(`[ImageHealthChecker] Rechecking ${images.length} pruned images`);
            
            const urls = images.map(img => img.url);
            const results = await batchCheckImageHealth(urls, 5);
            
            let restoredCount = 0;
            
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const image = images[i];
                
                if (result.accessible) {
                    // Check if user is already at the 25 image limit
                    const activeCount = await this.bot.db.get(`
                        SELECT COUNT(*) as count
                        FROM user_images
                        WHERE username = ? AND is_active = 1
                    `, [image.username]);
                    
                    if (activeCount.count >= 25) {
                        this.bot.logger.info(`[ImageHealthChecker] Cannot restore image for ${image.username} - already has 25 images`);
                        // Keep it in recheck queue with longer interval
                        const recheckCount = (image.recheck_count || 0) + 1;
                        const nextInterval = 24 * 60 * 60 * 1000; // Check again in 24 hours
                        const nextCheckAt = now + nextInterval;
                        
                        await this.bot.db.run(`
                            UPDATE user_images 
                            SET recheck_count = ?,
                                last_check_at = ?,
                                next_check_at = ?
                            WHERE id = ?
                        `, [recheckCount, now, nextCheckAt, image.id]);
                        continue;
                    }
                    
                    // Image is back online and user has room - restore it
                    restoredCount++;
                    
                    await this.bot.db.run(`
                        UPDATE user_images 
                        SET is_active = 1,
                            pruned_reason = NULL,
                            failure_count = 0,
                            first_failure_at = NULL,
                            last_check_at = ?,
                            next_check_at = NULL,
                            recheck_count = 0
                        WHERE id = ?
                    `, [now, image.id]);
                    
                    this.bot.logger.info(`[ImageHealthChecker] Restored image: ${image.url}`);
                    
                    // Emit restoration event
                    if (this.bot.apiServer) {
                        this.bot.emit('gallery:image:restored', {
                            id: image.id,
                            url: image.url,
                            username: image.username,
                            timestamp: now
                        });
                    }
                } else {
                    // Still dead - calculate next recheck with exponential backoff
                    const recheckCount = (image.recheck_count || 0) + 1;
                    let nextInterval = this.recheckInterval * Math.pow(2, Math.min(recheckCount - 1, 4)); // Cap at 16x (48 hours)
                    
                    const nextCheckAt = now + nextInterval;
                    
                    await this.bot.db.run(`
                        UPDATE user_images 
                        SET recheck_count = ?,
                            last_check_at = ?,
                            next_check_at = ?
                        WHERE id = ?
                    `, [recheckCount, now, nextCheckAt, image.id]);
                    
                    const hoursUntilNext = Math.round(nextInterval / (60 * 60 * 1000));
                    this.bot.logger.debug(`[ImageHealthChecker] Image still dead after recheck ${recheckCount}: ${image.url} - next check in ${hoursUntilNext} hours`);
                }
            }
            
            if (restoredCount > 0) {
                this.bot.logger.info(`[ImageHealthChecker] Restored ${restoredCount} images`);
            }
            
        } catch (error) {
            this.bot.logger.error('[ImageHealthChecker] Recheck failed:', { error: error.message, stack: error.stack });
        }
    }
    
    // Manual check for specific user
    async checkUserImages(username) {
        if (!this.isConnected()) {
            throw new Error('Bot is not connected');
        }
        
        try {
            const images = await this.bot.db.all(`
                SELECT url, id, failure_count, first_failure_at, last_check_at
                FROM user_images
                WHERE LOWER(username) = LOWER(?)
                AND is_active = 1
            `, [username]);

            if (images.length === 0) {
                return { checked: 0, dead: 0 };
            }

            const urls = images.map(img => img.url);
            const results = await batchCheckImageHealth(urls, 5);
            
            let deadCount = 0;
            let temporaryFailures = 0;
            const now = Date.now();
            
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const image = images[i];
                
                if (!result.accessible) {
                    // For manual checks, we still respect the 3-strike rule
                    if (image.last_check_at && (now - image.last_check_at) < this.minFailureInterval) {
                        continue;
                    }
                    
                    const newFailureCount = (image.failure_count || 0) + 1;
                    const firstFailureAt = image.first_failure_at || now;
                    
                    if (newFailureCount >= this.maxFailures) {
                        deadCount++;
                        const nextCheckAt = now + this.recheckInterval;
                        
                        await this.bot.db.run(`
                            UPDATE user_images 
                            SET is_active = 0, 
                                pruned_reason = ?,
                                failure_count = ?,
                                first_failure_at = ?,
                                last_check_at = ?,
                                next_check_at = ?,
                                recheck_count = 0
                            WHERE id = ?
                        `, [
                            `Dead link: ${result.error || 'HTTP ' + result.statusCode}`,
                            newFailureCount,
                            firstFailureAt,
                            now,
                            nextCheckAt,
                            image.id
                        ]);
                    } else {
                        temporaryFailures++;
                        
                        await this.bot.db.run(`
                            UPDATE user_images 
                            SET failure_count = ?,
                                first_failure_at = ?,
                                last_check_at = ?
                            WHERE id = ?
                        `, [newFailureCount, firstFailureAt, now, image.id]);
                    }
                } else {
                    // Reset failure count if it had any
                    if (image.failure_count > 0) {
                        await this.bot.db.run(`
                            UPDATE user_images 
                            SET failure_count = 0,
                                first_failure_at = NULL,
                                last_check_at = ?
                            WHERE id = ?
                        `, [now, image.id]);
                    }
                }
            }
            
            return { 
                checked: images.length, 
                dead: deadCount,
                temporaryFailures: temporaryFailures
            };
            
        } catch (error) {
            this.bot.logger.error(`[ImageHealthChecker] Failed to check images for ${username}:`, { error: error.message, stack: error.stack });
            throw error;
        }
    }
    
    // Manual recheck for specific image
    async recheckImage(imageId) {
        // Manual rechecks don't require bot connection - they're triggered from web interface
        
        try {
            const image = await this.bot.db.get(`
                SELECT id, url, username, is_active
                FROM user_images
                WHERE id = ?
            `, [imageId]);
            
            if (!image) {
                throw new Error('Image not found');
            }
            
            const result = await batchCheckImageHealth([image.url], 1);
            const now = Date.now();
            
            if (result[0].accessible) {
                // Check if user is already at the 25 image limit
                const activeCount = await this.bot.db.get(`
                    SELECT COUNT(*) as count
                    FROM user_images
                    WHERE username = ? AND is_active = 1
                `, [image.username]);
                
                if (activeCount.count >= 25) {
                    return { 
                        success: false, 
                        accessible: true, 
                        error: 'Gallery is full (25 images). Cannot restore image.' 
                    };
                }
                
                // Restore the image
                await this.bot.db.run(`
                    UPDATE user_images 
                    SET is_active = 1,
                        pruned_reason = NULL,
                        failure_count = 0,
                        first_failure_at = NULL,
                        last_check_at = ?,
                        next_check_at = NULL,
                        recheck_count = 0
                    WHERE id = ?
                `, [now, imageId]);
                
                if (this.bot.apiServer) {
                    this.bot.apiServer.emit('gallery:image:restored', {
                        id: image.id,
                        url: image.url,
                        username: image.username,
                        timestamp: now
                    });
                }
                
                return { success: true, accessible: true };
            } else {
                // Update last check time
                await this.bot.db.run(`
                    UPDATE user_images 
                    SET last_check_at = ?
                    WHERE id = ?
                `, [now, imageId]);
                
                return { success: true, accessible: false, error: result[0].error };
            }
            
        } catch (error) {
            this.bot.logger.error(`[ImageHealthChecker] Failed to recheck image ${imageId}:`, { error: error.message, stack: error.stack });
            throw error;
        }
    }
    
    /**
     * Comprehensive cleanup of all timers and intervals
     */
    cleanup() {
        if (this.isShuttingDown) return; // Prevent duplicate cleanup
        
        this.bot.logger.info('[ImageHealthChecker] Cleaning up timers and intervals');
        
        // Clear all tracked timeouts
        this.timeouts.forEach(timeoutId => {
            clearTimeout(timeoutId);
        });
        this.timeouts.clear();
        
        // Clear all tracked intervals
        this.intervals.forEach(intervalId => {
            clearInterval(intervalId);
        });
        this.intervals.clear();
        
        // Reset state
        this.intervalId = null;
        this.recheckIntervalId = null;
        this.isRunning = false;
        this.isShuttingDown = true;
        
        // Remove process listeners
        process.removeListener('SIGINT', this.boundCleanup);
        process.removeListener('SIGTERM', this.boundCleanup);
        
        this.bot.logger.info('[ImageHealthChecker] Cleanup completed');
    }
    
    /**
     * Get current timer statistics for monitoring
     */
    getTimerStats() {
        return {
            activeTimeouts: this.timeouts.size,
            activeIntervals: this.intervals.size,
            isRunning: this.isRunning,
            isShuttingDown: this.isShuttingDown,
            mainInterval: !!this.intervalId,
            recheckInterval: !!this.recheckIntervalId
        };
    }
}