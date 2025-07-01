import { Command } from '../base.js';

export default new Command({
    name: 'clap',
    aliases: ['clapback', '👏'],
    description: 'Add 👏 clap 👏 emojis 👏 between 👏 words',
    usage: '!clap <text>',
    examples: [
        '!clap this is important - this 👏 is 👏 important',
        '!clap pass the bong mate - pass 👏 the 👏 bong 👏 mate'
    ],
    category: 'fun',
    users: ['all'],
    cooldown: 2000,

    async handler(bot, message, args) {
        if (args.length === 0) {
            bot.sendMessage(message.roomId, 'need 👏 some 👏 text 👏 to 👏 clap 👏 mate');
            return { success: false };
        }

        const clappedText = args.join(' 👏 ');
        
        bot.sendMessage(message.roomId, clappedText);
        
        return { success: true };
    }
});