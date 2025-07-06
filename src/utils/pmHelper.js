/**
 * Helper function for sending private messages in multi-room bot
 * Handles finding the appropriate room context when not provided
 */
export function sendPM(bot, toUser, message, roomContext) {
    // Try the bot's direct sendPM method first (for new command system)
    if (bot.sendPM) {
        try {
            bot.sendPM(toUser, message);
            return;
        } catch (error) {
            bot.logger?.error(`Failed to send PM via bot.sendPM: ${error.message}`);
        }
    }
    
    // Try the bot's sendPrivateMessage method
    if (bot.sendPrivateMessage) {
        try {
            bot.sendPrivateMessage(toUser, message);
            return;
        } catch (error) {
            bot.logger?.error(`Failed to send PM via bot.sendPrivateMessage: ${error.message}`);
        }
    }
    
    // For multi-room bot, we need to find a connected room
    if (bot.rooms && bot.rooms.size > 0) {
        let targetRoomId = null;
        
        // If roomContext is provided, extract roomId and verify it's connected
        if (roomContext) {
            const providedRoomId = typeof roomContext === 'string' ? roomContext : roomContext.roomId;
            const room = bot.rooms.get(providedRoomId);
            if (room && room.connected) {
                targetRoomId = providedRoomId;
            }
        }
        
        // If no valid room found yet, try to find a connected room where the user exists
        if (!targetRoomId) {
            for (const [roomId, room] of bot.rooms) {
                if (room.connected && room.hasUser && room.hasUser(toUser)) {
                    targetRoomId = roomId;
                    break;
                }
            }
        }
        
        // If still no room found, use the first connected room
        if (!targetRoomId) {
            for (const [roomId, room] of bot.rooms) {
                if (room.connected) {
                    targetRoomId = roomId;
                    break;
                }
            }
        }
        
        // Send PM if we found a connected room
        if (targetRoomId) {
            const room = bot.rooms.get(targetRoomId);
            if (room && room.sendPrivateMessage) {
                room.sendPrivateMessage(toUser, message);
            } else {
                bot.logger?.error(`Room ${targetRoomId} has no sendPrivateMessage method`);
            }
        } else {
            bot.logger?.warn(`Cannot send PM to ${toUser} - no connected rooms available`);
        }
    } else {
        bot.logger?.error(`No PM method available on bot and no rooms found`);
    }
}

/**
 * Helper to respond to a message, automatically choosing between PM and public
 * @param {Object} bot - The bot instance
 * @param {Object} message - The message object
 * @param {string} response - The response to send
 */
export function respond(bot, message, response) {
    if (message.isPM) {
        sendPM(bot, message.username, response, message.roomContext || message.roomId);
    } else {
        bot.sendMessage(message.roomId, response);
    }
}