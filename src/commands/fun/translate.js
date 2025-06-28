import { Command } from '../base.js';
import { translateToAussie } from '../../services/translator.js';

export default new Command({
    name: 'translate',
    aliases: ['trans', 'aussie'],
    description: 'Translate to Australian',
    usage: '!translate <text>',
    category: 'fun',
    cooldown: 3000,
    
    async handler(bot, message, args) {
        if (!args.length) {
            bot.sendMessage('translate what ya galah?');
            return { success: true };
        }
        
        const text = args.join(' ');
        const translated = translateToAussie(text);
        
        bot.sendMessage(`${message.username}: ${translated}`);
        
        return { success: true };
    }
});