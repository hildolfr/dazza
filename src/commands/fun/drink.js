import { Command } from '../base.js';
import { normalizeUsernameForDb } from '../../utils/usernameNormalizer.js';

export default new Command({
    name: 'drink',
    aliases: ['beer', 'wine', 'shot', 'schooner', 'pint', 'stubby', 'tinny'],
    description: 'Have a drink with the boys',
    usage: '!drink',
    category: 'fun',
    cooldown: 300000, // 5 minutes
    cooldownMessage: 'slow down there champion, ya liver needs {time}s to process that last one',
    
    async handler(bot, message, args) {
        // Update drink counter first
        const today = new Date().toDateString();
        let newCount = 0;
        let bladderAmount = 0;
        
        try {
            // Log user drink with normalized username
            const canonicalUsername = await normalizeUsernameForDb(bot, message.username);
            await bot.db.logUserDrink(canonicalUsername, message.roomId);
            
            // Increment daily counter
            newCount = await bot.db.incrementDrinkCount(today, message.roomId);
            
            // Update bladder for pissing contest
            await bot.db.updateBladder(canonicalUsername, 1, message.roomId);
            const bladderState = await bot.db.getBladderState(canonicalUsername, message.roomId);
            bladderAmount = bladderState.current_amount;
        } catch (error) {
            bot.logger.error('Failed to update drink counter:', error);
        }
        
        // Check what type of drink was requested
        const command = message.msg.split(' ')[0].substring(1).toLowerCase();
        
        // Specific responses for different drink types
        let drinkResponses;
        
        if (command === 'wine') {
            drinkResponses = [
                `🍷 Gettin' fancy with wine number ${newCount}, pinky out cunts!`,
                `🍷 ${newCount} wines deep, feelin' like a classy bogan`,
                `🍷 *swirls goon bag* that's vintage number ${newCount}`,
                `🍷 Wine ${newCount}, straight from the hills hoist`,
                `🍷 ${newCount} glasses of chateau de cardboard`,
                `🍷 *slaps goon bag* number ${newCount} from the silver pillow`,
                `🍷 ${newCount} wines, gettin' sophisticated as fuck`,
                `🍷 Goon number ${newCount}, $4 well spent`,
                `🍷 ${newCount} cups from the cask, livin' large`
            ];
        } else if (command === 'shot') {
            drinkResponses = [
                `🥃 SHOT NUMBER ${newCount}! *slams glass*`,
                `🥃 ${newCount} shots fired! I'm fuckin' bulletproof!`,
                `🥃 *downs it* WOOOO! That's ${newCount} ya mad cunts!`,
                `🥃 Shot ${newCount}... why's me throat on fire?`,
                `🥃 ${newCount} shots deep, ready to fight God`,
                `🥃 *licks salt, shoots tequila* number ${newCount} baby!`,
                `🥃 ${newCount} shots and I can taste colors`,
                `🥃 Number ${newCount} goin' down like a rat up a drainpipe`,
                `🥃 ${newCount} shooters, me insides are pure ethanol now`
            ];
        } else if (command === 'schooner' || command === 'pint') {
            drinkResponses = [
                `🍺 ${command === 'pint' ? 'Pint' : 'Schooner'} number ${newCount} at the local`,
                `🍺 ${newCount} ${command}s deep at the pub`,
                `🍺 *raises glass* ${newCount} down at the watering hole`,
                `🍺 ${command.charAt(0).toUpperCase() + command.slice(1)} ${newCount}, good honest drinkin'`,
                `🍺 ${newCount} ${command}s, supportin' the local economy`,
                `🍺 Number ${newCount} fresh from the tap`,
                `🍺 ${newCount} ${command}s and the pokies are callin' me name`
            ];
        } else {
            // Default beer responses
            drinkResponses = [
            `🍺 That's drink number ${newCount} for today mate`,
            `🍺 ${newCount} drinks down, feelin' proper maggot`, 
            `🍺 Drink ${newCount} done, Shazza's gonna have me head`,
            `🍺 ${newCount} bevvies today, you bloody legend`,
            `🍺 Beer ${newCount} sorted, time for a dart`,
            `🍺 *cracks open a cold one* number ${newCount} down the gob`,
            `🍺 *skolls it* fuck me that's number ${newCount}`,
            `🍺 *glug glug glug* ... *burp* ... ${newCount} today, fuckin oath`,
            `🍺 Number ${newCount}... I'm already pissed as... *cracks another*`,
            `🍺 *pours a fresh schooner* number ${newCount} for you legends *downs it*`,
            `🍺 ${newCount} today already but... *shotguns another tinny*`,
            `🍺 *yells* oi Shazza! That's ${newCount}! *chugging sounds*`,
            `🍺 *hiccups* number ${newCount} went straight to me head`,
            `🍺 *cracks a stubby* ${newCount} down, yeah nah yeah that's fuckin mint`,
            `🍺 Number ${newCount}? *grabs another from the esky*`,
            `🍻 *cheers* here's to drink ${newCount} today boys`,
            `🍺 ${newCount} beers deep and still standin'... barely`,
            `🍺 *opens the bottle-o bag* that's ${newCount} today lads`,
            `🍺 *pops a VB longneck* number ${newCount}, get that up ya!`,
            `🍺 Sink number ${newCount} ya fuckin' weak cunts!`,
            `🍺 *cracks a coldie* ${newCount} frothies and countin'`,
            `🍺 Number ${newCount} goin' down faster than me dole payments`,
            `🍺 *BURRRP* farkin' ${newCount} tinnies, I'm full as a goog`,
            `🍺 ${newCount} schooners deep, time to hit the pokies`,
            `🍺 *smashes empty on forehead* THAT'S ${newCount} YA DOGS!`,
            `🍺 Number ${newCount}, gettin' on the piss proper like`,
            `🍺 *wobbles* ${newCount} bevvies... where's me thongs?`,
            `🍺 Knockin' back number ${newCount} at the bowlo`,
            `🍺 ${newCount} coldies crushed, feelin' like a mad cunt`,
            `🍺 *spills half* ah fuck it, that's still number ${newCount}`,
            `🍺 ${newCount} drinks deep and ready to fight the bouncer`,
            `🍺 Number ${newCount}... oi who moved the fuckin' floor?`,
            `🍺 *double fisting stubbies* ${newCount} down the hatch!`,
            `🍺 ${newCount} frothies, time for a tactical spew`,
            `🍺 Crushin' tinnies like a true blue Aussie - ${newCount}!`,
            `🍺 *yells at TV* ${newCount} beers and the refs are still blind cunts!`,
            `🍺 Number ${newCount}, pissed as a parrot already`,
            `🍺 ${newCount} bevvies at the RSL, livin' the dream`,
            `🍺 *stumbles* ${newCount} drinks... fuckin' gravity's broken`,
            `🍺 Sinkin' piss like it's goin' outta fashion - ${newCount}!`,
            `🍺 ${newCount} coldies, bout as drunk as a skunk in a brewery`,
            `🍺 *orders a kebab* need somethin' to soak up drink ${newCount}`,
            `🍺 ${newCount} down, time to text the ex... nah fuck it *drinks*`,
            `🍺 Number ${newCount}, gettin' absolutely munted`,
            `🍺 *air guitars* ${newCount} BEERS! ACCA DACCA! WOOO!`,
            `🍺 ${newCount} frothies deep, ready to do a nudie run`,
            `🍺 Drink ${newCount}... why's there two of ya?`,
            `🍺 *falls off stool* still counts as number ${newCount}!`,
            `🍺 ${newCount} tinnies crushed, feelin' invincible`,
            `🍺 Number ${newCount}, drunk enough to think I can sing`,
            `🍺 *slurs* shhhhazza I've only had ${newCount}... *hiccup*`,
            `🍺 ${newCount} drinks and suddenly everyone's me best mate`,
            `🍺 Beer ${newCount}, gettin' white girl wasted`,
            `🍺 *tries to light wrong end of dart* ${newCount} might be enough`,
            `🍺 ${newCount} coldies, pissed as a fart in a thunderstorm`,
            `🍺 Number ${newCount}... is it just me or is the room spinnin'?`,
            `🍺 *orders shots* fuck it, ${newCount}'s just gettin' started!`,
            `🍺 ${newCount} beers deep, time to tell everyone I love 'em`,
            `🍺 Crushin' number ${newCount} like the fuckin' champion I am`,
            `🍺 *spills on shirt* ah well, ${newCount} down anyway`,
            `🍺 ${newCount} drinks, drunk enough to think I can take Hopoate`,
            `🍺 Number ${newCount}, absolutely off me tits`,
            `🍺 *yells* WHO WANTS TO DO SHOTS? That's ${newCount} btw`,
            `🍺 ${newCount} frothies, three sheets to the fuckin' wind`
            ];
        }
        
        const response = drinkResponses[Math.floor(Math.random() * drinkResponses.length)];
        bot.sendMessage(message.roomId, response);
        
        // Special messages for milestones with more variety
        if (newCount % 50 === 0 && newCount > 0) {
            const fiftyMessages = [
                `fuckin hell lads, that's ${newCount} drinks today! someone call me a cab`,
                `${newCount} drinks! I can see through time and space`,
                `FIFTY FUCKIN' DRINKS! I'm more beer than man at this point`,
                `${newCount} bevvies deep, even me liver's impressed`,
                `half a hundy drinks! somebody check if I'm still breathin'`
            ];
            setTimeout(() => {
                bot.sendMessage(message.roomId, fiftyMessages[Math.floor(Math.random() * fiftyMessages.length)]);
            }, 2000);
        } else if (newCount % 25 === 0 && newCount > 0) {
            const twentyFiveMessages = [
                `${newCount} bevvies! me liver's cooked but we soldier on`,
                `quarter of a hundred! ${newCount} drinks and still kickin'`,
                `${newCount} coldies crushed, this is what peak performance looks like`,
                `25 drinks down! Shazza's gonna fuckin' murder me`,
                `${newCount} frothies! I'm a professional athlete... of drinkin'`
            ];
            setTimeout(() => {
                bot.sendMessage(message.roomId, twentyFiveMessages[Math.floor(Math.random() * twentyFiveMessages.length)]);
            }, 2000);
        } else if (newCount % 12 === 0 && newCount > 0) {
            const cartonMessages = [
                `that's a full carton! ${newCount} drinks and countin'`,
                `dozen down! time to crack open another slab`,
                `${newCount} drinks, that's a carton crushed ya legends`,
                `full slab demolished! onto the next one boys`,
                `12-pack annihilated! ${newCount} total, who's keepin' score?`
            ];
            setTimeout(() => {
                bot.sendMessage(message.roomId, cartonMessages[Math.floor(Math.random() * cartonMessages.length)]);
            }, 2000);
        } else if (newCount % 6 === 0 && newCount > 0) {
            const sixPackMessages = [
                `six-pack smashed! ${newCount} drinks today`,
                `${newCount} coldies, that's another sixer down`,
                `half a dozen more! total: ${newCount}`,
                `six more in the bank! ${newCount} and climbin'`
            ];
            if (Math.random() < 0.3) { // 30% chance for six-pack message
                setTimeout(() => {
                    bot.sendMessage(message.roomId, sixPackMessages[Math.floor(Math.random() * sixPackMessages.length)]);
                }, 2000);
            }
        } else if (newCount === 69) {
            setTimeout(() => {
                bot.sendMessage(message.roomId, `nice. 😏`);
            }, 2000);
        } else if (newCount === 100) {
            setTimeout(() => {
                bot.sendMessage(message.roomId, `ONE HUNDRED FUCKIN' DRINKS! CALL THE AMBOS, I'VE ACHIEVED IMMORTALITY! 🚑💀`);
            }, 2000);
        }
        
        // Add bladder fullness messages
        if (bladderAmount >= 5) {
            setTimeout(() => {
                let bladderMsg;
                if (bladderAmount >= 31) {
                    bladderMsg = "one sneeze away from pissin yaself mate";
                } else if (bladderAmount >= 21) {
                    bladderMsg = "bladder's fuller than a tick";
                } else if (bladderAmount >= 16) {
                    bladderMsg = "bout to piss meself if ya don't drain the snake soon";
                } else if (bladderAmount >= 11) {
                    bladderMsg = "gonna need to drain the snake soon";
                } else {
                    bladderMsg = "bladder's getting full mate";
                }
                bot.sendMessage(message.roomId, bladderMsg);
            }, 3500);
        }
        
        return { success: true };
    }
});