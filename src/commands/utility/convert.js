import { Command } from '../base.js';

export default new Command({
    name: 'convert',
    aliases: ['conv'],
    description: 'Unit conversion',
    usage: '!convert <value> <from> to <to>',
    category: 'utility',
    cooldown: 3000,
    
    async handler(bot, message, args) {
        if (args.length < 4 || args[2] !== 'to') {
            bot.sendMessage('usage: !convert <value> <from> to <to> (e.g., !convert 10 km to miles)');
            return { success: true };
        }
        
        const value = parseFloat(args[0]);
        const fromUnit = args[1].toLowerCase();
        const toUnit = args[3].toLowerCase();
        
        if (isNaN(value)) {
            bot.sendMessage('that ain\'t a number mate');
            return { success: true };
        }
        
        // Conversion rates
        const conversions = {
            // Length
            'km:miles': 0.621371,
            'miles:km': 1.60934,
            'm:ft': 3.28084,
            'ft:m': 0.3048,
            'cm:inches': 0.393701,
            'inches:cm': 2.54,
            
            // Weight
            'kg:lbs': 2.20462,
            'lbs:kg': 0.453592,
            'g:oz': 0.035274,
            'oz:g': 28.3495,
            
            // Temperature
            'c:f': (c) => (c * 9/5) + 32,
            'f:c': (f) => (f - 32) * 5/9,
            
            // Volume
            'l:gal': 0.264172,
            'gal:l': 3.78541,
            'ml:floz': 0.033814,
            'floz:ml': 29.5735
        };
        
        const key = `${fromUnit}:${toUnit}`;
        const conversion = conversions[key];
        
        if (!conversion) {
            bot.sendMessage('dunno how to convert that mate');
            return { success: true };
        }
        
        let result;
        if (typeof conversion === 'function') {
            result = conversion(value);
        } else {
            result = value * conversion;
        }
        
        bot.sendMessage(`${value} ${fromUnit} is like ${result.toFixed(2)} ${toUnit} or some shit`);
        
        return { success: true };
    }
});