/**
 * Helper function for sending private messages in multi-room bot
 * Handles finding the appropriate room context when not provided
 */
export function sendPM(bot, toUser, message, roomContext) {
    // If roomContext is provided, use it
    if (roomContext) {
        const roomId = typeof roomContext === 'string' ? roomContext : roomContext.roomId;
        bot.sendPrivateMessage(toUser, message, roomId);
        return;
    }
    
    // For multi-room bot, try to find a room where the user exists
    if (bot.rooms && bot.rooms.size > 0) {
        // First, try to find a room where the target user is present
        for (const [roomId, room] of bot.rooms) {
            if (room.hasUser && room.hasUser(toUser)) {
                bot.sendPrivateMessage(toUser, message, roomId);
                return;
            }
        }
        
        // If user not found in any room, use the first available room
        const firstRoomId = bot.rooms.keys().next().value;
        bot.sendPrivateMessage(toUser, message, firstRoomId);
    } else {
        // Single-room bot or fallback
        bot.sendPrivateMessage(toUser, message);
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