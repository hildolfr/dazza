import { Command } from '../base.js';
import { sendPM } from '../../utils/pmHelper.js';

export default new Command({
    name: 'balance',
    aliases: ['bal', 'money', '$'],
    description: 'Check your balance and trust level',
    usage: '!balance [username]',
    examples: [
        '!balance - Check your own balance',
        '!balance Bob - Check Bob\'s balance'
    ],
    category: 'economy',
    users: ['all'],
    cooldown: 3000,
    pmAccepted: true,

    async handler(bot, message, args) {
        try {
            // Check whose balance to show
            const targetUser = args[0] || message.username;
            
            // Get balance from HeistManager
            if (!bot.heistManager) {
                const errorMsg = 'economy system not ready yet mate';
                // Always send via PM
                sendPM(bot, message.username, errorMsg, message.roomContext || message.roomId);
                return { success: false };
            }
            
            const economy = await bot.heistManager.getUserBalance(targetUser);
            
            // Format private message with balance details (no public acknowledgment)
            let pmMessage;
            if (targetUser.toLowerCase() === message.username.toLowerCase()) {
                // Checking own balance
                pmMessage = `Your balance: $${economy.balance}\nTrust: ${economy.trust} (${economy.trustLevel.title})`;
            } else {
                // Checking someone else's balance
                pmMessage = `-${targetUser}'s balance: $${economy.balance}\nTrust: ${economy.trust} (${economy.trustLevel.title})`;
            }
            
            // Get video stats if available
            if (bot.videoPayoutManager) {
                const videoStats = await bot.videoPayoutManager.getUserStats(targetUser);
                if (videoStats && videoStats.videos_watched > 0) {
                    pmMessage += `\n\nVideo earnings: $${videoStats.total_earned || 0} from ${videoStats.videos_watched} videos`;
                    if (videoStats.lucky_rewards > 0) {
                        pmMessage += ` (${videoStats.lucky_rewards} lucky payouts!)`;
                    }
                }
            }
            
            // Send PM with balance info
            sendPM(bot, message.username, pmMessage, message.roomContext || message.roomId);
            
            return { success: true };
        } catch (error) {
            bot.logger.error('Balance command error:', { error: error.message, stack: error.stack });
            const errorMsg = 'somethin went wrong checkin the balance';
            // Always send error via PM
            sendPM(bot, message.username, errorMsg, message.roomContext || message.roomId);
            return { success: false };
        }
    }
});