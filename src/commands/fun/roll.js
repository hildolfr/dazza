import { Command } from '../base.js';

export default new Command({
    name: 'roll',
    aliases: ['dice'],
    description: 'Roll dice',
    usage: '!roll [XdY]',
    category: 'fun',
    cooldown: 2000,
    
    async handler(bot, message, args) {
        let dice = 1;
        let sides = 6;
        
        if (args[0]) {
            const match = args[0].match(/^(\d+)?d(\d+)$/i);
            if (match) {
                dice = parseInt(match[1]) || 1;
                sides = parseInt(match[2]);
                
                if (dice > 100 || sides > 1000) {
                    bot.sendMessage('fuck off with those massive dice');
                    return { success: true };
                }
            }
        }
        
        let total = 0;
        const rolls = [];
        
        for (let i = 0; i < dice; i++) {
            const roll = Math.floor(Math.random() * sides) + 1;
            rolls.push(roll);
            total += roll;
        }
        
        if (dice === 1) {
            bot.sendMessage(`${message.username} rolled a fuckin ${total}`);
        } else {
            bot.sendMessage(`${message.username} rolled ${rolls.join(', ')} = ${total} all up`);
        }
        
        return { success: true };
    }
});