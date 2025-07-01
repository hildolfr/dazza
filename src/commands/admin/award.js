import { Command } from '../base.js';
import { getCanonicalUsername } from '../../utils/usernameNormalizer.js';
import { sendPM } from '../../utils/pmHelper.js';

export default new Command({
    name: 'award',
    aliases: ['givemoney', 'devpay'],
    description: 'Award money to a user (hildolfr only)',
    usage: '!award <username> <amount> [reason]',
    examples: [
        '!award Bob 100 - Give Bob $100',
        '!award dazza 50 testing - Give dazza $50 with reason "testing"',
        '!award Spazztik 1000 bug bounty - Give Spazztik $1000 for finding a bug'
    ],
    category: 'admin',
    users: ['hildolfr'], // Only hildolfr can use this
    cooldown: 1000,
    pmAccepted: true, // This command accepts PMs
    
    async handler(bot, message, args) {
        try {
            // Double-check it's hildolfr (case-insensitive)
            if (message.username.toLowerCase() !== 'hildolfr') {
                sendPM(bot, message.username, `nice try ${message.username}, but this command is for the big boss only`, message.roomContext || message.roomId);
                return { success: false };
            }
            
            // Ensure it's a PM
            if (!message.isPM) {
                sendPM(bot, message.username, 'this command only works in PMs mate', message.roomContext || message.roomId);
                return { success: false };
            }
            
            if (!bot.heistManager) {
                sendPM(bot, message.username, 'economy system is fucked mate, try again later', message.roomContext || message.roomId);
                return { success: false };
            }

            // Check arguments
            if (args.length < 2) {
                sendPM(bot, message.username, 'usage: !award <user> <amount> [reason]', message.roomContext || message.roomId);
                return { success: false };
            }

            const targetUser = args[0];
            const amount = parseInt(args[1]);
            const reason = args.slice(2).join(' ') || 'dev award';

            // Validate amount
            if (!amount || amount < 1) {
                sendPM(bot, message.username, 'amount must be a positive number mate', message.roomContext || message.roomId);
                return { success: false };
            }

            // Reasonable limit to prevent accidents
            if (amount > 100000) {
                sendPM(bot, message.username, 'steady on mate, max award is $100,000', message.roomContext || message.roomId);
                return { success: false };
            }

            // Get canonical username for the target
            const canonicalTarget = await getCanonicalUsername(bot, targetUser);
            
            // Ensure user exists in economy system
            await bot.heistManager.getOrCreateUser(canonicalTarget);
            
            // Award the money (no trust change for dev awards)
            await bot.heistManager.updateUserEconomy(canonicalTarget, amount, 0);
            
            // Get new balance
            const newBalance = await bot.heistManager.getUserBalance(canonicalTarget);
            
            // Log the transaction for accountability
            await bot.db.run(`
                INSERT INTO economy_transactions 
                (username, amount, trust_change, transaction_type, description, room_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [canonicalTarget, amount, 0, 'dev_award', `Awarded by hildolfr: ${reason}`, message.roomId || 'fatpizza', Date.now()]);
            
            // Send confirmation via PM
            let confirmMsg;
            if (targetUser.toLowerCase() === bot.username.toLowerCase()) {
                // Award to dazza
                confirmMsg = `fuckin oath boss! $${amount} in the kitty! (${reason}) | dazza's balance: $${newBalance.balance}`;
            } else {
                confirmMsg = `💰 DEV AWARD: $${amount} to ${canonicalTarget} (${reason}) | New balance: $${newBalance.balance}`;
            }
            
            // Send confirmation to admin
            sendPM(bot, message.username, confirmMsg, message.roomId);
            
            // Also notify the recipient if they're not dazza and online
            if (targetUser.toLowerCase() !== bot.username.toLowerCase()) {
                // For multi-room bot, check if user is online in any room
                let targetOnline = false;
                
                if (bot.rooms) {
                    // Multi-room bot
                    for (const [roomId, roomContext] of bot.rooms) {
                        if (roomContext.hasUser(canonicalTarget)) {
                            targetOnline = true;
                            break;
                        }
                    }
                } else if (bot.userlist) {
                    // Single-room bot (backward compatibility)
                    const onlineUsers = Array.from(bot.userlist.values());
                    targetOnline = onlineUsers.find(u => u.name.toLowerCase() === canonicalTarget.toLowerCase());
                }
                
                if (targetOnline) {
                    sendPM(bot, canonicalTarget, `💰 hildolfr awarded you $${amount}! Reason: ${reason} | Your new balance: $${newBalance.balance}`, message.roomId);
                }
            }
            
            // Log to console for tracking
            bot.logger.info(`DEV AWARD: hildolfr awarded $${amount} to ${canonicalTarget} - Reason: ${reason}`);
            
            return { success: true };
            
        } catch (error) {
            bot.logger.error('Award command error:', error);
            // Send error message
            sendPM(bot, message.username, 'somethin went wrong with the award mate', message.roomId);
            return { success: false };
        }
    }
});