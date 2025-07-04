import { Command } from '../base.js';
import { formatDuration } from '../../utils/formatting.js';

// Crude responses for when user is online
const onlineResponses = [
    `{user}'s right fuckin here ya blind cunt, probably havin a wank while we speak`,
    `{user} is here mate, can't ya see em? must be too cooked to notice`,
    `{user}'s online right now, probably tuggin one out to anime tiddies`,
    `oi {user} is literally here ya drongo, put down the bong and open ya eyes`,
    `{user}'s here mate, bet they're pantsless and three cones deep`,
    `can't miss {user}, they're here spreadin their cheeks for the whole chat`,
    `{user}'s right here probably scratchin their balls and sniffin their fingers`,
    `{user} is online ya dickhead, likely naked from the waist down as usual`,
    `{user}'s here right now, 100% got their hand down their pants`,
    `mate {user} is literally here, probably mid-wank knowin them`
];

// Crude responses for when user was seen before
const offlineResponses = [
    `{user} was last seen {time} ago, probably went for a danger wank`,
    `saw {user} about {time} ago, reckon they're passed out drunk in a gutter`,
    `{user} fucked off {time} ago, probably rootin shazza behind the servo`,
    `haven't seen {user} for {time}, bet they're havin a bat in the dunny`,
    `{user} was here {time} ago before they went to rub one out`,
    `last spotted {user} {time} ago, probably balls deep in a meat pie`,
    `{user} pissed off {time} ago, likely gettin their dick wet somewhere`,
    `saw {user} {time} ago, reckon they're face down in a kebab by now`,
    `{user} was last here {time} ago, probably went to polish the rocket`,
    `spotted {user} {time} ago before they went for a tactical wank`,
    `{user} was here {time} ago, bet they're crankin one out to fat pizza reruns`
];

// Crude responses for never seen
const neverSeenResponses = [
    `never heard of {user}, they probably too busy jerkin it to visit`,
    `{user}? sounds like a cunt who's never left their wank cave`,
    `dunno who {user} is mate, probably some virgin who's scared of us`,
    `{user}? never seen em, bet they're too busy rootin their hand`,
    `who the fuck is {user}? sounds like someone who'd root a pie`,
    `{user}? probably some drongo too cooked to find the chat`,
    `never heard of {user}, reckon they're still stuck in their mum's clunge`,
    `{user}? sounds like a soft cock who's never shown their face`,
    `dunno {user} mate, probably busy sniffin bike seats at the park`,
    `{user}? never seen that cunt, bet they're afraid we'll smell the cum stains`
];

function getRandomResponse(responses, replacements = {}) {
    const response = responses[Math.floor(Math.random() * responses.length)];
    return Object.entries(replacements).reduce((str, [key, value]) => {
        return str.replace(new RegExp(`{${key}}`, 'g'), value);
    }, response);
}

export default new Command({
    name: 'seen',
    description: 'Check when a user was last seen',
    usage: '!seen <username>',
    category: 'stats',
    cooldown: 3000,
    
    async handler(bot, message, args) {
        if (!args[0]) {
            bot.sendMessage(message.roomId, 'seen who mate?');
            return { success: true };
        }
        
        const targetUser = args[0];
        
        // Check if user is currently online in this room
        const roomUserlist = bot.getUserlistForRoom(message.roomId);
        const onlineUser = roomUserlist.get(targetUser.toLowerCase());
        if (onlineUser) {
            const response = getRandomResponse(onlineResponses, { user: targetUser });
            bot.sendMessage(message.roomId, response);
            return { success: true };
        }
        
        try {
            const stats = await bot.db.getUserStats(targetUser, message.roomId);
            
            if (!stats) {
                const response = getRandomResponse(neverSeenResponses, { user: targetUser });
                bot.sendMessage(message.roomId, response);
                return { success: true };
            }
            
            const lastSeenAgo = formatDuration(Date.now() - stats.last_seen);
            const response = getRandomResponse(offlineResponses, { 
                user: stats.username, 
                time: lastSeenAgo 
            });
            bot.sendMessage(message.roomId, response);
            
            return { success: true };
        } catch (error) {
            bot.logger.error('Seen command error:', error);
            bot.sendMessage(message.roomId, bot.personality.getResponse('error'));
            return { success: false };
        }
    }
});