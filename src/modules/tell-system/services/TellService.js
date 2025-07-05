/**
 * Tell Service
 * Handles offline message delivery when users join the chat
 * Extracted from bot.js tell delivery functionality
 */
class TellService {
    constructor(services, config, logger) {
        this.services = services;
        this.config = config;
        this.logger = logger;
        this.ready = false;
    }

    async initialize() {
        this.logger.info('TellService initializing...');
        this.ready = true;
        this.logger.info('TellService initialized');
    }

    /**
     * Check and deliver tells for a user when they join
     * @param {string} username - The username to check tells for
     * @param {Object} room - Room context for sending messages
     */
    async checkAndDeliverTells(username, room) {
        try {
            const db = this.services.get('database');
            if (!db) {
                this.logger.error('Database service not available for tell delivery');
                return;
            }

            const tells = await db.getTellsForUser(username);
            
            for (let i = 0; i < tells.length; i++) {
                const tell = tells[i];
                const timeDiff = Date.now() - tell.created_at;
                const timeAgo = this.formatTimeAgo(timeDiff);
                
                // Delay messages slightly to avoid spam
                setTimeout(() => {
                    this.deliverTell(tell, username, timeAgo, room);
                }, this.config.deliveryDelay + (i * this.config.messageInterval));
                
                await db.markTellDelivered(tell.id);
            }

            if (tells.length > 0) {
                this.logger.info(`Delivered ${tells.length} tells to ${username}`);
            }
        } catch (error) {
            this.logger.error('Failed to deliver tells', { 
                error: error.message, 
                username 
            });
        }
    }

    /**
     * Deliver a single tell message
     * @param {Object} tell - The tell object from database
     * @param {string} username - Target username
     * @param {string} timeAgo - Formatted time string
     * @param {Object} room - Room context for sending messages
     */
    deliverTell(tell, username, timeAgo, room) {
        if (tell.via_pm) {
            // Tell was sent via PM, deliver privately
            this.deliverPrivateTell(tell, username, timeAgo, room);
        } else {
            // Regular public tell
            this.deliverPublicTell(tell, username, timeAgo, room);
        }
    }

    /**
     * Deliver a private tell message
     * @param {Object} tell - The tell object
     * @param {string} username - Target username
     * @param {string} timeAgo - Formatted time string
     * @param {Object} room - Room context
     */
    deliverPrivateTell(tell, username, timeAgo, room) {
        const publicNotifications = [
            `oi ${username}, check ya PMs mate!`,
            `${username}, ya got a private message waiting`,
            `psst ${username}, slide into ya DMs for a message`,
            `${username} mate, check ya inbox`
        ];
        
        // Send public notification
        const notification = publicNotifications[Math.floor(Math.random() * publicNotifications.length)];
        this.sendMessage(room, notification);
        
        // Send the actual message via PM
        const pmMessage = `Private message from ${tell.from_user} (${timeAgo}): "${tell.message}"`;
        this.sendPrivateMessage(room, username, pmMessage);
    }

    /**
     * Deliver a public tell message
     * @param {Object} tell - The tell object
     * @param {string} username - Target username
     * @param {string} timeAgo - Formatted time string
     * @param {Object} room - Room context
     */
    deliverPublicTell(tell, username, timeAgo, room) {
        const deliveryMessages = [
            `oi ${username}! ${tell.from_user} told me to tell ya "${tell.message}" (${timeAgo})`,
            `${username} mate, got a message from ${tell.from_user} for ya: "${tell.message}" (${timeAgo})`,
            `ey ${username}, ${tell.from_user} left this for ya ${timeAgo}: "${tell.message}"`,
            `${username}! ${tell.from_user} said to pass this on: "${tell.message}" (${timeAgo})`,
            `about time ya showed up ${username}, ${tell.from_user} wanted me to tell ya: "${tell.message}" (${timeAgo})`
        ];
        
        const message = deliveryMessages[Math.floor(Math.random() * deliveryMessages.length)];
        this.sendMessage(room, message);
    }

    /**
     * Format time difference into human readable string
     * @param {number} timeDiff - Time difference in milliseconds
     * @returns {string} - Formatted time string
     */
    formatTimeAgo(timeDiff) {
        const minutes = Math.floor(timeDiff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) {
            return `${days} day${days > 1 ? 's' : ''} ago`;
        } else if (hours > 0) {
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else if (minutes > 0) {
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else {
            return 'just now';
        }
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
            this.logger.error('Failed to send message', { error: error.message, message });
        }
    }

    /**
     * Send a private message to a user
     * @param {Object} room - Room context
     * @param {string} username - Target username
     * @param {string} message - Message to send
     */
    sendPrivateMessage(room, username, message) {
        try {
            if (room && room.sendPM) {
                room.sendPM(username, message);
            } else {
                this.logger.warn('No room context available for sending PM');
            }
        } catch (error) {
            this.logger.error('Failed to send PM', { 
                error: error.message, 
                username, 
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
            name: 'TellService'
        };
    }
}

export default TellService;