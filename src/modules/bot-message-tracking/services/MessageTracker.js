/**
 * Message Tracker Service
 * Handles bot message tracking, echo prevention, and duplicate detection
 * Extracted from bot.js message tracking functionality
 */
class MessageTracker {
    constructor(services, config, logger) {
        this.services = services;
        this.config = config;
        this.logger = logger;
        this.ready = false;
        
        // Message tracking to prevent duplicates
        this.processedMessages = new Set();
        this.maxProcessedSize = this.config.maxProcessedSize || 1000;
        this.staleMessageThreshold = this.config.staleMessageThreshold || 30000;
        
        // Track bot's own sent messages to prevent self-replies
        this.recentBotMessages = new Map();
        this.MESSAGE_CACHE_DURATION = this.config.messageCacheDuration || 30000;
        this.botMessageCleanupInterval = null;
    }

    async initialize() {
        this.logger.info('MessageTracker initializing...');
        
        // Set up periodic cleanup of bot message cache
        this.botMessageCleanupInterval = setInterval(() => {
            this.cleanupBotMessageCache();
        }, this.config.cleanupInterval || 60000); // Every minute
        
        this.ready = true;
        this.logger.info('MessageTracker initialized');
    }

    async cleanup() {
        if (this.botMessageCleanupInterval) {
            clearInterval(this.botMessageCleanupInterval);
            this.botMessageCleanupInterval = null;
        }
        
        this.processedMessages.clear();
        this.recentBotMessages.clear();
        this.ready = false;
        
        this.logger.info('MessageTracker cleaned up');
    }

    /**
     * Generate a hash for a message
     * @param {string} message - The message to hash
     * @returns {string} - Message hash
     */
    hashMessage(message) {
        // Normalize the message: lowercase, trim, remove extra spaces
        const normalized = message.toLowerCase().trim().replace(/\s+/g, ' ');
        
        // Create a simple hash using the message content and length
        // This is sufficient for our use case of detecting recent duplicates
        let hash = 0;
        for (let i = 0; i < normalized.length; i++) {
            const char = normalized.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        // Include length to help differentiate similar messages
        return `${Math.abs(hash)}_${normalized.length}`;
    }

    /**
     * Track a message sent by the bot to prevent self-replies
     * @param {string} message - The message being sent
     */
    trackBotMessage(message) {
        const hash = this.hashMessage(message);
        const now = Date.now();
        
        this.recentBotMessages.set(hash, now);
        
        // Log for debugging
        this.logger.debug('Tracking bot message', {
            hash,
            messagePreview: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
            totalTracked: this.recentBotMessages.size
        });
    }

    /**
     * Clean up old bot messages from tracking
     */
    cleanupBotMessageCache() {
        const now = Date.now();
        const expired = [];
        
        for (const [hash, timestamp] of this.recentBotMessages) {
            if (now - timestamp > this.MESSAGE_CACHE_DURATION) {
                expired.push(hash);
            }
        }
        
        for (const hash of expired) {
            this.recentBotMessages.delete(hash);
        }
        
        if (expired.length > 0) {
            this.logger.debug(`Cleaned up ${expired.length} expired bot messages, ${this.recentBotMessages.size} remaining`);
        }
    }

    /**
     * Check if a message was recently sent by the bot
     * @param {string} message - The message to check
     * @returns {boolean} True if this was a recent bot message
     */
    isRecentBotMessage(message) {
        const hash = this.hashMessage(message);
        const timestamp = this.recentBotMessages.get(hash);
        
        if (!timestamp) {
            return false;
        }
        
        const age = Date.now() - timestamp;
        const isRecent = age <= this.MESSAGE_CACHE_DURATION;
        
        if (isRecent) {
            this.logger.debug('Message identified as recent bot message', {
                hash,
                ageMs: age,
                messagePreview: message.substring(0, 50) + (message.length > 50 ? '...' : '')
            });
        }
        
        return isRecent;
    }

    /**
     * Check if a message ID has been processed recently
     * @param {string} messageId - The message ID to check
     * @returns {boolean} True if message was already processed
     */
    isMessageProcessed(messageId) {
        return this.processedMessages.has(messageId);
    }

    /**
     * Mark a message as processed
     * @param {string} messageId - The message ID to mark as processed
     */
    markMessageProcessed(messageId) {
        this.processedMessages.add(messageId);
        
        // Prevent memory bloat by limiting size
        if (this.processedMessages.size > this.maxProcessedSize) {
            // Remove oldest entries (convert to array, slice, convert back)
            const entries = Array.from(this.processedMessages);
            const keepEntries = entries.slice(-Math.floor(this.maxProcessedSize * 0.8));
            this.processedMessages = new Set(keepEntries);
            
            this.logger.debug(`Trimmed processed messages cache to ${this.processedMessages.size} entries`);
        }
    }

    /**
     * Check if a message is stale (too old to process)
     * @param {number} messageTimestamp - Message timestamp
     * @returns {boolean} True if message is stale
     */
    isMessageStale(messageTimestamp) {
        const age = Date.now() - messageTimestamp;
        return age > this.staleMessageThreshold;
    }

    /**
     * Process a chat message for tracking
     * @param {Object} data - Message data
     */
    processMessage(data) {
        if (!this.ready) {
            return { shouldProcess: false, reason: 'tracker not ready' };
        }

        const { message } = data;
        
        if (!message || !message.id) {
            return { shouldProcess: false, reason: 'invalid message data' };
        }

        // Check if message is stale
        if (message.time && this.isMessageStale(message.time)) {
            return { shouldProcess: false, reason: 'message too old' };
        }

        // Check if already processed
        if (this.isMessageProcessed(message.id)) {
            return { shouldProcess: false, reason: 'already processed' };
        }

        // Check if this was a recent bot message (echo prevention)
        if (message.msg && this.isRecentBotMessage(message.msg)) {
            return { shouldProcess: false, reason: 'echo prevention' };
        }

        // Mark as processed
        this.markMessageProcessed(message.id);
        
        return { shouldProcess: true, reason: 'message is valid' };
    }

    /**
     * Get tracker statistics
     * @returns {Object} - Tracker statistics
     */
    getStats() {
        return {
            processedMessages: this.processedMessages.size,
            trackedBotMessages: this.recentBotMessages.size,
            maxProcessedSize: this.maxProcessedSize,
            cacheDuration: this.MESSAGE_CACHE_DURATION,
            staleThreshold: this.staleMessageThreshold
        };
    }

    /**
     * Get service status
     * @returns {Object} - Service status information
     */
    getStatus() {
        return {
            ready: this.ready,
            name: 'MessageTracker',
            stats: this.getStats()
        };
    }
}

export default MessageTracker;