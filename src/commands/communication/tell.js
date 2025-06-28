import { Command } from '../base.js';

export default new Command({
    name: 'tell',
    description: 'Leave a message for someone',
    usage: '!tell <username> <message>',
    category: 'communication',
    cooldown: 3000,
    pmAccepted: true,
    
    async handler(bot, message, args) {
        if (args.length < 2) {
            const msg = 'usage: !tell <username> <message>';
            if (message.pm) {
                bot.sendPrivateMessage(message.username, msg);
            } else {
                bot.sendMessage(msg);
            }
            return { success: true };
        }
        
        const targetUser = args[0];
        const tellMessage = args.slice(1).join(' ');
        
        // Check if user is trying to tell themselves
        if (targetUser.toLowerCase() === message.username.toLowerCase()) {
            const msg = 'just talk to yourself in your head mate';
            if (message.pm) {
                bot.sendPrivateMessage(message.username, msg);
            } else {
                bot.sendMessage(msg);
            }
            return { success: true };
        }
        
        // Check if user is trying to tell the bot
        if (targetUser.toLowerCase() === bot.config.bot.username.toLowerCase()) {
            const msg = 'mate I\'m not gonna talk to meself, that\'s cooked';
            if (message.pm) {
                bot.sendPrivateMessage(message.username, msg);
            } else {
                bot.sendMessage(msg);
            }
            return { success: true };
        }
        
        // Check if user is online
        const onlineUser = bot.userlist.get(targetUser.toLowerCase());
        if (onlineUser) {
            // Check if they're AFK
            if (bot.isUserAFK(targetUser)) {
                // User is AFK, proceed with saving the message
                const afkResponses = [
                    `${targetUser}'s afk right now, I'll tell 'em when they get back`,
                    `looks like ${targetUser}'s gone for a dart, I'll pass it on when they return`,
                    `${targetUser}'s away mate, probably havin a cone. I'll let 'em know`,
                    `${targetUser}'s not at their desk, I'll tell 'em when they wake up`,
                    `${targetUser}'s afk, might be on the dunny. I'll give 'em the message`
                ];
                // Don't return here - let it continue to save the message
            } else {
                // User is online and not AFK
                const responses = [
                    `mate, -${targetUser} is right there! just tell 'em yourself`,
                    `-${targetUser}'s literally in the chat ya drongo`,
                    `oi, open ya eyes, -${targetUser} is right here`, 
                    `ya blind? -${targetUser}'s been here the whole time`,
                    `-${targetUser} is sitting right there mate, have a go`,
                    `are you cooked? -${targetUser}'s in the room`,
                    `-${targetUser}'s right here ya muppet`
                ];
                const msg = responses[Math.floor(Math.random() * responses.length)];
                if (message.pm) {
                    bot.sendPrivateMessage(message.username, msg.replace('-', '')); // Remove - prefix in PMs
                } else {
                    bot.sendMessage(msg);
                }
                return { success: true };
            }
        }
        
        try {
            // Check if there's already a pending tell for this user
            const existingTells = await bot.db.getTellsForUser(targetUser);
            
            if (existingTells.length > 0) {
                const existingFrom = existingTells[0].from_user;
                const responses = [
                    `mate, I've already got a message for -${targetUser} from -${existingFrom}. one at a time ya greedy bastard`,
                    `-${targetUser}'s already got mail waiting from -${existingFrom}. tell 'em to check in first`,
                    `nah mate, -${existingFrom} beat ya to it. wait till -${targetUser} gets that one first`,
                    `I'm not a bloody answering machine! -${targetUser}'s already got one from -${existingFrom}`,
                    `oi, -${existingFrom} already left a message for -${targetUser}. wait ya turn`,
                    `can't do it mate, -${targetUser}'s inbox is full with one from -${existingFrom}`
                ];
                const msg = responses[Math.floor(Math.random() * responses.length)];
                if (message.pm) {
                    bot.sendPrivateMessage(message.username, msg.replace(/-/g, '')); // Remove all - prefixes in PMs
                } else {
                    bot.sendMessage(msg);
                }
                return { success: true };
            }
            
            // Store tell with PM flag if sent via PM
            await bot.db.addTell(message.username, targetUser, tellMessage, message.pm || false);
            
            // Only send public confirmation if not initiated via PM
            if (!message.pm) {
                // Use appropriate confirmation based on whether user is AFK or not
                if (onlineUser && bot.isUserAFK(targetUser)) {
                    const afkResponses = [
                        `-${targetUser}'s afk right now, I'll tell 'em when they get back`,
                        `looks like -${targetUser}'s gone for a dart, I'll pass it on when they return`,
                        `-${targetUser}'s away mate, probably havin a cone. I'll let 'em know`,
                        `-${targetUser}'s not at their desk, I'll tell 'em when they wake up`,
                        `-${targetUser}'s afk, might be on the dunny. I'll give 'em the message`
                    ];
                    bot.sendMessage(afkResponses[Math.floor(Math.random() * afkResponses.length)]);
                } else {
                    const confirmResponses = [
                        `no worries mate, I'll tell -${targetUser} when they rock up`,
                        `yeah alright, I'll pass that on to -${targetUser}`,
                        `I'll give -${targetUser} the message when I see 'em`,
                        `roger that, -${targetUser} will get the memo`,
                        `sweet as, I'll let -${targetUser} know`
                    ];
                    bot.sendMessage(confirmResponses[Math.floor(Math.random() * confirmResponses.length)]);
                }
            } else {
                // PM confirmation for PM-initiated tells
                bot.sendPrivateMessage(message.username, `I'll deliver your message to ${targetUser} privately when they show up`);
            }
            
            return { success: true };
        } catch (error) {
            console.error('Tell command error:', error);
            bot.sendMessage(bot.personality.getResponse('error'));
            return { success: false };
        }
    }
});