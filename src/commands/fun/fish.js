import { Command } from '../base.js';
import { PersistentCooldownManager } from '../../utils/persistentCooldowns.js';
import { sendPM } from '../../utils/pmHelper.js';

// Fish types with different rarities and values
const fishTypes = {
    common: {
        names: [
            "Bream", "Flathead", "Whiting", "Mullet", "Catfish", 
            "Leather Jacket", "Toadfish", "Puffer Fish", "Garfish",
            "Dart", "Luderick", "Yellowtail", "Pike", "Flounder"
        ],
        value: { min: 1, max: 5 },
        weight: { min: 0.2, max: 2 }
    },
    uncommon: {
        names: [
            "Snapper", "Tailor", "Salmon", "Kingfish", "Trevally",
            "Mackerel", "Morwong", "Pearl Perch", "Flathead (big)",
            "John Dory", "Red Emperor", "Coral Trout"
        ],
        value: { min: 5, max: 15 },
        weight: { min: 1, max: 5 }
    },
    epic: {
        names: [
            "Giant Snapper", "King Salmon", "Trophy Barramundi", 
            "Monster Flathead", "Prize Jewfish", "Golden Perch",
            "Massive Mulloway"
        ],
        value: { min: 20, max: 50 },
        weight: { min: 5, max: 20 }
    },
    rare: {
        names: [
            "Barramundi", "Murray Cod", "Jewfish", "Spanish Mackerel",
            "Mahi Mahi", "Wahoo", "Yellowfin Tuna", "Cobia",
            "Amberjack", "Dogtooth Tuna"
        ],
        value: { min: 40, max: 80 },
        weight: { min: 8, max: 30 }
    },
    legendary: {
        names: [
            "Black Marlin", "Great White", "Tiger Shark", "Giant Trevally",
            "Bluefin Tuna", "Sailfish", "Swordfish", "Mako Shark"
        ],
        value: { min: 100, max: 200 },
        weight: { min: 20, max: 100 }
    }
};

// Trash items you might catch
const trashItems = [
    { name: "Old Boot", comment: "least it ain't crocs" },
    { name: "Shopping Trolley", comment: "from the local Woolies" },
    { name: "Goon Bag", comment: "still got a few drops left!" },
    { name: "Soggy Durry Pack", comment: "Winnie Blues, what a waste" },
    { name: "Used Condom", comment: "fuckin' hell mate" },
    { name: "Broken Bong", comment: "RIP to a fallen soldier" },
    { name: "Traffic Cone", comment: "how the fuck?" },
    { name: "Servo Pie Wrapper", comment: "probably still edible" },
    { name: "Empty VB Can", comment: "at least they drank the good stuff" },
    { name: "Thong", comment: "just the one, size 11" },
    { name: "Stolen Number Plate", comment: "QLD 420-BLZ" },
    { name: "Rusty BBQ Plate", comment: "still got snag residue" },
    { name: "Lost Phone", comment: "Nokia 3310, still works!" }
];

// Special events and treasures
const specialCatches = {
    treasure: [
        { name: "Sunken Esky Full of Cash", value: { min: 200, max: 500 }, comment: "holy shit! someone's drug money!" },
        { name: "Gold Watch", value: { min: 100, max: 300 }, comment: "probably fell off some rich cunt's yacht" },
        { name: "Antique Bottle Collection", value: { min: 150, max: 400 }, comment: "these are worth a fortune to collectors!" },
        { name: "Lost Poker Machine", value: { min: 300, max: 800 }, comment: "still got coins in it! JACKPOT!" },
        { name: "Buried Drug Stash", value: { min: 400, max: 1000 }, comment: "better not tell the cops about this one..." }
    ],
    multiCatch: [
        { name: "School of Whiting", multiplier: 5, comment: "caught 5 at once!" },
        { name: "Bream Bonanza", multiplier: 7, comment: "7 fish on one line!" },
        { name: "Flathead Frenzy", multiplier: 4, comment: "4 flatties in one go!" }
    ],
    rareBait: [
        { name: "Magic Berley", comment: "attracts everything!", effect: "nextCatchBonus" },
        { name: "Golden Hook", comment: "legendary fishing gear!", effect: "doubleMoney" },
        { name: "Ancient Lure", comment: "the fish can't resist!", effect: "guaranteedRare" }
    ]
};

// Fishing spots with different catch rates
const fishingSpots = [
    { name: "Local Creek", quality: 0.7, description: "behind the bottlo" },
    { name: "Council Pond", quality: 0.6, description: "next to the skate park" },
    { name: "River", quality: 0.8, description: "under the bridge" },
    { name: "Beach", quality: 0.9, description: "near the surf club" },
    { name: "Jetty", quality: 0.85, description: "at the boat ramp" },
    { name: "Rock Pool", quality: 0.75, description: "down by the point" },
    { name: "Storm Drain", quality: 0.5, description: "dodgy but sometimes lucky" },
    { name: "Harbor", quality: 0.95, description: "where the big boats are" },
    { name: "Secret Spot", quality: 1.0, description: "Davo's special place" }
];

// Bait types affect catch chances
const baitTypes = {
    worm: { bonus: 1.00, cost: 0 },      // Baseline, free
    ciggie_butt: { bonus: 0.97, cost: 0 }, // 3% worse but free
    servo_pie: { bonus: 1.01, cost: 5 },   // 1% better
    lure: { bonus: 1.02, cost: 15 },      // 2% better
    prawn: { bonus: 1.024, cost: 25 },    // 2.4% better
    squid: { bonus: 1.03, cost: 40 }       // 3% better (best)
};

export default new Command({
    name: 'fish',
    aliases: ['fishing', 'cast'],
    description: 'Go fishing and see what you catch',
    usage: '!fish [bait]',
    examples: [
        '!fish - Fish with a worm (free)',
        '!fish prawn - Use a prawn as bait ($2)',
        '!fish squid - Use squid bait ($3)'
    ],
    category: 'fun',
    cooldown: 7200000, // 2 hour cooldown
    cooldownMessage: 'nah mate the cops are still at the pond checkin\' fishing licences, try again in {time}s',
    pmAccepted: true,
    persistentCooldown: true, // Enable persistent cooldown
    
    async handler(bot, message, args) {
        try {
            // Check persistent cooldown if database is available
            if (bot.db && this.persistentCooldown) {
                const cooldownManager = new PersistentCooldownManager(bot.db);
                const cooldownCheck = await cooldownManager.check(this.name, message.username, this.cooldown);
                
                if (!cooldownCheck.allowed) {
                    const cooldownMsg = this.cooldownMessage.replace('{time}', cooldownCheck.remaining);
                    if (message.isPM) {
                        sendPM(bot, message.username, cooldownMsg, message);
                    } else {
                        bot.sendMessage(message.roomId, cooldownMsg);
                    }
                    return { success: false };
                }
            }
            if (!bot.heistManager) {
                const errorMsg = 'fishing licence machine is fucked, try again later';
                if (message.isPM) {
                    sendPM(bot, message.username, errorMsg, message);
                } else {
                    bot.sendMessage(message.roomId, errorMsg);
                }
                return { success: false };
            }

            // Get user balance
            const userEcon = await bot.heistManager.getUserBalance(message.username);
            
            // Determine bait
            const baitChoice = args[0]?.toLowerCase() || 'worm';
            const bait = baitTypes[baitChoice];
            
            if (!bait) {
                const errorMsg = `oi -${message.username}, dunno what "${args[0]}" is but it ain't bait. Try: worm, prawn, squid, lure, servo_pie, or ciggie_butt`;
                if (message.isPM) {
                    sendPM(bot, message.username, errorMsg.replace('-', ''), message); // Remove - prefix in PMs
                } else {
                    bot.sendMessage(message.roomId, errorMsg);
                }
                return { success: false };
            }
            
            // Check if user can afford bait
            if (bait.cost > 0 && userEcon.balance < bait.cost) {
                const errorMsg = `-${message.username} ya need $${bait.cost} for ${baitChoice} bait but ya only got $${userEcon.balance}. Use a worm ya cheapskate`;
                if (message.isPM) {
                    sendPM(bot, message.username, errorMsg.replace('-', ''), message); // Remove - prefix in PMs
                } else {
                    bot.sendMessage(message.roomId, errorMsg);
                }
                return { success: false };
            }
            
            // Deduct bait cost
            if (bait.cost > 0) {
                await bot.heistManager.updateUserEconomy(message.username, -bait.cost, 0);
            }
            
            // Choose random fishing spot
            const spot = fishingSpots[Math.floor(Math.random() * fishingSpots.length)];
            
            // Public acknowledgment only (skip if PM)
            if (!message.isPM) {
                const publicAcknowledgments = [
                    `🎣 -${message.username} grabs the rod and heads to ${spot.name}, check ya PMs for results`,
                    `🎣 -${message.username} is gone fishin' at ${spot.name}, PMing the catch details`,
                    `🎣 Casting a line for -${message.username}, results coming via PM`,
                    `🎣 -${message.username} throws in a line, I'll PM ya what bites`
                ];
                
                bot.sendMessage(message.roomId, publicAcknowledgments[Math.floor(Math.random() * publicAcknowledgments.length)]);
            }
            
            // Determine catch
            let catchRoll = Math.random() * spot.quality * bait.bonus;
            // Normalize to 0-1 range to prevent breaking probability tiers
            catchRoll = Math.min(1.0, catchRoll);
            const specialRoll = Math.random();
            
            // Build PM message with fishing story
            let pmMessage = `🎣 **Fishing at ${spot.name} ${spot.description}**\n\n`;
            pmMessage += `Using ${baitChoice} as bait...\n`;
            pmMessage += `*casts line and waits*\n\n`;
            
            let caught = null;
            let value = 0;
            let publicAnnouncement = null;
            let forcedShare = false;
            
            // Check for special events first (1% chance)
            if (specialRoll < 0.01) {
                // TREASURE! (0.5% chance)
                if (specialRoll < 0.005) {
                    const treasure = specialCatches.treasure[Math.floor(Math.random() * specialCatches.treasure.length)];
                    value = Math.floor(Math.random() * (treasure.value.max - treasure.value.min + 1)) + treasure.value.min;
                    pmMessage += `💎 HOLY FUCKIN' SHIT! You found a ${treasure.name}!\n`;
                    pmMessage += `${treasure.comment}\n`;
                    pmMessage += `💰 **TREASURE WORTH $${value}!**\n`;
                    
                    if (value >= 300) {
                        forcedShare = true;
                        publicAnnouncement = `🚨 OI EVERYONE! ${message.username} just found a ${treasure.name} worth $${value}! Time to share the wealth ya greedy bastard!`;
                    }
                    
                    await bot.heistManager.updateUserEconomy(message.username, value, 3);
                } else {
                    // Multi-catch event (0.5% chance)
                    const multiCatch = specialCatches.multiCatch[Math.floor(Math.random() * specialCatches.multiCatch.length)];
                    const baseFish = fishTypes.common.names[Math.floor(Math.random() * fishTypes.common.names.length)];
                    const baseValue = Math.floor(Math.random() * 5) + 1;
                    value = baseValue * multiCatch.multiplier;
                    
                    pmMessage += `🎉 MULTI-CATCH! ${multiCatch.name} - ${multiCatch.comment}\n`;
                    pmMessage += `Total value: $${value}!\n`;
                    
                    await bot.heistManager.updateUserEconomy(message.username, value, 0);
                    
                    // Log to transactions for leaderboard
                    try {
                        await bot.db.run(
                            'INSERT INTO economy_transactions (username, amount, transaction_type, description, room_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                            [message.username, value, 'fishing', `${weight}kg ${fishName}`, message.roomId || 'fatpizza', Date.now()]
                        );
                    } catch (error) {
                        bot.logger.error('Failed to log fishing transaction:', { error: error.message, stack: error.stack });
                    }
                }
            } else if (catchRoll < 0.15) {
                // Caught trash
                caught = trashItems[Math.floor(Math.random() * trashItems.length)];
                pmMessage += `💩 You reeled in a ${caught.name}! ${caught.comment}\n`;
                
                // Small chance to find money in trash
                if (Math.random() < 0.1) {
                    value = Math.floor(Math.random() * 5) + 1;
                    pmMessage += `\n...wait, there's $${value} stuck to it!\n`;
                    await bot.heistManager.updateUserEconomy(message.username, value, 0);
                    
                    // Log to transactions for leaderboard
                    try {
                        await bot.db.run(
                            'INSERT INTO economy_transactions (username, amount, transaction_type, description, room_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                            [message.username, value, 'fishing', `${weight}kg ${fishName}`, message.roomId || 'fatpizza', Date.now()]
                        );
                    } catch (error) {
                        bot.logger.error('Failed to log fishing transaction:', { error: error.message, stack: error.stack });
                    }
                }
                
            } else if (catchRoll < 0.25) {
                // Nothing
                const nothingMessages = [
                    "❌ You caught fuck all. Story of your life",
                    "❌ Your bait got nicked. Crafty little bastards",
                    "❌ The fish are smarter than you today",
                    "❌ You fell asleep and missed the bite",
                    "❌ You were too busy on the cones to notice the fish"
                ];
                pmMessage += nothingMessages[Math.floor(Math.random() * nothingMessages.length)] + "\n";
                
            } else {
                // Caught a fish!
                let fishRarity, fishList;
                
                // Adjusted percentages for new tiers
                if (catchRoll < 0.55) {
                    fishRarity = 'common';
                    fishList = fishTypes.common;
                } else if (catchRoll < 0.80) {
                    fishRarity = 'uncommon';
                    fishList = fishTypes.uncommon;
                } else if (catchRoll < 0.925) {
                    fishRarity = 'epic';
                    fishList = fishTypes.epic;
                } else if (catchRoll < 0.975) {
                    fishRarity = 'rare';
                    fishList = fishTypes.rare;
                } else {
                    fishRarity = 'legendary';
                    fishList = fishTypes.legendary;
                }
                
                const fishName = fishList.names[Math.floor(Math.random() * fishList.names.length)];
                const weight = (Math.random() * (fishList.weight.max - fishList.weight.min) + fishList.weight.min).toFixed(1);
                value = Math.floor(Math.random() * (fishList.value.max - fishList.value.min) + fishList.value.min);
                
                // Weight bonus
                const weightBonus = Math.floor(parseFloat(weight) * 2);
                value += weightBonus;
                
                // Build message based on rarity
                const rarityEmojis = {
                    common: "🐟",
                    uncommon: "🐠",
                    epic: "🌟",
                    rare: "🦈",
                    legendary: "🐋"
                };
                
                if (fishRarity === 'legendary') {
                    pmMessage += `${rarityEmojis[fishRarity]} HOLY FUCKIN' SHIT! You caught a ${weight}kg ${fishName}!\n`;
                    pmMessage += `That's worth $${value}! BIGGEST CATCH OF THE YEAR!\n`;
                    pmMessage += `\n🏆 **LEGENDARY CATCH! +3 Trust bonus!**\n`;
                    
                    // Always announce legendary catches
                    publicAnnouncement = `🐋 LEGENDARY CATCH! ${message.username} just landed a ${weight}kg ${fishName}! What a fuckin' legend!`;
                    
                    if (value >= 300) {
                        forcedShare = true;
                        publicAnnouncement += ` Worth $${value} - time to share the wealth!`;
                    }
                    
                    await bot.heistManager.updateUserEconomy(message.username, value, 3);
                    
                    // Log to transactions for leaderboard
                    try {
                        await bot.db.run(
                            'INSERT INTO economy_transactions (username, amount, transaction_type, description, room_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                            [message.username, value, 'fishing', `${weight}kg ${fishName}`, message.roomId || 'fatpizza', Date.now()]
                        );
                    } catch (error) {
                        bot.logger.error('Failed to log fishing transaction:', { error: error.message, stack: error.stack });
                    }
                } else if (fishRarity === 'rare') {
                    pmMessage += `${rarityEmojis[fishRarity]} Fuckin' ripper! You landed a ${weight}kg ${fishName}!\n`;
                    pmMessage += `Worth $${value}! That's a keeper!\n`;
                    pmMessage += `\n⭐ **RARE CATCH! +2 Trust bonus!**\n`;
                    
                    // Announce rare catches
                    publicAnnouncement = `🦈 RARE CATCH! ${message.username} just reeled in a ${weight}kg ${fishName}! Bloody beauty!`;
                    
                    if (value >= 300) {
                        forcedShare = true;
                        publicAnnouncement += ` Worth $${value} - sharing time!`;
                    }
                    
                    await bot.heistManager.updateUserEconomy(message.username, value, 2);
                    
                    // Log to transactions for leaderboard
                    try {
                        await bot.db.run(
                            'INSERT INTO economy_transactions (username, amount, transaction_type, description, room_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                            [message.username, value, 'fishing', `${weight}kg ${fishName}`, message.roomId || 'fatpizza', Date.now()]
                        );
                    } catch (error) {
                        bot.logger.error('Failed to log fishing transaction:', { error: error.message, stack: error.stack });
                    }
                } else if (fishRarity === 'epic') {
                    pmMessage += `${rarityEmojis[fishRarity]} Bloody oath! Epic catch - ${weight}kg ${fishName}!\n`;
                    pmMessage += `Worth $${value}! That's a ripper!\n`;
                    pmMessage += `\n⭐ **EPIC CATCH! +1 Trust bonus!**\n`;
                    
                    await bot.heistManager.updateUserEconomy(message.username, value, 1);
                    
                    // Log to transactions for leaderboard
                    try {
                        await bot.db.run(
                            'INSERT INTO economy_transactions (username, amount, transaction_type, description, room_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                            [message.username, value, 'fishing', `${weight}kg ${fishName}`, message.roomId || 'fatpizza', Date.now()]
                        );
                    } catch (error) {
                        bot.logger.error('Failed to log fishing transaction:', { error: error.message, stack: error.stack });
                    }
                } else {
                    const catchMessages = [
                        `caught a ${weight}kg ${fishName}! Worth $${value}`,
                        `reeled in a ${weight}kg ${fishName}! That's $${value} at the co-op`,
                        `landed a decent ${weight}kg ${fishName}! $${value} in the pocket`,
                        `hooked a ${weight}kg ${fishName}! Fish and chips money: $${value}`
                    ];
                    pmMessage += `${rarityEmojis[fishRarity]} You ${catchMessages[Math.floor(Math.random() * catchMessages.length)]}\n`;
                    
                    await bot.heistManager.updateUserEconomy(message.username, value, 0);
                    
                    // Log to transactions for leaderboard
                    try {
                        await bot.db.run(
                            'INSERT INTO economy_transactions (username, amount, transaction_type, description, room_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                            [message.username, value, 'fishing', `${weight}kg ${fishName}`, message.roomId || 'fatpizza', Date.now()]
                        );
                    } catch (error) {
                        bot.logger.error('Failed to log fishing transaction:', { error: error.message, stack: error.stack });
                    }
                }
                
                // Random fishing stories
                if (Math.random() < 0.2) {
                    const stories = [
                        "\n*Nearly lost your stubby in the struggle!*",
                        "\n*That's bigger than the one Davo caught last week!*",
                        "\n*Gonna tell everyone it was twice this size*",
                        "\n*Shazza's gonna be impressed with this one*",
                        "\n*Better than sittin' at home with the missus*",
                        "\n*Worth missin' the footy for this*",
                        "\n*Cops nearly caught you but it was worth it*"
                    ];
                    pmMessage += stories[Math.floor(Math.random() * stories.length)];
                }
            }
            
            // Add balance info if any money was earned
            if (value > 0) {
                const newBalance = await bot.heistManager.getUserBalance(message.username);
                pmMessage += `\n\n💰 **New balance: $${newBalance.balance}**`;
            }
            
            // Send PM with fishing results
            sendPM(bot, message.username, pmMessage, message);
            
            // Handle public announcements and forced sharing
            if (publicAnnouncement) {
                setTimeout(() => {
                    bot.sendMessage(message.roomId, publicAnnouncement);
                }, 2000);
            }
            
            // Handle forced sharing for catches over $300
            if (forcedShare && value >= 300) {
                setTimeout(async () => {
                    try {
                        // Get all online users (excluding the fisher and bots)
                        const onlineUsers = Array.from(bot.userlist.values())
                            .filter(u => !u.meta.afk && 
                                    u.name.toLowerCase() !== message.username.toLowerCase() &&
                                    u.name.toLowerCase() !== bot.username.toLowerCase() &&
                                    !u.name.startsWith('['));
                        
                        if (onlineUsers.length > 0) {
                            // Calculate shares - fisher keeps 50%, rest split among others + dazza
                            const fisherShare = Math.floor(value * 0.5);
                            const remainingAmount = value - fisherShare;
                            const sharePerUser = Math.floor(remainingAmount / (onlineUsers.length + 1)); // +1 for dazza
                            const dazzaShare = remainingAmount - (sharePerUser * onlineUsers.length);
                            
                            // Deduct the shared amount from fisher (they already got the full amount)
                            await bot.heistManager.updateUserEconomy(message.username, -remainingAmount, 0);
                            
                            // Give each user their share
                            for (const user of onlineUsers) {
                                await bot.heistManager.updateUserEconomy(user.name, sharePerUser, 0);
                            }
                            
                            // Dazza gets his cut
                            await bot.heistManager.updateUserEconomy('dazza', dazzaShare, 0);
                            
                            // Announce the sharing
                            const shareMessages = [
                                `everyone gets $${sharePerUser} from ${message.username}'s massive catch! I'm keepin' $${dazzaShare} for tattlin' fees`,
                                `splittin' the loot! $${sharePerUser} each for you lot, $${dazzaShare} for me dobbin' fee`,
                                `wealth redistribution time! everyone scores $${sharePerUser}, I pocket $${dazzaShare} for me troubles`,
                                `communism at work! $${sharePerUser} each, plus $${dazzaShare} for ya boy Dazza`
                            ];
                            
                            setTimeout(() => {
                                bot.sendMessage(message.roomId, shareMessages[Math.floor(Math.random() * shareMessages.length)]);
                            }, 1000);
                        }
                    } catch (error) {
                        bot.logger.error('Error sharing fishing rewards:', { error: error.message, stack: error.stack });
                    }
                }, 4000);
            }
            
            return { success: true };
            
        } catch (error) {
            bot.logger.error('Fish command error:', { error: error.message, stack: error.stack });
            const errorMsg = 'fishing rod snapped. bloody cheap Kmart shit.';
            if (message.isPM) {
                sendPM(bot, message.username, errorMsg, message);
            } else {
                bot.sendMessage(message.roomId, errorMsg);
            }
            return { success: false };
        }
    }
});