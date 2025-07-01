import { Command } from '../base.js';
import { getCanonicalUsername } from '../../utils/usernameNormalizer.js';

export default new Command({
    name: 'give',
    aliases: ['transfer', 'send', 'pay'],
    description: 'Give money to another user',
    usage: '!give <username> <amount>',
    examples: [
        '!give Bob 10 - Give $10 to Bob',
        '!give Shazza 50 - Give $50 to Shazza'
    ],
    category: 'economy',
    cooldown: 5000,
    pmAccepted: true,
    
    async handler(bot, message, args) {
        try {
            if (!bot.heistManager) {
                const errorMsg = 'economy system is fucked mate, try again later';
                if (message.isPM) {
                    bot.sendPrivateMessage(message.username, errorMsg);
                } else {
                    bot.sendMessage(message.roomId, errorMsg);
                }
                return { success: false };
            }

            // Check arguments
            if (args.length < 2) {
                const errorMsg = `oi -${message.username}, usage: !give <user> <amount>`;
                if (message.isPM) {
                    bot.sendPrivateMessage(message.username, errorMsg.replace('-', ''));
                } else {
                    bot.sendMessage(message.roomId, errorMsg);
                }
                return { success: false };
            }

            const targetUser = args[0];
            const amount = parseInt(args[1]);

            // Validate amount
            if (!amount || amount < 1) {
                const errorMsg = `nah -${message.username}, gotta give at least $1 mate`;
                if (message.isPM) {
                    bot.sendPrivateMessage(message.username, errorMsg.replace('-', ''));
                } else {
                    bot.sendMessage(message.roomId, errorMsg);
                }
                return { success: false };
            }

            // Check if trying to give to self
            if (targetUser.toLowerCase() === message.username.toLowerCase()) {
                const selfMessages = [
                    `mate -${message.username}, you can't give money to yourself ya drongo`,
                    `-${message.username} trying to launder money through yourself? nice try`,
                    `oi -${message.username}, that's not how it works champion`,
                    `-${message.username} you absolute numpty, can't pay yourself`
                ];
                const selectedMsg = selfMessages[Math.floor(Math.random() * selfMessages.length)];
                if (message.isPM) {
                    bot.sendPrivateMessage(message.username, selectedMsg.replace(/-/g, ''));
                } else {
                    bot.sendMessage(message.roomId, selectedMsg);
                }
                return { success: false };
            }

            // Special handling for giving to Dazza
            if (targetUser.toLowerCase() === bot.username.toLowerCase()) {
                // Actually give the money to Dazza
                await bot.heistManager.updateUserEconomy(message.username, -amount, 0);
                await bot.heistManager.updateUserEconomy('dazza', amount, 0);
                
                // Get updated sender balance
                const newSenderBalance = await bot.heistManager.getUserBalance(message.username);
                
                let dazzaResponse;
                if (amount >= 100) {
                    // Big donation responses
                    const bigResponses = [
                        `fuckin' oath -${message.username}! $${amount} gets me a whole carton and a pack of durries! *unzips* time to show me appreciation`,
                        `$${amount}?! -${message.username} you want the full service or what? *helicopter dick commences*`,
                        `strewth -${message.username}, for $${amount} I'll even wash me balls first! top bloke!`,
                        `$${amount} from -${message.username}! that's what I call a proper reach-around fund!`,
                        `bloody legend -${message.username}! $${amount} means I can finally get that rash checked out`
                    ];
                    dazzaResponse = bigResponses[Math.floor(Math.random() * bigResponses.length)];
                } else if (amount >= 50) {
                    // Medium donation responses
                    const mediumResponses = [
                        `cheers for the $${amount} -${message.username}, that's me servo pie and handy fund sorted`,
                        `$${amount} from -${message.username}? sweet, now I can afford the good lube from woolies`,
                        `ta for the $${amount} -${message.username}, shazza charges exactly that for a gobby`,
                        `$${amount}? perfect -${message.username}, that's exactly what ya mum charges for the same thing`,
                        `nice one -${message.username}, $${amount} gets me halfway to a happy ending at the massage joint`
                    ];
                    dazzaResponse = mediumResponses[Math.floor(Math.random() * mediumResponses.length)];
                } else if (amount >= 20) {
                    // Small-medium donation responses
                    const smallMedResponses = [
                        `$${amount} from -${message.username}? that's a pack of durries and a quick tug sorted`,
                        `cheers -${message.username}, $${amount} is enough for a sneaky wristy behind the bottlo`,
                        `ta -${message.username}, $${amount} means I don't have to use me own spit tonight`,
                        `$${amount}? sweet -${message.username}, that's what I charge ya dad for pics`,
                        `nice -${message.username}, $${amount} covers me onlyfans subscription to ya sister`
                    ];
                    dazzaResponse = smallMedResponses[Math.floor(Math.random() * smallMedResponses.length)];
                } else {
                    // Small donation responses
                    const smallResponses = [
                        `$${amount} from -${message.username}? barely covers the tissues for a danger wank mate`,
                        `ta for the $${amount} -${message.username}, that's half a tuggie or a full dry hump`,
                        `$${amount}? tight arse -${message.username}, that won't even get me balls touched`,
                        `cheers -${message.username} but $${amount} only gets ya a sniff, not a taste`,
                        `$${amount} from -${message.username}? I've found more than that in me belly button`,
                        `every dollar counts -${message.username}, even if $${amount} won't get the tip wet`
                    ];
                    dazzaResponse = smallResponses[Math.floor(Math.random() * smallResponses.length)];
                }
                
                // Add balance info
                dazzaResponse += ` | Ya balance: $${newSenderBalance.balance}`;
                
                if (message.isPM) {
                    bot.sendPrivateMessage(message.username, dazzaResponse.replace(/-/g, ''));
                } else {
                    bot.sendMessage(message.roomId, dazzaResponse);
                }
                
                return { success: true };
            }

            // Get sender balance
            const senderEcon = await bot.heistManager.getUserBalance(message.username);
            if (senderEcon.balance < amount) {
                const brokeMessages = [
                    `oi -${message.username}, ya only got $${senderEcon.balance}, can't give $${amount}`,
                    `-${message.username} mate you're $${amount - senderEcon.balance} short`,
                    `check ya pockets -${message.username}, only $${senderEcon.balance} in there`,
                    `wishful thinking -${message.username}, ya need $${amount - senderEcon.balance} more`
                ];
                const selectedMsg = brokeMessages[Math.floor(Math.random() * brokeMessages.length)];
                if (message.isPM) {
                    bot.sendPrivateMessage(message.username, selectedMsg.replace(/-/g, ''));
                } else {
                    bot.sendMessage(message.roomId, selectedMsg);
                }
                return { success: false };
            }

            // Get canonical username for the target
            const properTargetUsername = await getCanonicalUsername(bot, targetUser);
            const targetOnline = Array.from(bot.userlist.values())
                .find(u => u.name.toLowerCase() === targetUser.toLowerCase());
            
            // Get target balance (this will create entry if needed)
            const targetEcon = await bot.heistManager.getUserBalance(properTargetUsername);
            
            // Perform the transfer
            await bot.heistManager.updateUserEconomy(message.username, -amount, 0);
            await bot.heistManager.updateUserEconomy(properTargetUsername, amount, 0);

            // Get updated balances
            const newSenderBalance = await bot.heistManager.getUserBalance(message.username);
            const newTargetBalance = await bot.heistManager.getUserBalance(properTargetUsername);

            // Send success message
            let successMsg;
            if (amount >= 100) {
                // Big transfer messages
                const bigMessages = [
                    `💰 FUCK ME! -${message.username} just gave -${properTargetUsername} $${amount}! What a legend!`,
                    `💰 Bloody oath! -${message.username} transferred $${amount} to -${properTargetUsername}! Big spender!`,
                    `💰 Stone the crows! -${message.username} sent -${properTargetUsername} a whopping $${amount}!`,
                    `💰 -${message.username} just made it rain! $${amount} to -${properTargetUsername}!`
                ];
                successMsg = bigMessages[Math.floor(Math.random() * bigMessages.length)];
            } else if (amount >= 50) {
                // Medium transfer messages
                const mediumMessages = [
                    `💸 -${message.username} gave -${properTargetUsername} $${amount}, not bad!`,
                    `💸 Decent! -${message.username} sent $${amount} to -${properTargetUsername}`,
                    `💸 -${message.username} hooked -${properTargetUsername} up with $${amount}`,
                    `💸 $${amount} from -${message.username} to -${properTargetUsername}, good on ya!`
                ];
                successMsg = mediumMessages[Math.floor(Math.random() * mediumMessages.length)];
            } else {
                // Small transfer messages
                const smallMessages = [
                    `✅ -${message.username} gave -${properTargetUsername} $${amount}`,
                    `✅ transferred $${amount} from -${message.username} to -${properTargetUsername}`,
                    `✅ -${message.username} sent -${properTargetUsername} $${amount}`,
                    `✅ $${amount} has gone from -${message.username} to -${properTargetUsername}`
                ];
                successMsg = smallMessages[Math.floor(Math.random() * smallMessages.length)];
            }

            // Add balance info
            successMsg += ` | Balances: ${message.username} $${newSenderBalance.balance}, ${properTargetUsername} $${newTargetBalance.balance}`;

            if (message.isPM) {
                // Remove - prefixes for PM
                bot.sendPrivateMessage(message.username, successMsg.replace(/-/g, ''));
                
                // Also notify the recipient if they're online
                if (targetOnline) {
                    bot.sendPrivateMessage(properTargetUsername, `💰 ${message.username} just sent you $${amount}! Your new balance: $${newTargetBalance.balance}`);
                }
            } else {
                bot.sendMessage(message.roomId, successMsg);
            }

            return { success: true };
            
        } catch (error) {
            bot.logger.error('Give command error:', error);
            const errorMsg = 'somethin went wrong with the transfer mate';
            if (message.isPM) {
                bot.sendPrivateMessage(message.username, errorMsg);
            } else {
                bot.sendMessage(errorMsg);
            }
            return { success: false };
        }
    }
});