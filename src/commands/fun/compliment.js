import { Command } from '../base.js';

export default new Command({
    name: 'compliment',
    aliases: ['praise', 'nice'],
    description: 'Aussie-style compliments',
    usage: '!compliment [username]',
    category: 'fun',
    cooldown: 10000,
    
    async handler(bot, message, args) {
        const target = args[0] || message.username;
        
        // Special response for complimenting the bot
        if (target.toLowerCase() === bot.username.toLowerCase()) {
            const selfLove = [
                'aww cheers mate, I do me best',
                'ya gonna make me blush cunt',
                'shut up baby I know it',
                'yeah nah I\'m pretty good ay',
                'thanks mate, have a cone on me'
            ];
            bot.sendMessage(message.roomId, selfLove[Math.floor(Math.random() * selfLove.length)]);
            return { success: true };
        }
        
        const compliments = [
            // Character compliments
            `-${target}'s a top bloke, would share me last durry with em`,
            `you're alright -${target}, I'd let ya date me sister`,
            `-${target}'s the type of legend who'd give ya the shirt off their back`,
            `if I had to pick someone to have me back in a blue, it'd be -${target}`,
            `-${target}'s a mad cunt (the good kind)`,
            `wouldn't mind havin a few tinnies with -${target}`,
            
            // Appearance compliments
            `-${target}'s lookin fresh as, must've had a shower this week`,
            `oi -${target}'s scrubbed up alright ay`,
            `-${target}'s got that natural beauty, like a sunset over the bottle-o`,
            `reckon -${target} could model for VB ads`,
            `-${target}'s smile could light up a servo at 3am`,
            
            // Intelligence compliments
            `-${target}'s got more brains than a zombie buffet`,
            `bet -${target} could explain quantum physics after 10 beers`,
            `-${target}'s sharper than a brand new stanley knife`,
            `if we were in a pub quiz, I'd want -${target} on me team`,
            `-${target}'s that smart they probably know what EFTPOS stands for`,
            
            // Skill compliments
            `-${target} could probably sink a pool ball with a cricket bat`,
            `I'd trust -${target} to reverse park me ute first go`,
            `bet -${target} never burns a snag on the barbie`,
            `-${target}'s got skills that'd make Warnie jealous`,
            `reckon -${target} could fix anything with cable ties and duct tape`,
            
            // Personality compliments
            `-${target}'s funnier than a cockatoo on pingers`,
            `hangin with -${target} is better than finding a 20 in ya old jeans`,
            `-${target}'s got more personality than a whole footy team`,
            `if -${target} was any more chill they'd be a stubby holder`,
            `-${target} brings good vibes like a fresh pack of winnie blues`,
            
            // Aussie-specific compliments
            `-${target}'s a true blue fair dinkum legend`,
            `I'd shout -${target} a parma and pot any day`,
            `-${target}'s the kind of mate who'd help ya move without askin for petrol money`,
            `trust -${target} more than me local bottlo's specials board`,
            `-${target}'s worth their weight in bunnings snags`,
            
            // Creative compliments
            `-${target}'s presence improves this chat like sauce on a pie`,
            `if -${target} was a beer, they'd be a crisp cold one on a 40 degree day`,
            `-${target}'s rarer than a quiet bogan`,
            `havin -${target} here is like findin a tenner in the pokies`,
            `-${target}'s a national treasure, like Crocodile Dundee but real`
        ];
        
        const compliment = compliments[Math.floor(Math.random() * compliments.length)];
        bot.sendMessage(message.roomId, compliment);
        
        return { success: true };
    }
});