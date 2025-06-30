import { batchCheckImageHealth } from '../services/imageMetadata.js';

export class ImageHealthChecker {
    constructor(bot) {
        this.bot = bot;
        this.checkInterval = 60 * 60 * 1000; // 1 hour
        this.batchSize = 50;
        this.isRunning = false;
        this.intervalId = null;
    }

    start() {
        if (this.intervalId) return;
        
        this.bot.logger.info('[ImageHealthChecker] Starting periodic health checks');
        
        // Run initial check after 5 minutes
        setTimeout(() => this.runHealthCheck(), 5 * 60 * 1000);
        
        // Then run every hour
        this.intervalId = setInterval(() => {
            this.runHealthCheck();
        }, this.checkInterval);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.bot.logger.info('[ImageHealthChecker] Stopped periodic health checks');
        }
    }

    async runHealthCheck() {
        if (this.isRunning) {
            this.bot.logger.debug('[ImageHealthChecker] Health check already in progress');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();
        
        try {
            this.bot.logger.info('[ImageHealthChecker] Starting image health check');
            
            // Get active images that haven't been checked recently
            const images = await this.bot.db.all(`
                SELECT url, username, id
                FROM user_images
                WHERE is_active = 1
                ORDER BY RANDOM()
                LIMIT ?
            `, [this.batchSize]);

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
            const deadImages = [];
            
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const image = images[i];
                
                if (!result.accessible) {
                    deadCount++;
                    deadImages.push({
                        id: image.id,
                        url: image.url,
                        username: image.username,
                        error: result.error || 'Unknown error'
                    });
                    
                    // Mark as dead in database
                    await this.bot.db.run(`
                        UPDATE user_images 
                        SET is_active = 0, 
                            pruned_reason = ?
                        WHERE id = ?
                    `, [`Dead link: ${result.error || 'HTTP ' + result.statusCode}`, image.id]);
                }
            }
            
            const duration = Date.now() - startTime;
            this.bot.logger.info(`[ImageHealthChecker] Health check completed in ${duration}ms. Found ${deadCount} dead images out of ${images.length} checked`);
            
            // Emit event for dead images found
            if (deadCount > 0 && this.bot.apiServer) {
                this.bot.emit('gallery:health:check', {
                    timestamp: Date.now(),
                    checked: images.length,
                    dead: deadCount,
                    deadImages: deadImages
                });
            }
            
            // Don't announce in chat - just log the cleanup
            // Removed chat announcement to keep gallery cleanup silent
            
        } catch (error) {
            this.bot.logger.error('[ImageHealthChecker] Health check failed:', error);
        } finally {
            this.isRunning = false;
        }
    }
    
    // Manual check for specific user
    async checkUserImages(username) {
        try {
            const images = await this.bot.db.all(`
                SELECT url, id
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
            
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                const image = images[i];
                
                if (!result.accessible) {
                    deadCount++;
                    
                    await this.bot.db.run(`
                        UPDATE user_images 
                        SET is_active = 0, 
                            pruned_reason = ?
                        WHERE id = ?
                    `, [`Dead link: ${result.error || 'HTTP ' + result.statusCode}`, image.id]);
                }
            }
            
            return { checked: images.length, dead: deadCount };
            
        } catch (error) {
            this.bot.logger.error(`[ImageHealthChecker] Failed to check images for ${username}:`, error);
            throw error;
        }
    }
}