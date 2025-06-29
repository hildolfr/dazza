import { Command } from '../base.js';

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
                if (message.isPM) {
                    bot.sendPrivateMessage(message.username, errorMsg);
                } else {
                    bot.sendMessage(errorMsg);
                }
                return { success: false };
            }
            
            const economy = await bot.heistManager.getUserBalance(targetUser);
            
            // Only send public acknowledgment if NOT a PM
            if (!message.isPM) {
                // Public acknowledgment responses
                const publicResponses = [
                    `Checkin' the books for ya -${message.username}...`,
                    `PMing ya the balance details -${message.username}`,
                    `Slidin' into ya DMs with the financial report -${message.username}`,
                    `Check ya messages -${message.username}`,
                    `Sendin' the deets privately -${message.username}`
                ];
                
                // Send public acknowledgment
                bot.sendMessage(publicResponses[Math.floor(Math.random() * publicResponses.length)]);
            }
            
            // Format private message with balance details
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
            bot.sendPrivateMessage(message.username, pmMessage);
            
            return { success: true };
        } catch (error) {
            bot.logger.error('Balance command error:', error);
            const errorMsg = 'somethin went wrong checkin the balance';
            if (message.isPM) {
                bot.sendPrivateMessage(message.username, errorMsg);
            } else {
                bot.sendMessage(errorMsg);
            }
            return { success: false };
        }
    }
});