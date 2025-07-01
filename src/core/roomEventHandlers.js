import { formatDuration } from '../utils/formatting.js';
import { detectUrls } from '../utils/urlDetector.js';
import { fetchUrlTitleAndComment } from '../services/urlTitleFetcher.js';
import { extractImageUrls } from '../utils/imageDetector.js';
import { normalizeUsernameForDb } from '../utils/usernameNormalizer.js';
import { truncateMessage } from '../utils/messageValidator.js';

/**
 * Room event handler mixin for MultiRoomBot
 * These methods handle events from specific rooms
 */
export const RoomEventHandlers = {
    /**
     * Handle userlist event for a room
     */
    async handleUserlist(roomId, users) {
        const room = this.getRoom(roomId);
        if (!room) return;
        
        // Clear existing userlist
        room.userlist.clear();
        
        // Populate userlist
        for (const user of users) {
            room.userlist.set(user.name, user);
        }
        
        this.logger.info(`Received userlist for room ${roomId}: ${users.length} users`);
        
        // Update room activity
        await this.db.run('UPDATE rooms SET last_active = ? WHERE id = ?', [Date.now(), roomId]);
        
        // Handle video payout userlist update for this room
        if (this.videoPayoutManager) {
            this.videoPayoutManager.handleUserlistUpdate(roomId).catch(err =>
                this.logger.error(`Failed to update video payout userlist for room ${roomId}`, { error: err.message })
            );
        }
        
        // Emit event
        this.emit('room:userlist', { roomId, users });
    },
    
    /**
     * Handle user join event for a room
     */
    async handleUserJoin(roomId, user) {
        const room = this.getRoom(roomId);
        if (!room) return;
        
        // Don't process our own join
        if (user.name === this.username) {
            this.logger.info(`Bot joined room: ${roomId}`);
            return;
        }
        
        // Add user to room userlist
        room.userlist.set(user.name, user);
        
        // Log the join event to database
        const canonicalUsername = normalizeUsernameForDb(user.name);
        await this.db.logUserEvent(canonicalUsername, 'join', roomId);
        
        // Update user stats
        await this.db.updateUserStats(canonicalUsername);
        
        // Update room presence
        await this.db.run(`
            INSERT OR REPLACE INTO room_user_presence (room_id, username, joined_at, last_seen)
            VALUES (?, ?, ?, ?)
        `, [roomId, canonicalUsername, Date.now(), Date.now()]);
        
        this.logger.info(`User joined room ${roomId}: ${user.name}`);
        
        // Check if we should greet the user
        await this.checkAndGreetUser(roomId, user);
        
        // Handle video payout for this room
        if (this.videoPayoutManager) {
            this.videoPayoutManager.handleUserJoin(user.name, roomId).catch(err =>
                this.logger.error(`Failed to track user join for video payout in room ${roomId}`, { error: err.message, user: user.name })
            );
        }
        
        // Emit event
        this.emit('room:userJoin', { roomId, user });
    },
    
    /**
     * Handle user leave event for a room
     */
    async handleUserLeave(roomId, data) {
        const room = this.getRoom(roomId);
        if (!room) return;
        
        const username = data.name || data.username || data;
        
        // Remove user from room userlist
        room.userlist.delete(username);
        
        // Track departure time for greeting cooldown
        room.userDepartureTimes.set(username, Date.now());
        
        // Log the leave event to database
        const canonicalUsername = normalizeUsernameForDb(username);
        await this.db.logUserEvent(canonicalUsername, 'leave', roomId);
        
        // Update room presence
        await this.db.run(`
            UPDATE room_user_presence 
            SET last_seen = ? 
            WHERE room_id = ? AND username = ?
        `, [Date.now(), roomId, canonicalUsername]);
        
        this.logger.info(`User left room ${roomId}: ${username}`);
        
        // Handle video payout for this room
        if (this.videoPayoutManager) {
            this.videoPayoutManager.handleUserLeave(username, roomId).catch(err =>
                this.logger.error(`Failed to track user leave for video payout in room ${roomId}`, { error: err.message, user: username })
            );
        }
        
        // Emit event
        this.emit('room:userLeave', { roomId, username });
    },
    
    /**
     * Handle chat message for a room
     */
    async handleChatMessage(roomId, data) {
        const room = this.getRoom(roomId);
        if (!room) return;
        
        // Create unique message ID
        const messageId = `${roomId}-${data.time || Date.now()}-${data.username}`;
        
        // Check if we've already processed this message
        if (room.processedMessages.has(messageId)) {
            this.logger.debug(`Ignoring duplicate message in room ${roomId}: ${messageId}`);
            return;
        }
        
        // Check if message is too old
        const messageAge = Date.now() - (data.time || Date.now());
        if (messageAge > 30000) { // 30 seconds
            this.logger.debug(`Ignoring stale message in room ${roomId} (${messageAge}ms old)`);
            return;
        }
        
        // Mark message as processed
        room.processedMessages.add(messageId);
        
        // Clean up old processed messages
        if (room.processedMessages.size > 1000) {
            const messages = Array.from(room.processedMessages);
            room.processedMessages = new Set(messages.slice(-500));
        }
        
        // Don't process our own messages
        if (data.username === this.username) {
            return;
        }
        
        // Add to room message history
        room.addToMessageHistory(data.username, data.msg);
        
        // Log the message to database
        const canonicalUsername = normalizeUsernameForDb(data.username);
        await this.db.logMessage(canonicalUsername, data.msg, roomId);
        
        // Update room activity
        await this.db.run('UPDATE rooms SET last_active = ? WHERE id = ?', [Date.now(), roomId]);
        
        // Emit event for API
        this.emit('chat:message', {
            roomId,
            username: data.username,
            message: data.msg,
            timestamp: data.time || Date.now()
        });
        
        // Check for pending tells
        await this.checkAndDeliverTells(roomId, data.username);
        
        // Check for URLs
        await this.checkAndCommentOnUrl(roomId, data);
        
        // Check for images
        await this.checkAndStoreImages(roomId, data);
        
        // Check for mentions
        await this.checkForMentions(roomId, data);
        
        // Check if it's a command
        if (data.msg.startsWith('!')) {
            await this.handleCommand(roomId, data);
        }
    },
    
    /**
     * Handle private message for a room
     */
    async handlePrivateMessage(roomId, data) {
        this.logger.info(`PM in room ${roomId} from ${data.username}: ${data.msg}`);
        
        // Emit event for API
        this.emit('chat:message', {
            roomId,
            username: data.username,
            message: data.msg,
            timestamp: data.time || Date.now(),
            isPM: true
        });
        
        // Handle PM commands
        if (data.msg.startsWith('!')) {
            await this.handleCommand(roomId, {
                ...data,
                meta: { ...data.meta, pm: true }
            });
        }
    },
    
    /**
     * Handle media change for a room
     */
    async handleMediaChange(roomId, media) {
        const room = this.getRoom(roomId);
        if (!room) return;
        
        room.currentMedia = media;
        
        this.logger.info(`Media changed in room ${roomId}: ${media.title}`);
        
        // Handle video payout for this room
        if (this.videoPayoutManager) {
            this.videoPayoutManager.handleMediaChange(media, roomId).catch(err =>
                this.logger.error(`Failed to handle media change for video payout in room ${roomId}`, { error: err.message })
            );
        }
        
        // Emit events for other systems
        this.emit('room:mediaChange', { roomId, media });
        
        // Emit event for API
        this.emit('media:change', {
            roomId,
            media: {
                title: media.title,
                type: media.type,
                id: media.id,
                duration: media.seconds,
                url: media.meta?.direct
            }
        });
    },
    
    /**
     * Handle playlist update for a room
     */
    handlePlaylist(roomId, playlist) {
        const room = this.getRoom(roomId);
        if (!room) return;
        
        room.playlist = playlist;
        
        this.logger.debug(`Playlist updated in room ${roomId}: ${playlist.length} items`);
        
        // Emit event
        this.emit('room:playlist', { roomId, playlist });
    },
    
    /**
     * Handle playlist lock status for a room
     */
    handlePlaylistLocked(roomId, locked) {
        const room = this.getRoom(roomId);
        if (!room) return;
        
        room.playlistLocked = locked;
        
        this.logger.debug(`Playlist locked status in room ${roomId}: ${locked}`);
        
        // Emit event
        this.emit('room:playlistLocked', { roomId, locked });
    },
    
    /**
     * Handle leader change for a room
     */
    handleLeaderChange(roomId, username) {
        const room = this.getRoom(roomId);
        if (!room) return;
        
        room.leader = username;
        
        this.logger.debug(`Leader changed in room ${roomId}: ${username}`);
        
        // Emit event
        this.emit('room:leaderChange', { roomId, username });
    },
    
    /**
     * Handle queue event for a room
     */
    handleQueue(roomId, data) {
        this.logger.debug(`Queue event in room ${roomId}:`, data);
        
        // Emit general event
        this.emit('room:queue', { roomId, data });
    },
    
    /**
     * Handle delete event for a room
     */
    handleDelete(roomId, data) {
        this.logger.debug(`Delete event in room ${roomId}:`, data);
        
        // Emit event
        this.emit('room:delete', { roomId, data });
    },
    
    /**
     * Handle move video event for a room
     */
    handleMoveVideo(roomId, data) {
        this.logger.debug(`Move video event in room ${roomId}:`, data);
        
        // Emit event
        this.emit('room:moveVideo', { roomId, data });
    },
    
    /**
     * Handle command from a room
     */
    async handleCommand(roomId, data) {
        const parts = data.msg.slice(1).split(' ');
        const commandName = parts[0].toLowerCase();
        const args = parts.slice(1);
        
        await this.executeCommand(roomId, commandName, data, args);
    },
    
    /**
     * Check and greet user if appropriate
     */
    async checkAndGreetUser(roomId, user) {
        const room = this.getRoom(roomId);
        if (!room) return;
        
        // Don't greet if we're still in cooldown
        const now = Date.now();
        if (now - room.lastGreetingTime < room.greetingCooldown) {
            return;
        }
        
        // Check if user left recently (within 2 minutes)
        const departureTime = room.userDepartureTimes.get(user.name);
        if (departureTime && (now - departureTime) < 120000) {
            return;
        }
        
        // Check if we've greeted this user recently
        const lastGreeting = room.lastGreetings.get(user.name);
        if (lastGreeting && (now - lastGreeting) < 3600000) { // 1 hour
            return;
        }
        
        // Schedule greeting with random delay
        const delay = Math.floor(Math.random() * 8000) + 2000; // 2-10 seconds
        
        const timeout = setTimeout(() => {
            room.greetingTimeouts.delete(user.name);
            
            // Double-check user is still in room
            if (!room.hasUser(user.name)) {
                return;
            }
            
            // Send greeting
            const greeting = this.personality.getGreeting(user.name);
            this.sendMessage(roomId, greeting);
            
            // Update cooldowns
            room.lastGreetingTime = Date.now();
            room.lastGreetings.set(user.name, Date.now());
            
            // Set new random cooldown
            room.greetingCooldown = 300000 + Math.floor(Math.random() * 600000); // 5-15 minutes
        }, delay);
        
        room.greetingTimeouts.set(user.name, timeout);
    },
    
    /**
     * Check and deliver pending tells
     */
    async checkAndDeliverTells(roomId, username) {
        const tells = await this.db.getTellsForUser(username);
        
        for (const tell of tells) {
            const timeAgo = formatDuration(Date.now() - tell.created_at);
            this.sendMessage(roomId, 
                `Oi -${username}, -${tell.from_user} left ya a message ${timeAgo} ago: ${tell.message}`
            );
            
            // Mark tell as delivered
            await this.db.deleteTell(tell.id);
        }
    },
    
    /**
     * Check message for URLs and comment if appropriate
     */
    async checkAndCommentOnUrl(roomId, data) {
        const room = this.getRoom(roomId);
        if (!room) return;
        
        const urlResult = detectUrls(data.msg);
        if (!urlResult.hasUrls) return;
        
        // Check cooldown
        const now = Date.now();
        if (now - room.lastUrlCommentTime < room.urlCommentCooldown) {
            return;
        }
        
        // Get first URL
        const url = urlResult.urls[0];
        
        try {
            // Fetch title and get comment
            const comment = await fetchUrlTitleAndComment(url, data.username);
            
            if (comment) {
                // Send comment with random delay
                const delay = Math.floor(Math.random() * 3000) + 1000; // 1-4 seconds
                
                setTimeout(() => {
                    this.sendMessage(roomId, comment);
                    
                    // Update cooldown with random time
                    room.lastUrlCommentTime = Date.now();
                    room.urlCommentCooldown = 120000 + Math.floor(Math.random() * 780000); // 2-15 minutes
                }, delay);
            }
        } catch (error) {
            this.logger.error(`Error fetching URL in room ${roomId}:`, error);
        }
    },
    
    /**
     * Check message for images and store them
     */
    async checkAndStoreImages(roomId, data) {
        const imageUrls = extractImageUrls(data.msg);
        
        for (const url of imageUrls) {
            try {
                await this.db.addUserImage(data.username, url);
                this.logger.info(`Stored image from ${data.username} in room ${roomId}: ${url}`);
                
                // Emit event for gallery update
                this.emit('gallery:newImage', {
                    roomId,
                    username: data.username,
                    url,
                    timestamp: Date.now()
                });
            } catch (error) {
                if (!error.message?.includes('UNIQUE constraint failed')) {
                    this.logger.error(`Error storing image in room ${roomId}:`, error);
                }
            }
        }
    },
    
    /**
     * Check for mentions and respond with AI if enabled
     */
    async checkForMentions(roomId, data) {
        const room = this.getRoom(roomId);
        if (!room || !this.ollama) return;
        
        // Check if message mentions the bot
        const lowerMsg = data.msg.toLowerCase();
        const botNameLower = this.username.toLowerCase();
        
        if (!lowerMsg.includes(botNameLower) && !lowerMsg.includes('dazza')) {
            return;
        }
        
        // Check cooldown
        const now = Date.now();
        if (now - room.lastMentionTime < room.mentionCooldown) {
            return;
        }
        
        // Track mention
        room.recentMentions.set(data.username, now);
        
        // Respond with AI
        try {
            const context = room.messageHistory.slice(-5).map(m => ({
                username: m.username,
                message: m.message
            }));
            
            const response = await this.ollama.generateResponse(data.msg, context, data.username);
            
            if (response) {
                // Send response with random delay
                const delay = Math.floor(Math.random() * 2000) + 1000; // 1-3 seconds
                
                setTimeout(() => {
                    const truncated = truncateMessage(response);
                    this.sendMessage(roomId, truncated);
                    
                    // Update cooldown with random time
                    room.lastMentionTime = Date.now();
                    room.mentionCooldown = 10000 + Math.floor(Math.random() * 20000); // 10-30 seconds
                }, delay);
            }
        } catch (error) {
            this.logger.error(`Error generating AI response in room ${roomId}:`, error);
        }
    },
    
    /**
     * Get random greeting cooldown (5-15 minutes)
     */
    getRandomGreetingCooldown() {
        return 300000 + Math.floor(Math.random() * 600000);
    },
    
    /**
     * Get random URL comment cooldown (2-15 minutes)
     */
    getRandomUrlCooldown() {
        return 120000 + Math.floor(Math.random() * 780000);
    },
    
    /**
     * Get random mention cooldown (10-30 seconds)
     */
    getRandomMentionCooldown() {
        return 10000 + Math.floor(Math.random() * 20000);
    }
};

// Export as a mixin function
export function applyRoomEventHandlers(botClass) {
    Object.assign(botClass.prototype, RoomEventHandlers);
}