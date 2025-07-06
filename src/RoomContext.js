import EventEmitter from 'events';

/**
 * RoomContext manages state and operations for a specific room
 */
class RoomContext extends EventEmitter {
    constructor(roomId, bot) {
        super();
        
        this.roomId = roomId;
        this.bot = bot;
        
        // Room-specific state
        this.userlist = new Map();
        this.currentMedia = null;
        this.playlist = [];
        this.playlistLocked = false;
        this.leader = null;
        
        // Message tracking
        this.messageHistory = [];
        this.processedMessages = new Set();
        this.recentMentions = new Map();
        
        // User tracking
        this.lastGreetings = new Map();
        this.userDepartureTimes = new Map();
        this.pendingGreetings = new Map();
        this.greetingTimeouts = new Map();
        
        // Cooldowns (room-specific)
        this.lastGreetingTime = 0;
        this.lastUrlCommentTime = 0;
        this.lastMentionTime = 0;
        this.lastAiResponseTime = 0;
        this.lastCrimeTime = 0;
        
        // Pending operations
        this.pendingTells = new Map();
        this.pendingMentions = new Map();
        
        // Connection state
        this.connected = false;
        this.authenticated = false;
        this.joinedChannel = false;
        this.connectionTime = null; // Track when we connected to ignore old messages
        
        // Stats
        this.messageCount = 0;
        this.startTime = Date.now();
    }
    
    /**
     * Get a user from the userlist
     */
    getUser(username) {
        // Case-insensitive user lookup
        const canonical = username.toLowerCase();
        for (const [name, user] of this.userlist) {
            if (name.toLowerCase() === canonical) {
                return user;
            }
        }
        return null;
    }
    
    /**
     * Check if a user is in the room
     */
    hasUser(username) {
        return this.getUser(username) !== null;
    }
    
    /**
     * Add a message to history
     */
    addToMessageHistory(username, message) {
        this.messageHistory.push({
            username,
            message,
            timestamp: Date.now()
        });
        
        // Keep only last 100 messages
        if (this.messageHistory.length > 100) {
            this.messageHistory.shift();
        }
        
        this.messageCount++;
    }
    
    /**
     * Clear non-essential caches to free memory
     */
    clearNonEssentialCaches() {
        // Clear old processed messages
        if (this.processedMessages.size > 1000) {
            const messages = Array.from(this.processedMessages);
            this.processedMessages = new Set(messages.slice(-500));
        }
        
        // Clear old message history beyond last 50
        if (this.messageHistory.length > 50) {
            this.messageHistory = this.messageHistory.slice(-50);
        }
        
        // Clear old mentions
        const now = Date.now();
        for (const [user, time] of this.recentMentions) {
            if (now - time > 3600000) { // 1 hour
                this.recentMentions.delete(user);
            }
        }
        
        // Clear old greeting times
        for (const [user, time] of this.lastGreetings) {
            if (now - time > 86400000) { // 24 hours
                this.lastGreetings.delete(user);
            }
        }
    }
    
    /**
     * Get room statistics
     */
    getStats() {
        return {
            roomId: this.roomId,
            connected: this.connected,
            authenticated: this.authenticated,
            joinedChannel: this.joinedChannel,
            userCount: this.userlist.size,
            messageCount: this.messageCount,
            uptime: Date.now() - this.startTime,
            currentMedia: this.currentMedia ? {
                title: this.currentMedia.title,
                type: this.currentMedia.type,
                duration: this.currentMedia.duration
            } : null,
            playlistLength: this.playlist.length
        };
    }
    
    /**
     * Clean up resources
     */
    cleanup() {
        // Clear all timeouts
        for (const timeout of this.greetingTimeouts.values()) {
            clearTimeout(timeout);
        }
        this.greetingTimeouts.clear();
        
        // Clear all data
        this.userlist.clear();
        this.messageHistory = [];
        this.processedMessages.clear();
        this.recentMentions.clear();
        this.lastGreetings.clear();
        this.userDepartureTimes.clear();
        this.pendingGreetings.clear();
        this.pendingTells.clear();
        this.pendingMentions.clear();
        
        // Remove all listeners
        this.removeAllListeners();
    }
}

export default RoomContext;