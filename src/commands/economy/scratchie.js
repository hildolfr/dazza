import { Command } from '../base.js';
import { sendPM } from '../../utils/pmHelper.js';

export default new Command({
    name: 'scratchie',
    aliases: ['scratch', 'scratchies', 'lotto'],
    description: 'Buy a scratch lottery ticket',
    usage: '!scratchie [amount]',
    examples: [
        '!scratchie - Buy a $5 Lucky 7s scratchie',
        '!scratchie 20 - Buy a $20 Golden Nugget',
        '!scratchie 50 - Buy a $50 Ute Fund Deluxe',
        '!scratchie 100 - Buy a $100 Centrelink\'s Revenge'
    ],
    category: 'economy',
    users: ['all'],
    cooldown: 5000,
    cooldownMessage: 'still scratchin\' the last one with me car keys mate, gimme {time}s',
    pmAccepted: true,

    async handler(bot, message, args) {
        try {
            if (!bot.heistManager) {
                sendPM(bot, message.username, 'economy system not ready yet mate', message.roomContext || message.roomId);
                return { success: false };
            }

            const userBalance = await bot.heistManager.getUserBalance(message.username);
            
            // Default $5 scratchie
            let amount = 5;
            if (args.length > 0) {
                amount = parseInt(args[0]);
                // Only allow specific price points
                if (![5, 20, 50, 100].includes(amount)) {
                    sendPM(bot, message.username, 'scratchies only come in $5, $20, $50, or $100 mate', message.roomContext || message.roomId);
                    return { success: false };
                }
            }

            if (userBalance.balance < amount) {
                sendPM(bot, message.username, `ya need $${amount} for that scratchie mate, you've only got $${userBalance.balance}`, message.roomContext || message.roomId);
                return { success: false };
            }

            // Different scratchie types based on exact price (all with ~40% RTP / 60% house edge)
            let ticketType, odds;
            switch (amount) {
                case 5:
                    ticketType = 'Lucky 7s';
                    odds = {
                        lose: 0.85,      // 85% lose
                        small: 0.1,      // 10% win 2x
                        medium: 0.03,    // 3% win 5x
                        big: 0.015,      // 1.5% win 10x
                        jackpot: 0.005   // 0.5% win 50x
                    };
                    break;
                case 20:
                    ticketType = 'Golden Nugget';
                    odds = {
                        lose: 0.82,      // 82% lose
                        small: 0.12,     // 12% win 2x
                        medium: 0.04,    // 4% win 5x
                        big: 0.015,      // 1.5% win 20x
                        jackpot: 0.005   // 0.5% win 100x
                    };
                    break;
                case 50:
                    ticketType = 'Ute Fund Deluxe';
                    odds = {
                        lose: 0.8,       // 80% lose
                        small: 0.14,     // 14% win 1.5x
                        medium: 0.04,    // 4% win 4x
                        big: 0.015,      // 1.5% win 15x
                        jackpot: 0.005   // 0.5% win 150x
                    };
                    break;
                case 100:
                    ticketType = 'Centrelink\'s Revenge';
                    odds = {
                        lose: 0.78,      // 78% lose
                        small: 0.15,     // 15% win 1.5x
                        medium: 0.05,    // 5% win 3x
                        big: 0.015,      // 1.5% win 10x
                        jackpot: 0.005   // 0.5% win 200x
                    };
                    break;
            }

            // Deduct the cost using HeistManager for proper username handling
            await bot.heistManager.updateUserEconomy(message.username, -amount, 0);

            // Start PM with scratch animation
            sendPM(bot, message.username, `🎫 Bought a $${amount} "${ticketType}" scratchie...\n\n*scratch scratch scratch*`, message.roomContext || message.roomId);

            // Determine outcome
            const roll = Math.random();
            let winnings = 0;
            let resultMessage;

            if (roll < odds.lose) {
                // Lost
                const loseMessages = [
                    'fuck all, better luck next time',
                    'nothing, bloody ripoff',
                    'sweet fuck all mate',
                    'donuts, money down the drain',
                    'jack shit, typical'
                ];
                resultMessage = loseMessages[Math.floor(Math.random() * loseMessages.length)];
            } else if (roll < odds.lose + odds.small) {
                // Small win (2x)
                winnings = amount * 2;
                resultMessage = `winner! matched 3 beers, won $${winnings}!`;
            } else if (roll < odds.lose + odds.small + odds.medium) {
                // Medium win
                const multiplier = ticketType === 'Lucky 7s' ? 5 :
                                 ticketType === 'Golden Nugget' ? 5 :
                                 ticketType === 'Ute Fund Deluxe' ? 4 : 3;
                winnings = amount * multiplier;
                resultMessage = `fuckin beauty! matched 3 bongs, won $${winnings}!`;
            } else if (roll < odds.lose + odds.small + odds.medium + odds.big) {
                // Big win
                const multiplier = ticketType === 'Lucky 7s' ? 10 : 
                                 ticketType === 'Golden Nugget' ? 20 :
                                 ticketType === 'Ute Fund Deluxe' ? 15 : 10;
                winnings = amount * multiplier;
                resultMessage = `HOLY SHIT! matched 3 VBs, won $${winnings}!`;
            } else {
                // Jackpot!
                const multiplier = ticketType === 'Lucky 7s' ? 50 : 
                                 ticketType === 'Golden Nugget' ? 100 :
                                 ticketType === 'Ute Fund Deluxe' ? 150 : 200;
                winnings = amount * multiplier;
                resultMessage = `JACKPOT CUNT! matched 3 GOLDEN DAZZAS! WON $${winnings}!!!`;
            }

            // Add winnings if any
            if (winnings > 0) {
                // Use HeistManager for proper username handling
                await bot.heistManager.updateUserEconomy(message.username, winnings, 0);

                // Track in transactions with error handling
                try {
                    await bot.db.run(
                        'INSERT INTO economy_transactions (username, amount, transaction_type, description, room_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                        [message.username, winnings, 'scratchie', `Won ${winnings} from ${amount} bet`, message.roomId || 'fatpizza', Date.now()]
                    );
                } catch (error) {
                    bot.logger.error('Failed to log scratchie transaction:', { error: error.message, stack: error.stack });
                    // Don't fail the command just because logging failed
                }
            }

            // Send result via PM with formatted message
            setTimeout(() => {
                let pmResult = `\n🎰 RESULT: ${resultMessage}`;
                
                // Add balance info
                bot.heistManager.getUserBalance(message.username).then(newBalance => {
                    pmResult += `\n\n💰 New balance: $${newBalance.balance}`;
                    
                    // Extra excitement for big wins
                    if (winnings >= amount * 10) {
                        pmResult += `\n\n🎉 MASSIVE ${winnings / amount}x WIN! You're on fire!`;
                    }
                    
                    sendPM(bot, message.username, pmResult, message.roomContext || message.roomId);
                    
                    // Public announcement for big wins
                    if (winnings >= amount * 10) {
                        setTimeout(() => {
                            if (winnings >= amount * 50) {
                                bot.sendMessage(message.roomId, `🎰💰 HOLY FUCK! ${message.username} JUST HIT THE JACKPOT! $${winnings} ON A $${amount} SCRATCHIE! 💰🎰`);
                            } else {
                                bot.sendMessage(message.roomId, `🎉 BIG WIN! ${message.username} just won $${winnings} on a $${amount} scratchie! ${winnings / amount}x return!`);
                            }
                        }, 1000);
                    }
                });
            }, 2000);

            return { success: true };
        } catch (error) {
            bot.logger.error('Scratchie command error:', { error: error.message, stack: error.stack });
            sendPM(bot, message.username, 'scratchie machine broke mate', message.roomContext || message.roomId);
            return { success: false };
        }
    }
});