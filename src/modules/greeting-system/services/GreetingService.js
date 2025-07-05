/**
 * Greeting Service
 * Handles user greetings with spam prevention, first-time detection, and cooldown management
 * Extracted from bot.js greeting system functionality
 */
class GreetingService {
    constructor(services, config, logger) {
        this.services = services;
        this.config = config;
        this.logger = logger;
        this.ready = false;
        
        // Greeting system state
        this.lastGreetingTime = 0;
        this.greetingCooldown = this.getRandomGreetingCooldown();
        this.recentJoins = [];
        this.pendingGreeting = null;
        // userDepartureTimes now handled by User Management System
        // userlist now handled by User Management System
    }

    async initialize() {
        this.logger.info('GreetingService initializing...');
        this.ready = true;
        this.logger.info('GreetingService initialized');
    }

    async cleanup() {
        if (this.pendingGreeting) {
            clearTimeout(this.pendingGreeting);
            this.pendingGreeting = null;
        }
        
        this.recentJoins = [];
        // userDepartureTimes and userlist now handled by User Management System
        this.ready = false;
        
        this.logger.info('GreetingService cleaned up');
    }

    /**
     * Handle user join events
     * @param {Object} user - User object with name and other properties
     * @param {Object} room - Room context for sending messages
     */
    async handleUserJoin(user, room) {
        if (!this.ready) {
            return;
        }

        this.logger.debug(`handleUserJoin called for ${user.name} at ${new Date().toISOString()}`);
        
        // Track join for spam prevention (userlist now handled by User Management System)
        this.recentJoins.push(Date.now());

        // Check if we should greet
        if (this.config.enabled && this.shouldGreetUser(user.name)) {
            await this.greetUser(user.name, room);
        }
    }

    /**
     * Handle user leave events
     * @param {Object} user - User object with name and other properties
     */
    handleUserLeave(user) {
        if (!this.ready) {
            return;
        }

        // User departure tracking now handled by User Management System
        this.logger.debug(`User ${user.name} left, departure tracking handled by User Management System`);
    }

    /**
     * Determine if we should greet a user
     * @param {string} username - Username to check
     * @returns {boolean} - Whether to greet the user
     */
    shouldGreetUser(username) {
        // Don't greet if not fully ready
        if (!this.ready) return false;
        
        // Don't greet ourselves (check against bot username if configured)
        if (this.config.botUsername && username.toLowerCase() === this.config.botUsername.toLowerCase()) {
            return false;
        }
        
        // Check if user recently left using User Management Service
        const userManagementService = this.services.get('userManagement');
        if (userManagementService && userManagementService.hasRecentlyDeparted(username)) {
            this.logger.debug(`Not greeting ${username} - recently departed`);
            return false;
        }
        
        // Check if enough time has passed since last greeting
        const now = Date.now();
        if (now - this.lastGreetingTime < this.greetingCooldown) return false;
        
        // Clear old joins from recent list (older than 30 seconds)
        this.recentJoins = this.recentJoins.filter(join => 
            now - join < this.config.recentJoinWindow
        );
        
        // Don't greet if there's been a lot of recent activity
        if (this.recentJoins.length > this.config.recentJoinThreshold) return false;
        
        // Add some randomness - configurable chance to greet when conditions are met
        return Math.random() < this.config.greetingChance;
    }

    /**
     * Greet a user with typing delay and cooldown management
     * @param {string} username - Username to greet
     * @param {Object} room - Room context for sending messages
     */
    async greetUser(username, room) {
        // Cancel any pending greeting
        if (this.pendingGreeting) {
            clearTimeout(this.pendingGreeting);
            this.pendingGreeting = null;
        }
        
        // Random typing delay
        const typingDelay = this.config.minTypingDelay + 
            Math.random() * (this.config.maxTypingDelay - this.config.minTypingDelay);
        
        this.pendingGreeting = setTimeout(async () => {
            // Double-check we haven't been cancelled
            if (!this.pendingGreeting) return;
            
            try {
                const greeting = await this.getRandomGreeting(username);
                this.sendMessage(room, greeting);
                
                // Update greeting tracking
                this.lastGreetingTime = Date.now();
                this.greetingCooldown = this.getRandomGreetingCooldown();
                this.pendingGreeting = null;
                
                this.logger.debug(`Greeted ${username}, next greeting possible in ${Math.round(this.greetingCooldown / 60000)} minutes`);
                
            } catch (error) {
                this.logger.error('Error sending greeting', {
                    error: error.message,
                    username
                });
            }
        }, typingDelay);
    }

    /**
     * Generate a random greeting message
     * @param {string} username - Username to greet
     * @returns {string} - Greeting message
     */
    async getRandomGreeting(username) {
        // Check if this is a first-time user
        try {
            const db = this.services.get('database');
            if (db) {
                const userStats = await db.get(
                    'SELECT first_seen FROM user_stats WHERE username = ?',
                    [username]
                );
                
                // If no stats exist, this is a first-time user
                if (!userStats) {
                    return this.getFirstTimeGreeting(username);
                }
            }
        } catch (err) {
            this.logger.error('Error checking if user is first-time:', err);
            // Fall through to regular greetings on error
        }
        
        return this.getRegularGreeting(username);
    }

    /**
     * Get a first-time user greeting
     * @param {string} username - Username to greet
     * @returns {string} - First-time greeting message
     */
    getFirstTimeGreeting(username) {
        const firstTimeGreetings = [
            `oi ${username}, I haven't seen you around here before!`,
            `who the fuck is ${username}? never seen ya before mate`,
            `${username}? new face! welcome to the shitshow`,
            `fuckin hell, fresh meat! welcome ${username}`,
            `${username}! first time? this place'll ruin ya`,
            `never seen ${username} before, you a cop?`,
            `${username}'s new! someone get 'em a beer`,
            `oi everyone, ${username}'s a virgin! first timer!`,
            `${username}? don't recognize ya mate, welcome aboard`,
            `new cunt alert! ${username}'s here for the first time`,
            `${username}! fresh face, prepare to be corrupted`,
            `who invited ${username}? kidding, welcome newbie`,
            `${username}'s cherry's about to be popped, first timer!`,
            `strewth, ${username}! never seen ya round these parts`,
            `${username}? you lost mate? welcome anyway`,
            `fresh blood! ${username}'s new to this circus`,
            `${username}! hope you're ready for this shitshow`,
            `never seen ${username} before, must be fresh off the boat`,
            `oi ${username}, first time? you're in for a treat`,
            `${username}'s new! quick, act normal everyone`,
            `welcome ${username}! we don't bite... much`,
            `${username}? new face! this your first rodeo?`,
            `fuckin oath, ${username}'s a first timer!`
        ];
        
        return firstTimeGreetings[Math.floor(Math.random() * firstTimeGreetings.length)];
    }

    /**
     * Get a regular user greeting
     * @param {string} username - Username to greet
     * @returns {string} - Regular greeting message
     */
    getRegularGreeting(username) {
        const greetings = [
            `oi ${username}, how's it goin mate`,
            `${username}! good to see ya cobber`,
            `fuckin hell ${username}'s here`,
            `${username} mate! pull up a chair`,
            `look who rocked up, ${username}!`,
            `${username}! just in time for a cone`,
            `ey ${username}, grab us a beer while you're up`,
            `${username}'s here, party can start now`,
            `about time ${username} showed up`,
            `${username}! where ya been mate`,
            `well well well, if it isn't ${username}`,
            `${username} ya legend`,
            `${username}! thought you were dead mate`,
            `${username} just in time, we're gettin on the piss`,
            `strewth, ${username}'s graced us with their presence`,
            `${username} mate, long time no see`,
            `${username}! ya missed all the good stuff`,
            `look what the cat dragged in, ${username}`,
            `${username}! still breathin I see`,
            `${username} decided to show up ay`,
            `g'day ${username}`,
            `${username}! ya beauty`,
            `finally ${username}, been waitin for ages`,
            `${username} rocks up fashionably late as usual`,
            `there's ${username}, hide the bongs`,
            `${username}! shazza's been askin about ya`,
            `${username} in the house`,
            `bloody oath, ${username}'s here`
        ];
        
        return greetings[Math.floor(Math.random() * greetings.length)];
    }

    /**
     * Generate random greeting cooldown
     * @returns {number} - Cooldown time in milliseconds
     */
    getRandomGreetingCooldown() {
        // Random cooldown between 5-15 minutes
        return this.config.minCooldown + 
            Math.random() * (this.config.maxCooldown - this.config.minCooldown);
    }

    // cleanupDepartureTimes now handled by User Management System

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
                this.logger.warn('No room context available for sending greeting');
            }
        } catch (error) {
            this.logger.error('Failed to send greeting message', { 
                error: error.message, 
                message 
            });
        }
    }

    /**
     * Get service status and statistics
     * @returns {Object} - Service status information
     */
    getStatus() {
        return {
            ready: this.ready,
            name: 'GreetingService',
            stats: {
                recentJoins: this.recentJoins.length,
                lastGreetingTime: this.lastGreetingTime,
                nextGreetingAvailable: this.lastGreetingTime + this.greetingCooldown,
                cooldownRemaining: Math.max(0, (this.lastGreetingTime + this.greetingCooldown) - Date.now()),
                hasPendingGreeting: !!this.pendingGreeting
                // activeUsers and trackedDepartures now provided by User Management System
            }
        };
    }
}

export default GreetingService;