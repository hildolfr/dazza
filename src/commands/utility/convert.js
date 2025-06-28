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
        
        // Determine unit type
        const lengthUnits = ['km', 'miles', 'm', 'ft', 'cm', 'inches'];
        const weightUnits = ['kg', 'lbs', 'g', 'oz'];
        const tempUnits = ['c', 'f'];
        const volumeUnits = ['l', 'gal', 'ml', 'floz'];
        
        let responses = [];
        
        // Length responses (dick jokes)
        if (lengthUnits.includes(fromUnit) || lengthUnits.includes(toUnit)) {
            responses = [
                `${value} ${fromUnit} is ${result.toFixed(2)} ${toUnit}... about the same as me cock on a cold day`,
                `that's ${result.toFixed(2)} ${toUnit}, or roughly 3 times bigger than yours mate`,
                `${result.toFixed(2)} ${toUnit}? that's what your missus said she needed last night`,
                `fuckin hell ${value} ${fromUnit} = ${result.toFixed(2)} ${toUnit}, still smaller than me morning wood`,
                `${result.toFixed(2)} ${toUnit}... same size as the gap between your mum's legs`,
                `yeah nah it's ${result.toFixed(2)} ${toUnit}, or about half a donger if you're blessed like me`,
                `${value} ${fromUnit} converts to ${result.toFixed(2)} ${toUnit}, unlike your dick which converts to disappointment`,
                `that's ${result.toFixed(2)} ${toUnit} of pure shaft mate`,
                `${result.toFixed(2)} ${toUnit}? that's optimistic, just like your tinder profile`,
                `comes out to ${result.toFixed(2)} ${toUnit}, still not enough to satisfy shazza`,
                `${result.toFixed(2)} ${toUnit}... same measurement your bird uses when she's "just friends" with blokes`,
                `yeah it's ${result.toFixed(2)} ${toUnit}, or one metric fuckload in bogan units`
            ];
        }
        // Weight responses (fat jokes)
        else if (weightUnits.includes(fromUnit) || weightUnits.includes(toUnit)) {
            responses = [
                `${value} ${fromUnit} = ${result.toFixed(2)} ${toUnit}, or about half your mum's left tit`,
                `that's ${result.toFixed(2)} ${toUnit} of pure lard mate`,
                `${result.toFixed(2)} ${toUnit}? that's breakfast for your missus`,
                `fuckin ${result.toFixed(2)} ${toUnit}, same as one of me beer shits`,
                `comes out to ${result.toFixed(2)} ${toUnit}, or 1/10th of your mum on a diet`,
                `${value} ${fromUnit} is ${result.toFixed(2)} ${toUnit}... lightweight compared to your ego`,
                `that's ${result.toFixed(2)} ${toUnit} of pure sex appeal (if you're into whales)`,
                `${result.toFixed(2)} ${toUnit}, about the same as your brain if we're being generous`,
                `yeah nah ${result.toFixed(2)} ${toUnit}, or one serving at maccas for you`,
                `${result.toFixed(2)} ${toUnit}? that's just the grease in your hair mate`,
                `converts to ${result.toFixed(2)} ${toUnit}, still less heavy than your balls after no nut november`,
                `${result.toFixed(2)} ${toUnit} of pure fuckin mass, unlike your dick`
            ];
        }
        // Temperature responses
        else if (tempUnits.includes(fromUnit) || tempUnits.includes(toUnit)) {
            responses = [
                `${value}° ${fromUnit} = ${result.toFixed(2)}° ${toUnit}, hotter than your sister`,
                `that's ${result.toFixed(2)}° ${toUnit}, about as cold as your missus in bed`,
                `${result.toFixed(2)}° ${toUnit}? that's the temperature of my piss after 12 beers`,
                `fuckin ${result.toFixed(2)}° ${toUnit}, perfect for shrinkage excuses`,
                `comes out to ${result.toFixed(2)}° ${toUnit}, still warmer than your personality`,
                `${value}° ${fromUnit} is ${result.toFixed(2)}° ${toUnit}... like comparing your hot takes to reality`,
                `that's ${result.toFixed(2)}° ${toUnit}, or "nipples hard enough to cut glass" weather`,
                `${result.toFixed(2)}° ${toUnit}? that's "balls stuck to me leg" temperature`,
                `yeah it's ${result.toFixed(2)}° ${toUnit}, perfect for a nude run to the bottle-o`,
                `${result.toFixed(2)}° ${toUnit}, about as hot as your chances with that sheila`,
                `converts to ${result.toFixed(2)}° ${toUnit}, still cooler than me after 50 bongs`,
                `${result.toFixed(2)}° ${toUnit}... same temp as the friction burn from your hand`
            ];
        }
        // Volume responses
        else if (volumeUnits.includes(fromUnit) || volumeUnits.includes(toUnit)) {
            responses = [
                `${value} ${fromUnit} = ${result.toFixed(2)} ${toUnit}, or about 3 pisses worth`,
                `that's ${result.toFixed(2)} ${toUnit} of pure goon mate`,
                `${result.toFixed(2)} ${toUnit}? that's me hourly beer consumption`,
                `fuckin ${result.toFixed(2)} ${toUnit}, same volume as your mum's... personality`,
                `comes out to ${result.toFixed(2)} ${toUnit}, still less than what I spilled last night`,
                `${value} ${fromUnit} is ${result.toFixed(2)} ${toUnit}... or one good nut if you're hydrated`,
                `that's ${result.toFixed(2)} ${toUnit}, perfect for drowning your sorrows`,
                `${result.toFixed(2)} ${toUnit}? that's just the precum mate`,
                `yeah nah ${result.toFixed(2)} ${toUnit}, about half a bong's worth of water`,
                `${result.toFixed(2)} ${toUnit}, same amount your bird squirts (in her dreams)`,
                `converts to ${result.toFixed(2)} ${toUnit} of liquid courage`,
                `${result.toFixed(2)} ${toUnit}... enough lube for your mum's friday night`
            ];
        }
        // Generic crude responses for any conversion
        else {
            responses = [
                `${value} ${fromUnit} is like ${result.toFixed(2)} ${toUnit} or some shit`,
                `fuckin ${result.toFixed(2)} ${toUnit} mate, do the math yourself next time`,
                `that's ${result.toFixed(2)} ${toUnit}, now fuck off`,
                `${result.toFixed(2)} ${toUnit}... about as useful as tits on a bull`,
                `yeah it's ${result.toFixed(2)} ${toUnit}, happy now cunt?`,
                `comes out to ${result.toFixed(2)} ${toUnit}, like anyone gives a shit`,
                `${value} ${fromUnit} = ${result.toFixed(2)} ${toUnit}, basic fuckin maths`,
                `that's ${result.toFixed(2)} ${toUnit} in case you can't count`,
                `${result.toFixed(2)} ${toUnit}... there's your answer dickhead`,
                `converts to ${result.toFixed(2)} ${toUnit}, now buy me a beer`,
                `${result.toFixed(2)} ${toUnit}, same IQ as you in points`,
                `yeah nah mate, it's ${result.toFixed(2)} ${toUnit} on the dot`
            ];
        }
        
        // Pick a random response
        const response = responses[Math.floor(Math.random() * responses.length)];
        bot.sendMessage(response);
        
        return { success: true };
    }
});