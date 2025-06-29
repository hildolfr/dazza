import { Command } from '../base.js';
import { PersistentCooldownManager } from '../../utils/persistentCooldowns.js';

// Box opening messages
const openingMessages = [
    "*rattles the mystery box* here goes nothin...",
    "*shakes the box violently* what's in here then?",
    "*gives the box a good shake* feels heavy...",
    "*examines the mystery box suspiciously* alright let's crack it open",
    "*takes a deep breath* fuck it, let's see what we got"
];

// Small win messages ($10-50)
const smallWinMessages = [
    "found $-amount in crumpled notes! better than nothin",
    "scored $-amount! enough for a six pack at least",
    "got $-amount mate, not bad for a mystery box",
    "sweet, $-amount! that'll do nicely",
    "$-amount in the box! small win but I'll take it"
];

// Medium win messages ($51-100)
const mediumWinMessages = [
    "fuck yeah! $-amount! that's a decent haul",
    "beauty! found $-amount in the mystery box!",
    "ripper! $-amount just sitting there waiting for me",
    "bloody oath! $-amount! worth the risk",
    "decent! pulled $-amount from the mystery box"
];

// Big win messages ($101-199)
const bigWinMessages = [
    "HOLY SHIT! $-amount! jackpot material right here!",
    "FUCK ME DEAD! $-amount in the box! I'm rich!",
    "GET FUCKED! $-amount! that's a massive score!",
    "YOU BEAUTY! $-amount! drinks are on me!",
    "STREWTH! $-amount! hit the bloody jackpot!"
];

// Massive win messages ($200-1000)
const massiveWinMessages = [
    "HOLY FUCKING SHIT! $-amount! I'M FUCKIN LOADED!",
    "WHAT THE ACTUAL FUCK! $-amount! THIS CAN'T BE REAL!",
    "CUNT ME DEAD! $-amount! I'M RETIRING!",
    "JESUS TITTY FUCKING CHRIST! $-amount! JACKPOT OF JACKPOTS!",
    "FUCK ME SIDEWAYS! $-amount! I'M BUYING THE WHOLE BOTTLE-O!"
];

// Loss messages
const lossMessages = [
    "empty box... what a fuckin ripoff",
    "nothing but dust and disappointment mate",
    "sweet fuck all in there, bloody scam",
    "empty as me wallet on centrelink day",
    "absolutely nothing, waste of $80"
];

// Trap messages (dangerous outcomes)
const trapMessages = [
    "FUCK! box exploded! *Dazza gets rushed to hospital*",
    "SHIT! poisonous spider jumped out! *ambulance sirens*",
    "CHRIST! box was full of angry wasps! *runs to emergency*",
    "BLOODY HELL! razor blades everywhere! *bleeding profusely*",
    "FUCK ME! toxic gas leak! *passes out, wakes up in hospital*"
];

// Calculate win amount based on tier
function calculateWinAmount() {
    const roll = Math.random();
    
    if (roll < 0.5) {
        // Small win (50% of wins)
        return Math.floor(Math.random() * 41) + 10; // $10-50
    } else if (roll < 0.8) {
        // Medium win (30% of wins)
        return Math.floor(Math.random() * 50) + 51; // $51-100
    } else if (roll < 0.95) {
        // Big win (15% of wins)
        return Math.floor(Math.random() * 99) + 101; // $101-199
    } else {
        // Massive win (5% of wins)
        return Math.floor(Math.random() * 801) + 200; // $200-1000
    }
}

// Update mystery box stats
async function updateStats(db, username, won, amount, wasTrap = false, wasJackpot = false) {
    try {
        // Initialize stats if user doesn't exist
        await db.run(`
            INSERT OR IGNORE INTO mystery_box_stats (username, last_played)
            VALUES (?, ?)
        `, [username, Date.now()]);
        
        // Update stats based on outcome
        if (wasTrap) {
            await db.run(`
                UPDATE mystery_box_stats 
                SET total_opens = total_opens + 1,
                    bombs_hit = bombs_hit + 1,
                    worst_loss = MAX(worst_loss, ?),
                    current_streak = 0,
                    last_played = ?
                WHERE username = ?
            `, [amount, Date.now(), username]);
        } else if (won) {
            await db.run(`
                UPDATE mystery_box_stats 
                SET total_opens = total_opens + 1,
                    total_winnings = total_winnings + ?,
                    jackpots_won = jackpots_won + ?,
                    best_win = MAX(best_win, ?),
                    current_streak = current_streak + 1,
                    best_streak = MAX(best_streak, current_streak + 1),
                    last_played = ?
                WHERE username = ?
            `, [amount, wasJackpot ? 1 : 0, amount, Date.now(), username]);
        } else {
            await db.run(`
                UPDATE mystery_box_stats 
                SET total_opens = total_opens + 1,
                    current_streak = 0,
                    last_played = ?
                WHERE username = ?
            `, [Date.now(), username]);
        }
    } catch (error) {
        console.error('Failed to update mystery box stats:', error);
    }
}

export default new Command({
    name: 'mystery_box',
    aliases: ['mysterybox', 'box', 'mbox'],
    description: 'Buy a mystery box for $80 - could contain riches or danger!',
    usage: '!mystery_box',
    examples: [
        '!mystery_box - Buy a mystery box for $80'
    ],
    category: 'economy',
    users: ['all'],
    cooldown: 5000,
    cooldownMessage: "still openin' the last box mate, gimme {time}s",
    pmAccepted: true,
    persistentCooldown: true,

    async handler(bot, message, args) {
        try {
            if (!bot.heistManager) {
                bot.sendPrivateMessage(message.username, 'economy system not ready yet mate');
                return { success: false };
            }

            const userBalance = await bot.heistManager.getUserBalance(message.username);
            const cost = 80;
            
            if (userBalance.balance < cost) {
                bot.sendPrivateMessage(message.username, `ya need $${cost} for a mystery box mate, you've only got $${userBalance.balance}`);
                return { success: false };
            }

            // Check persistent cooldown (5 minutes)
            if (bot.db && this.persistentCooldown) {
                const cooldownManager = new PersistentCooldownManager(bot.db);
                const cooldownCheck = await cooldownManager.check(this.name, message.username, 300000); // 5 minutes
                
                if (!cooldownCheck.allowed) {
                    const minutes = Math.floor(cooldownCheck.remaining / 60);
                    const seconds = cooldownCheck.remaining % 60;
                    
                    bot.sendPrivateMessage(message.username, `hold ya horses mate, gotta wait ${minutes}m ${seconds}s before another mystery box`);
                    return { success: false };
                }
            }

            // Public acknowledgment
            bot.sendMessage(`${message.username} bought a mystery box for $${cost}! *watches nervously*`);

            // Deduct the cost
            await bot.heistManager.updateUserEconomy(message.username, -cost, 0);

            // Send opening message via PM
            const openingMsg = openingMessages[Math.floor(Math.random() * openingMessages.length)];
            bot.sendPrivateMessage(message.username, `🎁 Mystery Box Purchase\n\n${openingMsg}`);

            // Determine outcome
            const roll = Math.random();
            let resultMessage;
            let publicAnnouncement = null;
            let winnings = 0;
            let hospitalCost = 0;
            let wasTrap = false;
            let wasJackpot = false;

            // Simulate opening delay
            setTimeout(async () => {
                if (roll < 0.05) {
                    // 5% chance of dangerous trap
                    wasTrap = true;
                    hospitalCost = Math.min(
                        Math.floor(Math.random() * 101), // 0-100
                        userBalance.balance - cost // Can't charge more than they have after buying
                    );
                    
                    resultMessage = trapMessages[Math.floor(Math.random() * trapMessages.length)];
                    resultMessage += `\n\n💊 Hospital bill: $${hospitalCost}`;
                    
                    // Deduct hospital costs
                    if (hospitalCost > 0) {
                        await bot.heistManager.updateUserEconomy(message.username, -hospitalCost, 0);
                    }
                    
                    // Log trap transaction
                    if (bot.db) {
                        await bot.db.run(
                            'INSERT INTO economy_transactions (username, amount, transaction_type, description, created_at) VALUES (?, ?, ?, ?, ?)',
                            [message.username, -hospitalCost, 'mystery_box', `Hospital bills from trap`, Date.now()]
                        );
                    }
                } else if (roll < 0.85) {
                    // 80% chance of loss (house odds)
                    resultMessage = lossMessages[Math.floor(Math.random() * lossMessages.length)];
                } else {
                    // 15% chance of win
                    winnings = calculateWinAmount();
                    wasJackpot = winnings >= 200;
                    
                    // Choose appropriate win message
                    let winMessage;
                    if (winnings <= 50) {
                        winMessage = smallWinMessages[Math.floor(Math.random() * smallWinMessages.length)];
                    } else if (winnings <= 100) {
                        winMessage = mediumWinMessages[Math.floor(Math.random() * mediumWinMessages.length)];
                    } else if (winnings <= 199) {
                        winMessage = bigWinMessages[Math.floor(Math.random() * bigWinMessages.length)];
                    } else {
                        winMessage = massiveWinMessages[Math.floor(Math.random() * massiveWinMessages.length)];
                    }
                    
                    resultMessage = winMessage.replace('-amount', winnings);
                    
                    // Add winnings
                    await bot.heistManager.updateUserEconomy(message.username, winnings, 0);
                    
                    // Public announcement for big wins
                    if (winnings >= 200) {
                        publicAnnouncement = `🎊 MASSIVE WIN! ${message.username} just won $${winnings} from a mystery box! 🎊`;
                    }
                    
                    // Log win transaction
                    if (bot.db) {
                        await bot.db.run(
                            'INSERT INTO economy_transactions (username, amount, transaction_type, description, created_at) VALUES (?, ?, ?, ?, ?)',
                            [message.username, winnings, 'mystery_box', `Won ${winnings} from mystery box`, Date.now()]
                        );
                    }
                }

                // Send result via PM
                const newBalance = await bot.heistManager.getUserBalance(message.username);
                let pmResult = `\n📦 RESULT: ${resultMessage}`;
                pmResult += `\n\n💰 New balance: $${newBalance.balance}`;
                
                // Add stats summary
                if (winnings > 0) {
                    const profit = winnings - cost;
                    pmResult += `\n📊 Net result: ${profit >= 0 ? '+' : ''}$${profit}`;
                } else if (wasTrap) {
                    const totalLoss = cost + hospitalCost;
                    pmResult += `\n📊 Total loss: -$${totalLoss}`;
                } else {
                    pmResult += `\n📊 Net result: -$${cost}`;
                }
                
                bot.sendPrivateMessage(message.username, pmResult);
                
                // Send public announcement if applicable
                if (publicAnnouncement) {
                    setTimeout(() => {
                        bot.sendMessage(publicAnnouncement);
                    }, 1000);
                }
                
                // Update stats
                if (bot.db) {
                    const netAmount = wasTrap ? -(cost + hospitalCost) : (winnings > 0 ? winnings - cost : -cost);
                    await updateStats(bot.db, message.username, winnings > 0, Math.abs(netAmount), wasTrap, wasJackpot);
                }
            }, 3000);

            return { success: true };
        } catch (error) {
            bot.logger.error('Mystery box command error:', error);
            bot.sendPrivateMessage(message.username, 'mystery box machine broke mate');
            return { success: false };
        }
    }
});