import { Command } from '../base.js';
import { getDefinition } from '../../services/dictionary.js';

export default new Command({
    name: 'define',
    aliases: ['def', 'urban'],
    description: 'Urban Dictionary definition',
    usage: '!define <word>',
    category: 'utility',
    cooldown: 5000,
    
    async handler(bot, message, args) {
        if (!args.length) {
            bot.sendMessage('define what mate?');
            return { success: true };
        }
        
        const word = args.join(' ');
        
        try {
            const result = await getDefinition(word);
            if (typeof result === 'object') {
                bot.sendMessage(`📖 ${word}: ${result.definition}... ${result.comment}`);
            } else {
                // Fallback for old format
                bot.sendMessage(`📖 ${word}: ${result} ...or somethin like that anyway`);
            }
            return { success: true };
        } catch (error) {
            console.error('Define error:', error);
            bot.sendMessage('never heard of that word mate, must be some fancy city talk');
            return { success: true };
        }
    }
});