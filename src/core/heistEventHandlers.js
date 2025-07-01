/**
 * Heist event handler setup for MultiRoomBot
 * Sets up HeistManager event listeners with room context
 */
export function setupHeistHandlers(bot) {
    const heistManager = bot.heistManager;
    
    // Remove any existing listeners to prevent duplicates
    heistManager.removeAllListeners();
    
    // Heist announcement - send only to the specific room
    heistManager.on('announce', (data) => {
        bot.sendMessage(data.roomId, data.message);
    });
    
    // Heist departure - send only to the specific room
    heistManager.on('depart', (data) => {
        bot.sendMessage(data.roomId, data.message);
    });
    
    // Heist return - send only to the specific room
    heistManager.on('return', (data) => {
        bot.sendMessage(data.roomId, data.message);
    });
    
    // Payout announcements - send only to the specific room
    heistManager.on('payout', (data) => {
        if (data.payouts && data.payouts.length > 0) {
            const payoutMessages = data.payouts.map(p => 
                `${p.username}: $${p.amount}`
            );
            
            // Send payouts in batches to avoid spam
            const batchSize = 5;
            for (let i = 0; i < payoutMessages.length; i += batchSize) {
                const batch = payoutMessages.slice(i, i + batchSize).join(', ');
                bot.sendMessage(data.roomId, `Payouts: ${batch}`);
            }
        }
    });
    
    // Comments - send only to the specific room
    heistManager.on('comment', (data) => {
        bot.sendMessage(data.roomId, data.message);
    });
    
    // Vote registered notification (optional, for feedback)
    heistManager.on('vote_registered', (data) => {
        bot.logger.debug(`Vote registered in room ${data.roomId}: ${data.username} voted for ${data.crime}`);
    });
    
    // Resume voting after crash - send only to the specific room
    heistManager.on('resume_voting', (data) => {
        bot.sendMessage(data.roomId, "Oi looks like we had a bit of a hiccup there. Heist voting is still open for 30 more seconds!");
    });
    
    // Resume heist in progress after crash - send only to the specific room
    heistManager.on('resume_progress', (data) => {
        bot.sendMessage(data.roomId, "Right, we're back on track. The heist crew should be returning any minute now...");
    });
    
    // Track activity from all rooms
    bot.on('chat:message', (data) => {
        // data should include { roomId, username, message, timestamp }
        if (data.roomId && data.username) {
            heistManager.handleMessage(data.username, data.message, data.roomId);
        }
    });
    
    bot.logger.info('Heist event handlers configured with room support');
}

/**
 * Apply heist handlers mixin to bot class
 */
export function applyHeistHandlers(botClass) {
    // Add setupHeistHandlers method to bot prototype
    botClass.prototype.setupHeistHandlers = function() {
        setupHeistHandlers(this);
    };
}