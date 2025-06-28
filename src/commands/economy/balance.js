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

    async handler(bot, message, args) {
        try {
            // Check whose balance to show
            const targetUser = args[0] || message.username;
            
            // Get balance from HeistManager
            if (!bot.heistManager) {
                bot.sendMessage('economy system not ready yet mate');
                return { success: false };
            }
            
            const economy = await bot.heistManager.getUserBalance(targetUser);
            
            // Format response
            const responses = [
                `-${targetUser}'s got $${economy.balance} (${economy.trustLevel.title})`,
                `-${targetUser}: $${economy.balance} | Trust: ${economy.trust} (${economy.trustLevel.title})`,
                `balance for -${targetUser}: $${economy.balance}, trust level: ${economy.trustLevel.title}`,
                `-${targetUser}'s sittin on $${economy.balance}, ${economy.trustLevel.title} status`
            ];
            
            bot.sendMessage(responses[Math.floor(Math.random() * responses.length)]);
            
            return { success: true };
        } catch (error) {
            bot.logger.error('Balance command error:', error);
            bot.sendMessage('somethin went wrong checkin the balance');
            return { success: false };
        }
    }
});