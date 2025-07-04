import { Command } from '../base.js';
import { parseTimeString } from '../../utils/formatting.js';

export default new Command({
    name: 'remind',
    aliases: ['reminder', 'remindme'],
    description: 'Set a reminder for yourself or another user',
    usage: '!remind <time> <message> or !remind <user> <time> <message>',
    examples: [
        '!remind 5m check the oven',
        '!remind 2h take medication', 
        '!remind Bob 30m meeting time',
        '!remind dazza 1h stop smoking cones'
    ],
    category: 'communication',
    cooldown: 3000,
    
    async handler(bot, message, args) {
        if (args.length < 2) {
            bot.sendMessage(message.roomId, 'usage: !remind <time> <message> or !remind <user> <time> <message>');
            return { success: true };
        }

        let targetUser = '@me';
        let timeIndex = 0;
        
        // Check if first arg is a username (not a time string)
        // If it doesn't match a time pattern, assume it's a username
        const timePattern = /^\d+[smhd]$/i;
        if (!timePattern.test(args[0])) {
            targetUser = args[0];
            timeIndex = 1;
            
            // Make sure we have enough args when targeting another user
            if (args.length < 3) {
                bot.sendMessage(message.roomId, 'usage: !remind <time> <message> or !remind <user> <time> <message>');
                return { success: true };
            }
        }

        const timeStr = args[timeIndex];
        const reminderMessage = args.slice(timeIndex + 1).join(' ');

        if (!reminderMessage) {
            bot.sendMessage(message.roomId, 'oi what am I supposed to remind about?');
            return { success: true };
        }

        const delay = parseTimeString(timeStr);
        
        if (!delay || delay <= 0) {
            bot.sendMessage(message.roomId, 'dunno what time that is mate, try like "5m" or "2h"');
            return { success: true };
        }

        if (delay > bot.config.reminder.maxDuration) {
            bot.sendMessage(message.roomId, 'fuck off I\'m not remembering that for more than a day');
            return { success: true };
        }

        const remindAt = Date.now() + delay;
        
        try {
            await bot.db.addReminder(message.username, targetUser, reminderMessage, remindAt, message.roomId);
            
            if (targetUser === '@me') {
                const selfResponses = [
                    `righto -${message.username}, I'll remind ya in ${timeStr}`,
                    `no worries -${message.username}, I'll give ya a buzz in ${timeStr}`,
                    `yeah mate, I'll yell at ya in ${timeStr}`,
                    `sweet as -${message.username}, reminder set for ${timeStr}`,
                    `got it -${message.username}, I'll poke ya in ${timeStr}`,
                    `easy -${message.username}, I'll hassle ya in ${timeStr}`,
                    `too easy mate, I'll remind ya in ${timeStr} unless I'm on the piss`,
                    `alright -${message.username}, ${timeStr} from now I'll give ya a shout`,
                    `set a reminder on me phone... if I remember to charge it`,
                    `yeah nah I'll try remember mate, no promises after this cone`,
                    `reminders set, unless I'm passed out by then`,
                    `I'll remind ya in ${timeStr} unless shazza's got me doin chores`,
                    `${timeStr} from now I'll yell at ya, if I'm not too cooked`,
                    `wrote it on me hand in permanent marker, see ya in ${timeStr}`,
                    `reminder set for ${timeStr}, right after me next bong`,
                    `I'll remind ya mate but ${timeStr} is a long time to stay sober`,
                    `got it, I'll hassle ya in ${timeStr} like shazza hassles me for rent`,
                    `reminder locked in tighter than me balls in these boardies`,
                    `${timeStr} reminder set, that's about 3 cones from now`,
                    `I'll ping ya in ${timeStr} unless I'm balls deep in somethin`,
                    `reminder set mate, written on the back of a durrie packet`
                ];
                bot.sendMessage(message.roomId, selfResponses[Math.floor(Math.random() * selfResponses.length)]);
            } else {
                const userResponses = [
                    `yeah alright, I'll tell -${targetUser} in ${timeStr}`,
                    `no wukkas, I'll pass it on to -${targetUser} in ${timeStr}`,
                    `righto, I'll hassle -${targetUser} about it in ${timeStr}`,
                    `sweet, I'll give -${targetUser} a yell in ${timeStr}`,
                    `easy done, -${targetUser} gets the message in ${timeStr}`,
                    `got it mate, I'll bug -${targetUser} in ${timeStr}`,
                    `sure thing, I'll let -${targetUser} know in ${timeStr}`,
                    `no dramas, I'll remind -${targetUser} in ${timeStr} if they're around`,
                    `I'll nag -${targetUser} worse than me missus in ${timeStr}`,
                    `gonna hassle -${targetUser} like a debt collector in ${timeStr}`,
                    `I'll pester -${targetUser} in ${timeStr} unless they fucked off`,
                    `reminder set to annoy the shit outta -${targetUser} in ${timeStr}`,
                    `I'll harass -${targetUser} about it in ${timeStr}`,
                    `gonna remind -${targetUser} harder than shazza reminds me about child support`,
                    `I'll tell -${targetUser} in ${timeStr} if they haven't carked it`,
                    `set to bother -${targetUser} in ${timeStr} like a mozzie at night`,
                    `I'll bug -${targetUser} about it in ${timeStr}, no escape`,
                    `gonna remind -${targetUser} like I'm their disappointed mother in ${timeStr}`
                ];
                bot.sendMessage(message.roomId, userResponses[Math.floor(Math.random() * userResponses.length)]);
            }
            
            return { success: true };
        } catch (error) {
            bot.logger.error('Remind command error:', error);
            bot.sendMessage(message.roomId, bot.personality.getResponse('error'));
            return { success: false };
        }
    }
});