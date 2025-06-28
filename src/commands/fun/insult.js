import { Command } from '../base.js';

export default new Command({
    name: 'insult',
    aliases: ['roast', 'burn'],
    description: 'Aussie-style roasts',
    usage: '!insult [username]',
    category: 'fun',
    cooldown: 10000,
    
    async handler(bot, message, args) {
        const target = args[0] || message.username;
        
        // Check if trying to insult the bot
        if (target.toLowerCase() === bot.username.toLowerCase()) {
            const selfDefense = [
                'listen here ya cheeky cunt, I\'ll glass ya',
                'oi nah fuck off mate, I\'m not takin that',
                'pull ya head in before I do it for ya',
                'say that again and I\'ll hack ya toaster',
                'mate I\'ve got admin powers, watch it'
            ];
            bot.sendMessage(selfDefense[Math.floor(Math.random() * selfDefense.length)]);
            return { success: true };
        }
        
        const insults = [
            // Appearance-based
            `oi -${target}, ya look like a dropped pie mate`,
            `-${target} looks like they got dressed in the dark at vinnies`,
            `seen better heads on a glass of beer than -${target}'s`,
            `-${target}'s got a face like a smashed crab`,
            `if -${target} was any more inbred they'd be a sandwich`,
            `-${target} looks like they fell out the ugly tree and hit every branch`,
            
            // Intelligence-based
            `-${target}'s about as sharp as a bowling ball`,
            `the wheel's spinnin but the hamster's dead with -${target}`,
            `-${target}'s got two brain cells and they're both fightin for third place`,
            `if -${target}'s brain was dynamite, they couldn't blow their nose`,
            `-${target}'s so dense light bends around them`,
            `seen smarter things come out me dog's arse than what -${target} just said`,
            
            // General roasts
            `-${target}'s about as useful as a screen door on a submarine`,
            `I've had more interesting conversations with me stubby holder than -${target}`,
            `-${target}'s personality is drier than a dead dingo's donger`,
            `if -${target} was a spice, they'd be flour`,
            `-${target}'s about as welcome as a fart in a spacesuit`,
            `rather slam me dick in a car door than hang out with -${target}`,
            
            // Behavior-based
            `-${target} types like they're wearin boxing gloves`,
            `bet -${target}'s the type to remind the teacher about homework`,
            `-${target} probably returns their trolley at woolies for the gold coin`,
            `reckon -${target} indicates in an empty carpark`,
            `-${target} seems like they'd dob in their own nan`,
            
            // Creative ones
            `-${target}'s family tree is a straight line`,
            `if -${target} was any more full of shit, they'd need a plumber`,
            `-${target}'s about as tough as a marshmallow in the rain`,
            `seen more spine in a jellyfish than -${target}`,
            `-${target} couldn't organise a piss up in a brewery`,
            
            // Aussie-specific
            `-${target}'s got kangaroos loose in the top paddock`,
            `wouldn't trust -${target} to watch me dog`,
            `-${target}'s about as Aussie as a bloody panda`,
            `if -${target} was any slower they'd be goin backwards`,
            `-${target} couldn't fight their way out of a wet paper bag`
        ];
        
        const insult = insults[Math.floor(Math.random() * insults.length)];
        bot.sendMessage(insult);
        
        return { success: true };
    }
});