import { Command } from '../base.js';
import { sendPM } from '../../utils/pmHelper.js';

export default new Command({
    name: 'pokies',
    aliases: ['slots', 'slot', 'pokie'],
    description: 'Play the pokies (slot machines)',
    usage: '!pokies <amount>',
    examples: [
        '!pokies 10 - Bet $10 on the pokies',
        '!pokies 50 - Bet $50 for bigger wins'
    ],
    category: 'economy',
    users: ['all'],
    cooldown: 3000,
    cooldownMessage: 'the pokies are still spinnin\' from ya last go mate, wait {time}s',
    pmAccepted: true,

    async handler(bot, message, args) {
        try {
            if (!bot.heistManager) {
                bot.sendMessage(message.roomId, 'pokies not plugged in yet mate');
                return { success: false };
            }

            if (args.length === 0) {
                bot.sendMessage(message.roomId, 'gotta bet somethin mate - !pokies <amount>');
                return { success: false };
            }

            const amount = parseInt(args[0]);
            if (isNaN(amount) || amount < 1) {
                bot.sendMessage(message.roomId, 'invalid bet amount ya drongo');
                return { success: false };
            }

            if (amount > 1000) {
                bot.sendMessage(message.roomId, 'max bet is $1000, this ain\'t crown casino');
                return { success: false };
            }

            const userBalance = await bot.heistManager.getUserBalance(message.username);
            
            if (userBalance.balance < amount) {
                bot.sendMessage(message.roomId, `ya need $${amount} to play mate, you've only got $${userBalance.balance}`);
                return { success: false };
            }

            // Public acknowledgment (only if not PM)
            if (!message.isPM) {
                const publicMessages = [
                    `-${message.username} chucks $${amount} into the pokies...`,
                    `oi -${message.username}'s havin a punt on the slots ($${amount})`,
                    `-${message.username} feeds $${amount} to the hungry machine`,
                    `another $${amount} from -${message.username} into the pokies`,
                    `-${message.username}'s riskin $${amount} on the one-armed bandit`
                ];
                bot.sendMessage(message.roomId, publicMessages[Math.floor(Math.random() * publicMessages.length)]);
            }
            
            // Deduct the bet using HeistManager for proper username handling
            await bot.heistManager.updateUserEconomy(message.username, -amount, 0);

            // Pokies symbols (adjusted for ~40% RTP / 60% house edge)
            const symbols = ['🍒', '🍺', '💰', '🔔', '7️⃣', '💎', '🎰'];
            const weights = [35, 30, 20, 10, 3, 1.5, 0.5]; // Weights heavily favor low symbols
            
            // Spin the reels
            const getSymbol = () => {
                const totalWeight = weights.reduce((a, b) => a + b, 0);
                let random = Math.random() * totalWeight;
                
                for (let i = 0; i < symbols.length; i++) {
                    if (random < weights[i]) {
                        return symbols[i];
                    }
                    random -= weights[i];
                }
                return symbols[0];
            };

            const reel1 = getSymbol();
            const reel2 = getSymbol();
            const reel3 = getSymbol();

            // Calculate winnings
            let winnings = 0;
            let resultLine = `${reel1} | ${reel2} | ${reel3}`;
            let outcome = '';
            let isWin = false;

            // Check for wins (reduced payouts for harsh house edge)
            if (reel1 === reel2 && reel2 === reel3) {
                // Three of a kind (reduced multipliers)
                isWin = true;
                const symbolIndex = symbols.indexOf(reel1);
                const multipliers = [2, 3, 5, 10, 25, 50, 100]; // Significantly reduced
                winnings = amount * multipliers[symbolIndex];
                
                if (reel1 === '🎰') {
                    outcome = `\n\n🎉 MEGA JACKPOT!!! 🎉\nYou won $${winnings}!\nProfit: +$${winnings - amount}`;
                } else if (reel1 === '💎' || reel1 === '7️⃣') {
                    outcome = `\n\n💰 JACKPOT! 💰\nYou won $${winnings}!\nProfit: +$${winnings - amount}`;
                } else {
                    outcome = `\n\n✅ WINNER! ✅\nThree ${reel1}s pays $${winnings}!\nProfit: +$${winnings - amount}`;
                }
            } else if (reel1 === reel2 || reel2 === reel3) {
                // Two of a kind - only on first two or last two reels
                const matchedSymbol = reel1 === reel2 ? reel1 : reel2;
                const symbolIndex = symbols.indexOf(matchedSymbol);
                // Much lower payouts for two of a kind
                const multipliers = [0.5, 0.75, 1, 1.5, 2, 3, 5]; 
                winnings = Math.floor(amount * multipliers[symbolIndex]);
                // Only pay if winning more than bet
                if (winnings > amount) {
                    isWin = true;
                    outcome = `\n\n✅ Small Win!\nTwo ${matchedSymbol}s pays $${winnings}!\nProfit: +$${winnings - amount}`;
                } else {
                    winnings = 0;
                    outcome = `\n\n❌ YOU LOST $${amount}! ❌\nTwo ${matchedSymbol}s doesn't pay enough\nBetter luck next time mate`;
                }
            } else {
                // Loss - make it very clear
                winnings = 0;
                const lossMessages = [
                    `\n\n❌ YOU LOST $${amount}! ❌\nNo matching symbols\nHouse wins again!`,
                    `\n\n❌ YOU LOST $${amount}! ❌\nBugger all mate\nThe pokies are hungry today`,
                    `\n\n❌ YOU LOST $${amount}! ❌\nInto the machine it goes\nBetter luck next spin`,
                    `\n\n❌ YOU LOST $${amount}! ❌\nNothing! Zip! Nada!\nThe house always wins`,
                    `\n\n❌ YOU LOST $${amount}! ❌\nBloody rigged machines\nTry again... if ya dare`
                ];
                outcome = lossMessages[Math.floor(Math.random() * lossMessages.length)];
            }

            // Get updated balance
            const newBalance = await bot.heistManager.getUserBalance(message.username);
            
            // Send PM with results
            const pmMessage = `🎰 POKIES RESULT 🎰\n\n${resultLine}${outcome}\n\nYour balance: $${newBalance.balance}`;
            
            sendPM(bot, message.username, pmMessage, message.roomContext || message.roomId);

            // Update balance if won
            if (winnings > 0) {
                // Use HeistManager for proper username handling
                await bot.heistManager.updateUserEconomy(message.username, winnings, 0);

                // Track in transactions with error handling
                try {
                    // Log the total win amount for leaderboards (not just profit)
                    await bot.db.run(
                        'INSERT INTO economy_transactions (username, amount, transaction_type, description, room_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                        [message.username, winnings, 'pokies', `Won $${winnings} from $${amount} bet`, message.roomId || 'fatpizza', Date.now()]
                    );
                } catch (error) {
                    bot.logger.error('Failed to log pokies transaction:', error);
                    // Don't fail the command just because logging failed
                }

                // Always announce big wins publicly (even if initiated via PM - be a bit cruel)
                if (winnings >= amount * 50) {
                    setTimeout(() => {
                        bot.sendMessage(message.roomId, `🎰💰 HOLY FUCK ${message.username} JUST HIT THE JACKPOT! $${winnings}! 💰🎰`);
                    }, 2500);
                } else if (winnings >= amount * 10) {
                    setTimeout(() => {
                        bot.sendMessage(message.roomId, `🎉 big win! ${message.username} just won $${winnings} on the pokies!`);
                    }, 2500);
                }
            } else {
                // Loss messages - add flavor comments
                if (Math.random() < 0.3) {
                    setTimeout(() => {
                        const lossReactions = [
                            `another victim of the pokies...`,
                            `the house always wins in the end`,
                            `${message.isPM ? '' : '-'}${message.username}'s donation to the RSL appreciated`,
                            `that's how they afford the fancy carpets`,
                            `pokies: 1, ${message.isPM ? '' : '-'}${message.username}: 0`
                        ];
                        const reaction = lossReactions[Math.floor(Math.random() * lossReactions.length)];
                        
                        // Send to PM if initiated via PM, otherwise public
                        if (message.isPM) {
                            sendPM(bot, message.username, reaction, message.roomContext || message.roomId);
                        } else {
                            bot.sendMessage(message.roomId, reaction);
                        }
                    }, 3000);
                }
                
                // Addiction messages for big losses
                if (amount >= 50 && Math.random() < 0.5) {
                    setTimeout(() => {
                        const bigLossMessages = [
                            'just one more spin mate...',
                            'i can feel a big win coming',
                            'the machine\'s about to pay out, i can tell',
                            'double or nothing next spin?',
                            'shoulda played the one next to it'
                        ];
                        const addictionMsg = bigLossMessages[Math.floor(Math.random() * bigLossMessages.length)];
                        
                        // Send to PM if initiated via PM, otherwise public
                        if (message.isPM) {
                            sendPM(bot, message.username, addictionMsg, message.roomContext || message.roomId);
                        } else {
                            bot.sendMessage(message.roomId, addictionMsg);
                        }
                    }, 4500);
                }
            }

            return { success: true };
        } catch (error) {
            bot.logger.error('Pokies command error:', error);
            bot.sendMessage(message.roomId, 'pokies machine tilted mate');
            return { success: false };
        }
    }
});