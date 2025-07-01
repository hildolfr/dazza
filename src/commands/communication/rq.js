import { Command } from '../base.js';
import { formatTimestamp, toFancyText } from '../../utils/formatting.js';

export default new Command({
    name: 'rq',
    description: 'Random quote from anyone',
    usage: '!rq',
    category: 'communication',
    cooldown: 600000, // 10 minutes
    
    async handler(bot, message, args) {
        try {
            const quote = await bot.db.getRandomMessage(message.roomId);
            
            if (!quote) {
                bot.sendMessage(message.roomId, 'fuck all quotes saved yet, buncha quiet cunts in here');
                return { success: true };
            }
            
            const timestamp = formatTimestamp(quote.timestamp);
            const fancyQuote = toFancyText(quote.message);
            bot.sendMessage(message.roomId, `"${fancyQuote}" - -${quote.username} (${timestamp})`);
            
            return { success: true };
        } catch (error) {
            console.error('RQ command error:', error);
            bot.sendMessage(message.roomId, bot.personality.getResponse('error'));
            return { success: false };
        }
    }
});