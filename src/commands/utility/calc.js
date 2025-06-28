import { Command } from '../base.js';

export default new Command({
    name: 'calc',
    aliases: ['calculate', 'math'],
    description: 'Simple calculator',
    usage: '!calc <expression>',
    category: 'utility',
    cooldown: 2000,
    
    async handler(bot, message, args) {
        if (!args.length) {
            bot.sendMessage('gimme some numbers to crunch mate');
            return { success: true };
        }
        
        const expression = args.join(' ');
        
        try {
            // Safe math evaluation - only allow numbers and basic operators
            const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
            
            // Check if anything was sanitized out
            if (sanitized !== expression.replace(/\s/g, '')) {
                bot.sendMessage('oi stop tryna hack me calculator ya drongo');
                return { success: true };
            }
            
            const result = Function('"use strict"; return (' + sanitized + ')')();
            
            if (!isFinite(result)) {
                bot.sendMessage('that ain\'t a real number mate, ya broke maths');
            } else if (result === 420) {
                bot.sendMessage(`${expression} = ${result} nice`);
            } else if (result === 69) {
                bot.sendMessage(`${expression} = ${result} *snickers like a schoolboy*`);
            } else if (Math.abs(result) > 1000000) {
                bot.sendMessage(`${expression} = ${result} fuckin hell that\'s a big number`);
            } else if (result === 0) {
                bot.sendMessage(`${expression} = ${result} fuck all mate`);
            } else {
                const responses = [
                    `${expression} = ${result} accordin to me half-arsed calculator`,
                    `${expression} = ${result} or somethin like that`,
                    `${expression} = ${result} if me maths is right`,
                    `${expression} = ${result} but don't quote me on that`,
                    `${expression} = ${result} *counts on fingers* yeah that's right`
                ];
                bot.sendMessage(responses[Math.floor(Math.random() * responses.length)]);
            }
        } catch (error) {
            const errorResponses = [
                'nah mate, that maths is cooked',
                'fucked up the numbers there cobber',
                'me brain can\'t handle that equation',
                'that\'s not how maths works ya galah',
                'error: too many bongs, can\'t calculate'
            ];
            bot.sendMessage(errorResponses[Math.floor(Math.random() * errorResponses.length)]);
        }
        
        return { success: true };
    }
});