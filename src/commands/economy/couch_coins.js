import { Command } from '../base.js';
import { PersistentCooldownManager } from '../../utils/persistentCooldowns.js';

// Location descriptions for finding coins
const locations = [
    "between the crusty couch cushions",
    "under the stained armrest",
    "in the crack where shazza dropped her durries",
    "behind the cushion covered in bong water stains",
    "in the springs poking through the fabric",
    "where the dog pissed last week",
    "under the pizza box from 2019",
    "in the mysterious sticky patch",
    "between the cum-stained cushions",
    "where the VB tinnies fell down",
    "in the ashtray overflow zone",
    "under the moldy TV guide",
    "in the graveyard of lost remotes",
    "where the cat had kittens",
    "in the depths of hell (back corner)",
    "under me old undies",
    "in the sacred bong storage spot",
    "where the cockroaches nest"
];

// Success messages for different amounts
const successMessages = {
    nothing: [
        "searched every fuckin crevice but found sweet fuck all",
        "nothin but dust bunnies and old roaches mate",
        "just found shazza's old tampon... fuckin disgusting",
        "empty handed, just like me soul",
        "found a used condom but no coins. lovely.",
        "nothin but cigarette butts and regret"
    ],
    small: [ // $1-5
        "scored -amount in shrapnel",
        "found -amount in dirty coins",
        "-amount in sticky change, better than nothin",
        "couple coins worth -amount, enough for half a dart",
        "-amount in coppers, fuckin peasant money"
    ],
    medium: [ // $6-15
        "decent haul! -amount in mixed coins",
        "fuckin oath, -amount just sitting there",
        "-amount! that's a pack of mi goreng sorted",
        "beauty! -amount in forgotten change",
        "-amount score, nearly enough for a pouch"
    ],
    good: [ // $16-30
        "jackpot! -amount in the couch!",
        "fuck me dead, -amount just chillin there",
        "RIPPER! -amount in lost coins!",
        "-amount! must be me birthday",
        "holy shit, -amount in couch treasure!"
    ],
    amazing: [ // $31-50
        "FUCKIN BONANZA! -amount IN THE COUCH!!!",
        "SOMEONE CALL THE COPS, I FOUND -amount!!!",
        "HOLY MOTHER OF FUCK, -amount!!!",
        "-amount!!! THE COUCH GODS HAVE BLESSED ME!!!",
        "JACKPOT CUNT!!! -amount IN PURE COUCH GOLD!!!"
    ]
};

// Bad event messages (costs money)
const badEvents = [
    {
        message: "FUCK! redback spider bit ya hand! hospital trip cost ya -amount",
        minCost: 10,
        maxCost: 25
    },
    {
        message: "shazza caught ya rifling through HER side of the couch. -amount fine for touchin her shit",
        minCost: 5,
        maxCost: 20
    },
    {
        message: "found a syringe and stabbed yaself. tetanus shot cost -amount",
        minCost: 15,
        maxCost: 25
    },
    {
        message: "couch collapsed while searchin! had to pay -amount for a new one from vinnies",
        minCost: 10,
        maxCost: 20
    },
    {
        message: "disturbed a possum nest, little cunt bit ya. rabies shot: -amount",
        minCost: 10,
        maxCost: 25
    },
    {
        message: "found shazza's secret stash and she went mental. -amount in hush money",
        minCost: 5,
        maxCost: 15
    },
    {
        message: "allergic reaction to the mold. antihistamines cost ya -amount",
        minCost: 5,
        maxCost: 15
    },
    {
        message: "cops saw ya through the window and thought ya were burglin. -amount fine",
        minCost: 15,
        maxCost: 25
    }
];

// Desperation bonus messages
const desperationMessages = [
    "ya desperate state helped ya search harder",
    "poverty gives ya eagle eyes for coins",
    "desperation is a powerful motivator",
    "bein broke made ya check every millimeter",
    "nothin motivates like an empty wallet"
];

export default new Command({
    name: 'couch_coins',
    aliases: ['couch', 'couchsearch', 'searchcouch'],
    description: 'Search the couch for lost coins (12 hour cooldown)',
    usage: '!couch_coins',
    examples: ['!couch_coins - Dig through the couch for spare change'],
    category: 'economy',
    pmAccepted: true,
    persistentCooldown: true,
    
    async handler(bot, message, args) {
        try {
            if (!bot.heistManager) {
                const errorMsg = "couch is at the tip mate, try again later";
                if (message.isPM) {
                    bot.sendPrivateMessage(message.username, errorMsg);
                } else {
                    bot.sendMessage(message.roomId, errorMsg);
                }
                return { success: false };
            }

            // Check persistent cooldown (12 hours)
            if (bot.db && this.persistentCooldown) {
                const cooldownManager = new PersistentCooldownManager(bot.db);
                const cooldownCheck = await cooldownManager.check(this.name, message.username, 43200000); // 12 hours
                
                if (!cooldownCheck.allowed) {
                    const hours = Math.floor(cooldownCheck.remaining / 3600);
                    const minutes = Math.floor((cooldownCheck.remaining % 3600) / 60);
                    
                    const waitMessages = [
                        `oi -${message.username}, ya already ransacked the couch. wait ${hours}h ${minutes}m for it to refill`,
                        `-${message.username} the couch needs time to accumulate more coins. ${hours}h ${minutes}m left`,
                        `patience -${message.username}, can't search a barren couch. ${hours}h ${minutes}m to go`,
                        `-${message.username} give it a rest mate, ${hours}h ${minutes}m til the next search`,
                        `fuck off -${message.username}, couch is still recoverin. ${hours}h ${minutes}m remaining`
                    ];
                    
                    const selectedMsg = waitMessages[Math.floor(Math.random() * waitMessages.length)];
                    if (message.isPM) {
                        bot.sendPrivateMessage(message.username, selectedMsg.replace(/-/g, ''));
                    } else {
                        bot.sendMessage(message.roomId, selectedMsg);
                    }
                    return { success: false };
                }
            }

            // Public acknowledgment for non-PM
            if (!message.isPM) {
                const publicMessages = [
                    `-${message.username} is diggin through the couch cushions...`,
                    `-${message.username} is searchin for lost treasure in the couch`,
                    `-${message.username} has their arm deep in the couch crevices`,
                    `-${message.username} is excavating the sacred couch`
                ];
                
                bot.sendMessage(message.roomId, publicMessages[Math.floor(Math.random() * publicMessages.length)]);
            }

            // Get user's current balance for desperation check
            const userEcon = await bot.heistManager.getUserBalance(message.username);
            const isDesperate = userEcon.balance < 20;
            
            // Roll for bad event (8% base chance, 5% if desperate)
            const badEventChance = isDesperate ? 0.05 : 0.08;
            const badEventRoll = Math.random();
            
            if (badEventRoll < badEventChance) {
                // Bad event occurred
                const badEvent = badEvents[Math.floor(Math.random() * badEvents.length)];
                const cost = Math.floor(Math.random() * (badEvent.maxCost - badEvent.minCost + 1)) + badEvent.minCost;
                
                // Can't go below 0
                const actualCost = Math.min(cost, userEcon.balance);
                
                if (actualCost > 0) {
                    await bot.heistManager.updateUserEconomy(message.username, -actualCost, 0);
                    
                    let pmMessage = "❌ FUCKIN DISASTER!\n";
                    pmMessage += `📄 ${badEvent.message.replace('-amount', `$${actualCost}`)}\n\n`;
                    pmMessage += `You lost $${actualCost}. `;
                    
                    const newBalance = await bot.heistManager.getUserBalance(message.username);
                    pmMessage += `Balance: $${newBalance.balance}`;
                    
                    bot.sendPrivateMessage(message.username, pmMessage);
                    
                    // Update stats
                    if (bot.db) {
                        await bot.db.run(`
                            INSERT INTO couch_stats (username, total_dives, injuries, hospital_trips, last_played, created_at, updated_at)
                            VALUES (?, 1, 1, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                            ON CONFLICT(username) DO UPDATE SET
                                total_dives = total_dives + 1,
                                injuries = injuries + 1,
                                hospital_trips = hospital_trips + 1,
                                last_played = ?,
                                updated_at = CURRENT_TIMESTAMP
                        `, [message.username, Date.now(), Date.now()]);
                        
                        await bot.db.run(`
                            INSERT INTO economy_transactions (username, amount, transaction_type, description, created_at)
                            VALUES (?, ?, 'couch_coins', ?, ?)
                        `, [message.username, -actualCost, 'Bad event while searching', Date.now()]);
                    }
                } else {
                    // User is broke, can't charge them
                    let pmMessage = "❌ FUCKIN DISASTER!\n";
                    pmMessage += `📄 ${badEvent.message.replace('-amount', `$${cost}`)}\n\n`;
                    pmMessage += "Lucky you're broke or that woulda cost ya!";
                    
                    bot.sendPrivateMessage(message.username, pmMessage);
                    
                    // Still update search count
                    if (bot.db) {
                        await bot.db.run(`
                            INSERT INTO couch_stats (username, total_dives, last_played, created_at, updated_at)
                            VALUES (?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                            ON CONFLICT(username) DO UPDATE SET
                                total_dives = total_dives + 1,
                                last_played = ?,
                                updated_at = CURRENT_TIMESTAMP
                        `, [message.username, Date.now(), Date.now()]);
                    }
                }
                
                return { success: true };
            }

            // Determine find amount
            let amount = 0;
            const findRoll = Math.random();
            
            if (isDesperate) {
                // Better odds when desperate
                if (findRoll < 0.15) {
                    amount = 0; // 15% nothing
                } else if (findRoll < 0.25) {
                    amount = Math.floor(Math.random() * 20) + 31; // 10% for $31-50
                } else if (findRoll < 0.50) {
                    amount = Math.floor(Math.random() * 15) + 16; // 25% for $16-30
                } else if (findRoll < 0.80) {
                    amount = Math.floor(Math.random() * 10) + 6; // 30% for $6-15
                } else {
                    amount = Math.floor(Math.random() * 5) + 1; // 20% for $1-5
                }
            } else {
                // Normal odds
                if (findRoll < 0.25) {
                    amount = 0; // 25% nothing
                } else if (findRoll < 0.28) {
                    amount = Math.floor(Math.random() * 20) + 31; // 3% for $31-50
                } else if (findRoll < 0.38) {
                    amount = Math.floor(Math.random() * 15) + 16; // 10% for $16-30
                } else if (findRoll < 0.63) {
                    amount = Math.floor(Math.random() * 10) + 6; // 25% for $6-15
                } else {
                    amount = Math.floor(Math.random() * 5) + 1; // 37% for $1-5
                }
            }

            // Get location
            const location = locations[Math.floor(Math.random() * locations.length)];

            // Build response
            let pmMessage = "";
            let publicAnnouncement = null;
            
            if (amount === 0) {
                // Found nothing
                pmMessage = "❌ EMPTY HANDED!\n";
                pmMessage += `📄 Searched ${location}...\n`;
                pmMessage += successMessages.nothing[Math.floor(Math.random() * successMessages.nothing.length)];
                
                // Update stats
                if (bot.db) {
                    await bot.db.run(`
                        INSERT INTO couch_stats (username, total_dives, last_played, created_at, updated_at)
                        VALUES (?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ON CONFLICT(username) DO UPDATE SET
                            total_dives = total_dives + 1,
                            last_played = ?,
                            updated_at = CURRENT_TIMESTAMP
                    `, [message.username, Date.now(), Date.now()]);
                    
                    await bot.db.run(`
                        INSERT INTO economy_transactions (username, amount, transaction_type, description, created_at)
                        VALUES (?, 0, 'couch_coins', 'Found nothing', ?)
                    `, [message.username, Date.now()]);
                }
            } else {
                // Found money!
                await bot.heistManager.updateUserEconomy(message.username, amount, 0);
                
                let messageType;
                if (amount <= 5) {
                    messageType = 'small';
                    pmMessage = "✅ FOUND SOME SHRAPNEL!\n";
                } else if (amount <= 15) {
                    messageType = 'medium';
                    pmMessage = "✅ DECENT FIND!\n";
                } else if (amount <= 30) {
                    messageType = 'good';
                    pmMessage = "💰 RIPPER FIND!\n";
                } else {
                    messageType = 'amazing';
                    pmMessage = "🎰 COUCH JACKPOT!\n";
                    publicAnnouncement = true;
                }
                
                pmMessage += `📄 Searched ${location}...\n`;
                
                const selectedMsg = successMessages[messageType][Math.floor(Math.random() * successMessages[messageType].length)];
                pmMessage += selectedMsg.replace('-amount', `$${amount}`);
                
                if (isDesperate && amount >= 10) {
                    pmMessage += `\n\n💪 ${desperationMessages[Math.floor(Math.random() * desperationMessages.length)]}!`;
                }
                
                const newBalance = await bot.heistManager.getUserBalance(message.username);
                pmMessage += `\n\nNew balance: $${newBalance.balance}`;
                
                // Update stats
                if (bot.db) {
                    // Get current stats to check for biggest find
                    const currentStats = await bot.db.get(
                        'SELECT best_find FROM couch_stats WHERE username = ?',
                        [message.username]
                    );
                    
                    const bestFind = currentStats ? Math.max(currentStats.best_find || 0, amount) : amount;
                    
                    await bot.db.run(`
                        INSERT INTO couch_stats (username, total_dives, successful_dives, total_found, best_find, last_played, created_at, updated_at)
                        VALUES (?, 1, 1, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ON CONFLICT(username) DO UPDATE SET
                            total_dives = total_dives + 1,
                            successful_dives = successful_dives + 1,
                            total_found = total_found + ?,
                            best_find = ?,
                            last_played = ?,
                            updated_at = CURRENT_TIMESTAMP
                    `, [message.username, amount, amount, Date.now(), amount, bestFind, Date.now()]);
                    
                    await bot.db.run(`
                        INSERT INTO economy_transactions (username, amount, transaction_type, description, created_at)
                        VALUES (?, ?, 'couch_coins', ?, ?)
                    `, [message.username, amount, `Found in ${location}`, Date.now()]);
                }
                
                // Public announcement for big finds
                if (publicAnnouncement && !message.isPM) {
                    setTimeout(() => {
                        bot.sendMessage(message.roomId, `🚨 COUCH JACKPOT! ${message.username} just found $${amount} ${location}! Lucky bastard!`);
                    }, 2000);
                }
            }

            // Send PM
            bot.sendPrivateMessage(message.username, pmMessage);
            
            return { success: true };
            
        } catch (error) {
            bot.logger.error('Couch coins command error:', error);
            const errorMsg = 'couch search system fucked itself. typical.';
            if (message.isPM) {
                bot.sendPrivateMessage(message.username, errorMsg);
            } else {
                bot.sendMessage(message.roomId, errorMsg);
            }
            return { success: false };
        }
    }
});