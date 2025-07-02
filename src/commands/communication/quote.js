import { Command } from '../base.js';
import { formatTimestamp, toFancyText } from '../../utils/formatting.js';

export default new Command({
    name: 'quote',
    aliases: ['q'],
    description: 'Random quote from specific user',
    usage: '!quote <username>',
    category: 'communication',
    cooldown: 600000, // 10 minutes
    
    async handler(bot, message, args) {
        if (!args.length) {
            bot.sendMessage(message.roomId, 'quote who mate?');
            return { success: true };
        }
        
        const targetUser = args[0];
        
        try {
            const quote = await bot.db.getUserRandomMessage(targetUser, message.roomId);
            
            if (!quote) {
                bot.sendMessage(message.roomId, `${targetUser} either never said nothin worth quotin or just spams commands like a drongo`);
                return { success: true };
            }
            
            const timestamp = formatTimestamp(quote.timestamp);
            const fancyQuote = toFancyText(quote.message);
            bot.sendMessage(message.roomId, `"${fancyQuote}" - -${quote.username} (${timestamp})`);
            
            return { success: true };
        } catch (error) {
            console.error('Quote command error:', error);
            bot.sendMessage(message.roomId, bot.personality.getResponse('error'));
            return { success: false };
        }
    }
});