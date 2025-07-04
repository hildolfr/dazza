import { Command } from '../base.js';
import { PersistentCooldownManager } from '../../utils/persistentCooldowns.js';
import { sendPM } from '../../utils/pmHelper.js';

// Esky opening messages
const openingMessages = [
    "*lifts the mystery esky lid cautiously* here goes nothin...",
    "*kicks the esky* somethin's rattlin' around in there...",
    "*sniffs the esky suspiciously* smells like... opportunity? or death?",
    "*cracks open the mystery esky* fuck knows what's been festerin' in here",
    "*pops the lid* this better not be full of spiders again..."
];

// Small win messages ($10-50)
const smallWinMessages = [
    "found a scratched-off scratchie worth $-amount! already a winner!",
    "scored an old wallet with $-amount in it! previous owner's loss",
    "found a mason jar full of coins worth $-amount! someone's swear jar",
    "dug up a rusty tin with $-amount! some bogan's emergency stash",
    "found $-amount in notes wrapped in a VB label! classic hiding spot"
];

// Medium win messages ($51-100)
const mediumWinMessages = [
    "fuck yeah! found a Bunnings gift card worth $-amount! sausage sizzle for weeks!",
    "beauty! vintage footy cards worth $-amount! some collector's gonna want these",
    "ripper! unopened carton of winnie blues worth $-amount! black market gold",
    "bloody oath! fishing gear worth $-amount! some poor bastard's missing this",
    "decent! found a toolbox with tools worth $-amount! tradie's wet dream"
];

// Big win messages ($101-199)
const bigWinMessages = [
    "HOLY SHIT! found a signed Don Bradman cricket bat worth $-amount! collector's item!",
    "FUCK ME DEAD! vintage Holden parts worth $-amount! some cunt's gonna pay top dollar!",
    "GET FUCKED! unopened slab of VB from 1980 worth $-amount! brewery gold!",
    "YOU BEAUTY! found a tradie's lost tool belt worth $-amount! Makita everything!",
    "STREWTH! original AC/DC vinyl collection worth $-amount! rock n roll fortune!"
];

// Massive win messages ($200-1000)
const massiveWinMessages = [
    "HOLY FUCKING SHIT! found a bag of opals worth $-amount! Lightning Ridge goldmine!",
    "WHAT THE ACTUAL FUCK! vintage Torana keys and papers worth $-amount! barn find jackpot!",
    "CUNT ME DEAD! found Shane Warne's signed baggy green worth $-amount! cricket history!",
    "JESUS TITTY FUCKING CHRIST! gold nuggets worth $-amount! proper Ballarat fortune!",
    "FUCK ME SIDEWAYS! found Bob Hawke's beer glass collection worth $-amount! national treasure!"
];

// Loss messages
const lossMessages = [
    "empty esky... not even a warm XXXX",
    "nothing but melted ice and regret mate",
    "sweet fuck all, just a mouldy sausage roll",
    "empty as a bottle-o on Sunday arvo",
    "absolutely nothing but a used stubby holder"
];

// Trap messages (dangerous outcomes)
const trapMessages = [
    "FUCK! redback spider bit me hand! *ambulance to Westmead Emergency* (antivenom: $-cost)",
    "SHIT! funnel web jumped on me face! *chopper to Royal North Shore* (treatment: $-cost)",
    "CHRIST! esky full of brown snakes! *rushed to St Vincent's* (snake bite kit: $-cost)",
    "BLOODY HELL! blue-ringed octopus in there! *emergency airlift* (life support: $-cost)",
    "FUCK ME! angry drop bear attack! *mauled, needs surgery* (reconstructive surgery: $-cost)"
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

// Update mystery esky stats
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
        console.error('Failed to update mystery esky stats:', error);
    }
}

export default new Command({
    name: 'mystery_esky',
    aliases: ['mysteryesky', 'esky', 'mesky'],
    description: 'Buy a mystery esky for $80 - could contain Aussie treasures or deadly creatures!',
    usage: '!mystery_box',
    examples: [
        '!mystery_esky - Buy a mystery esky for $80'
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
                sendPM(bot, message.username, 'economy system not ready yet mate', message.roomContext || message.roomId);
                return { success: false };
            }

            const userBalance = await bot.heistManager.getUserBalance(message.username);
            const cost = 80;
            
            if (userBalance.balance < cost) {
                sendPM(bot, message.username, `ya need $${cost} for a mystery esky mate, you've only got $${userBalance.balance}`, message.roomContext || message.roomId);
                return { success: false };
            }

            // Check persistent cooldown (5 minutes)
            if (bot.db && this.persistentCooldown) {
                const cooldownManager = new PersistentCooldownManager(bot.db, bot.logger);
                const cooldownCheck = await cooldownManager.check(this.name, message.username, 300000); // 5 minutes
                
                if (!cooldownCheck.allowed) {
                    const minutes = Math.floor(cooldownCheck.remaining / 60);
                    const seconds = cooldownCheck.remaining % 60;
                    
                    sendPM(bot, message.username, `hold ya horses mate, gotta wait ${minutes}m ${seconds}s before another mystery esky`, message.roomContext || message.roomId);
                    return { success: false };
                }
            }

            // Public acknowledgment
            bot.sendMessage(message.roomId, `${message.username} bought a mystery esky for $${cost}! *watches nervously*`);

            // Deduct the cost
            await bot.heistManager.updateUserEconomy(message.username, -cost, 0);

            // Send opening message via PM
            const openingMsg = openingMessages[Math.floor(Math.random() * openingMessages.length)];
            sendPM(bot, message.username, `🎁 Mystery Esky Purchase\n\n${openingMsg}`, message.roomContext || message.roomId);

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
                    resultMessage = resultMessage.replace('-cost', hospitalCost);
                    
                    // Deduct hospital costs
                    if (hospitalCost > 0) {
                        await bot.heistManager.updateUserEconomy(message.username, -hospitalCost, 0);
                    }
                    
                    // Log trap transaction
                    if (bot.db) {
                        await bot.db.run(
                            'INSERT INTO economy_transactions (username, amount, transaction_type, description, room_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                            [message.username, -hospitalCost, 'mystery_esky', `Hospital bills from trap`, message.roomId || 'fatpizza', Date.now()]
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
                        publicAnnouncement = `🎊 MASSIVE WIN! ${message.username} just won $${winnings} from a mystery esky! 🎊`;
                    }
                    
                    // Log win transaction
                    if (bot.db) {
                        await bot.db.run(
                            'INSERT INTO economy_transactions (username, amount, transaction_type, description, room_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                            [message.username, winnings, 'mystery_esky', `Won ${winnings} from mystery esky`, message.roomId || 'fatpizza', Date.now()]
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
                
                sendPM(bot, message.username, pmResult, message.roomContext || message.roomId);
                
                // Send public announcement if applicable
                if (publicAnnouncement) {
                    setTimeout(() => {
                        bot.sendMessage(message.roomId, publicAnnouncement);
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
            bot.logger.error('Mystery box command error:', { error: error.message, stack: error.stack });
            sendPM(bot, message.username, 'mystery esky machine broke mate', message.roomContext || message.roomId);
            return { success: false };
        }
    }
});