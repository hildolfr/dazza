/**
 * URL Comment Service
 * Handles automatic URL commenting with drunk personality traits
 * Extracted from bot.js URL detection and commenting functionality
 */
class URLCommentService {
    constructor(services, config, logger) {
        this.services = services;
        this.config = config;
        this.logger = logger;
        this.ready = false;
        
        // State management
        this.lastUrlCommentTime = 0;
        this.urlCommentCooldown = this.getRandomUrlCooldown();
    }

    async initialize() {
        this.logger.info('URLCommentService initializing...');
        
        // Import required utilities
        try {
            // These utilities should be available from the utils directory
            this.detectUrls = require('../../../utils/urlDetection').detectUrls;
            this.extractDomain = require('../../../utils/urlDetection').extractDomain;
            this.fetchUrlTitleAndComment = require('../../../services/urlTitleFetcher').fetchUrlTitleAndComment;
        } catch (error) {
            this.logger.error('Failed to load URL utilities', { error: error.message });
            throw error;
        }
        
        this.ready = true;
        this.logger.info('URLCommentService initialized');
    }

    /**
     * Process a chat message for URL detection and commenting
     * @param {Object} data - Message data
     * @param {Object} room - Room context for sending messages
     */
    async processMessage(data, room) {
        if (!this.ready) {
            return;
        }

        try {
            // Detect URLs in the message
            const urlDetection = this.detectUrls(data.msg);
            if (!urlDetection.hasUrls) {
                return;
            }

            // Process first URL only (to avoid spam)
            const urlData = urlDetection.urls[0];
            
            // Add domain to the URL data
            urlData.domain = this.extractDomain(urlData.url);
            
            // Log the URL to database
            await this.logUrl(data.username, urlData, data.messageId);
            
            this.logger.debug('URL detected', {
                username: data.username,
                url: urlData.url,
                type: urlData.type,
                domain: urlData.domain
            });

            // Check if we should comment on the URL
            if (await this.shouldCommentOnUrl()) {
                await this.commentOnUrl(urlData, data.username, room);
            }

        } catch (error) {
            this.logger.error('Failed to process URL', {
                error: error.message,
                username: data.username,
                message: data.msg
            });
        }
    }

    /**
     * Determine if we should comment on a URL based on cooldown and randomness
     * @returns {boolean} - Whether to comment
     */
    async shouldCommentOnUrl() {
        const now = Date.now();
        const timeSinceLastComment = now - this.lastUrlCommentTime;
        
        // Only respond to about 50% of links (Dazza's drunk and misses half)
        const shouldRespond = Math.random() < this.config.responseChance;
        
        if (!shouldRespond) {
            this.logger.debug('Skipped URL comment (drunk roll failed)');
            return false;
        }

        if (timeSinceLastComment <= this.urlCommentCooldown) {
            this.logger.debug(`Skipped URL comment (cooldown: ${Math.round((this.urlCommentCooldown - timeSinceLastComment) / 1000)}s remaining)`);
            return false;
        }

        return true;
    }

    /**
     * Generate and send a comment on a URL
     * @param {Object} urlData - URL information
     * @param {string} username - User who posted the URL
     * @param {Object} room - Room context
     */
    async commentOnUrl(urlData, username, room) {
        try {
            // Fetch title and make contextual comment
            const comment = await this.fetchUrlTitleAndComment(urlData, username);
            if (!comment) {
                return;
            }

            // Update cooldown state
            this.lastUrlCommentTime = Date.now();
            this.urlCommentCooldown = this.getRandomUrlCooldown();
            
            // Add a delay (1-5 seconds - drunk typing speed)
            const drunkDelay = this.config.minDrunkDelay + 
                Math.random() * (this.config.maxDrunkDelay - this.config.minDrunkDelay);
            
            setTimeout(() => {
                this.sendMessage(room, comment);
            }, drunkDelay);
            
            this.logger.debug(`Commented on URL, next possible in ${Math.round(this.urlCommentCooldown / 60000)} minutes`);

        } catch (error) {
            this.logger.error('Failed to comment on URL', {
                error: error.message,
                url: urlData.url,
                username
            });
        }
    }

    /**
     * Log URL to database
     * @param {string} username - User who posted the URL
     * @param {Object} urlData - URL information
     * @param {string} messageId - Message ID
     */
    async logUrl(username, urlData, messageId) {
        try {
            const db = this.services.get('database');
            if (db && db.logUrl) {
                await db.logUrl(username, urlData, messageId);
            }
        } catch (error) {
            this.logger.error('Failed to log URL to database', {
                error: error.message,
                username,
                url: urlData.url
            });
        }
    }

    /**
     * Generate random URL comment cooldown
     * @returns {number} - Cooldown time in milliseconds
     */
    getRandomUrlCooldown() {
        // Random cooldown between 2-15 minutes (Dazza's attention span varies when drunk)
        return this.config.minCooldown + 
            Math.random() * (this.config.maxCooldown - this.config.minCooldown);
    }

    /**
     * Send a message to the room
     * @param {Object} room - Room context
     * @param {string} message - Message to send
     */
    sendMessage(room, message) {
        try {
            if (room && room.sendMessage) {
                room.sendMessage(message);
            } else {
                this.logger.warn('No room context available for sending message');
            }
        } catch (error) {
            this.logger.error('Failed to send message', { 
                error: error.message, 
                message 
            });
        }
    }

    /**
     * Get service status
     * @returns {Object} - Service status information
     */
    getStatus() {
        return {
            ready: this.ready,
            name: 'URLCommentService',
            lastCommentTime: this.lastUrlCommentTime,
            nextCommentAvailable: this.lastUrlCommentTime + this.urlCommentCooldown,
            cooldownRemaining: Math.max(0, (this.lastUrlCommentTime + this.urlCommentCooldown) - Date.now())
        };
    }
}

module.exports = URLCommentService;