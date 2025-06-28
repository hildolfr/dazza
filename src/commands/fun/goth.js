import { Command } from '../base.js';
import { toFancyText } from '../../utils/formatting.js';

export default new Command({
    name: 'goth',
    aliases: ['gothic', 'fraktur'],
    description: 'Convert text to gothic/fraktur style',
    usage: '!goth <text>',
    examples: [
        '!goth hello world - ℌ𝔢𝔩𝔩𝔬 𝔴𝔬𝔯𝔩𝔡',
        '!goth pass the bong - 𝔭𝔞𝔰𝔰 𝔱𝔥𝔢 𝔟𝔬𝔫𝔤'
    ],
    category: 'fun',
    users: ['all'],
    cooldown: 2000,

    async handler(bot, message, args) {
        if (args.length === 0) {
            bot.sendMessage('gimme some text to gothify mate');
            return { success: false };
        }

        const text = args.join(' ');
        const gothText = toFancyText(text);
        
        bot.sendMessage(gothText);
        
        return { success: true };
    }
});