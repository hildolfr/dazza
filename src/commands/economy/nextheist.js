import { Command } from '../base.js';

export default new Command({
    name: 'nextheist',
    aliases: ['heisttime', 'heisttimer'],
    description: 'Check when the next heist is scheduled',
    usage: '!nextheist',
    examples: [
        '!nextheist - See how long until the next heist'
    ],
    category: 'economy',
    users: ['hildolfr'],
    cooldown: 1000,

    async handler(bot, message, args) {
        try {
            // Check if HeistManager exists
            if (!bot.heistManager) {
                bot.sendMessage('heist system not initialized yet');
                return { success: false };
            }

            // Get current state
            const currentState = bot.heistManager.currentState;
            
            // If not in IDLE state, show current state info
            if (currentState !== bot.heistManager.states.IDLE) {
                bot.sendMessage(`heist currently in progress - state: ${currentState}`);
                return { success: true };
            }

            // Get next heist time from config
            const nextHeistTime = await bot.heistManager.getConfig('next_heist_time');
            
            if (!nextHeistTime) {
                bot.sendMessage('no heist scheduled yet');
                return { success: false };
            }

            const now = Date.now();
            const timeUntil = parseInt(nextHeistTime) - now;
            
            if (timeUntil <= 0) {
                bot.sendMessage('heist should trigger any moment now');
            } else {
                // Convert to human readable format
                const hours = Math.floor(timeUntil / (1000 * 60 * 60));
                const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeUntil % (1000 * 60)) / 1000);
                
                let timeStr = '';
                if (hours > 0) timeStr += `${hours}h `;
                if (minutes > 0) timeStr += `${minutes}m `;
                if (seconds > 0 || timeStr === '') timeStr += `${seconds}s`;
                
                bot.sendMessage(`next heist in: ${timeStr.trim()}`);
            }

            return { success: true };
        } catch (error) {
            bot.logger.error('Next heist command error:', error);
            bot.sendMessage('failed to check heist timer: ' + error.message);
            return { success: false };
        }
    }
});