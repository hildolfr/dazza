import { Command } from '../base.js';

// Fish types with different rarities and values
const fishTypes = {
    common: {
        names: [
            "Bream", "Flathead", "Whiting", "Mullet", "Catfish", 
            "Leather Jacket", "Toadfish", "Puffer Fish", "Garfish"
        ],
        value: { min: 1, max: 5 },
        weight: { min: 0.2, max: 2 }
    },
    uncommon: {
        names: [
            "Snapper", "Tailor", "Salmon", "Kingfish", "Trevally",
            "Mackerel", "Morwong", "Pearl Perch"
        ],
        value: { min: 5, max: 15 },
        weight: { min: 1, max: 5 }
    },
    rare: {
        names: [
            "Barramundi", "Murray Cod", "Jewfish", "Spanish Mackerel",
            "Mahi Mahi", "Wahoo", "Yellowfin Tuna"
        ],
        value: { min: 15, max: 30 },
        weight: { min: 3, max: 15 }
    },
    legendary: {
        names: [
            "Marlin", "Great White", "Hammerhead", "Giant Trevally",
            "Bluefin Tuna", "Sailfish"
        ],
        value: { min: 50, max: 100 },
        weight: { min: 10, max: 50 }
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
    { name: "Thong", comment: "just the one, size 11" }
];

// Fishing spots with different catch rates
const fishingSpots = [
    { name: "Local Creek", quality: 0.7, description: "behind the bottlo" },
    { name: "Council Pond", quality: 0.6, description: "next to the skate park" },
    { name: "River", quality: 0.8, description: "under the bridge" },
    { name: "Beach", quality: 0.9, description: "near the surf club" },
    { name: "Jetty", quality: 0.85, description: "at the boat ramp" },
    { name: "Rock Pool", quality: 0.75, description: "down by the point" }
];

// Bait types affect catch chances
const baitTypes = {
    worm: { bonus: 1.0, cost: 0 },
    prawn: { bonus: 1.2, cost: 2 },
    squid: { bonus: 1.3, cost: 3 },
    lure: { bonus: 1.1, cost: 5 },
    servo_pie: { bonus: 0.8, cost: 1 },
    ciggie_butt: { bonus: 0.5, cost: 0 }
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
    pmAccepted: true,
    
    async handler(bot, message, args) {
        try {
            if (!bot.heistManager) {
                bot.sendMessage('fishing licence machine is fucked, try again later');
                return { success: false };
            }

            // Get user balance
            const userEcon = await bot.heistManager.getUserBalance(message.username);
            
            // Determine bait
            const baitChoice = args[0]?.toLowerCase() || 'worm';
            const bait = baitTypes[baitChoice];
            
            if (!bait) {
                bot.sendMessage(`oi -${message.username}, dunno what "${args[0]}" is but it ain't bait. Try: worm, prawn, squid, lure, servo_pie, or ciggie_butt`);
                return { success: false };
            }
            
            // Check if user can afford bait
            if (bait.cost > 0 && userEcon.balance < bait.cost) {
                bot.sendMessage(`-${message.username} ya need $${bait.cost} for ${baitChoice} bait but ya only got $${userEcon.balance}. Use a worm ya cheapskate`);
                return { success: false };
            }
            
            // Deduct bait cost
            if (bait.cost > 0) {
                await bot.heistManager.updateUserEconomy(message.username, -bait.cost, 0);
            }
            
            // Choose random fishing spot
            const spot = fishingSpots[Math.floor(Math.random() * fishingSpots.length)];
            
            // Public acknowledgment only
            const publicAcknowledgments = [
                `🎣 -${message.username} grabs the rod and heads to ${spot.name}, check ya PMs for results`,
                `🎣 -${message.username} is gone fishin' at ${spot.name}, PMing the catch details`,
                `🎣 Casting a line for -${message.username}, results coming via PM`,
                `🎣 -${message.username} throws in a line, I'll PM ya what bites`
            ];
            
            bot.sendMessage(publicAcknowledgments[Math.floor(Math.random() * publicAcknowledgments.length)]);
            
            // Determine catch
            const catchRoll = Math.random() * spot.quality * bait.bonus;
            
            // Build PM message with fishing story
            let pmMessage = `🎣 **Fishing at ${spot.name} ${spot.description}**\n\n`;
            pmMessage += `Using ${baitChoice} as bait...\n`;
            pmMessage += `*casts line and waits*\n\n`;
            
            let caught = null;
            let value = 0;
            
            if (catchRoll < 0.15) {
                // Caught trash
                caught = trashItems[Math.floor(Math.random() * trashItems.length)];
                pmMessage += `💩 You reeled in a ${caught.name}! ${caught.comment}\n`;
                
                // Small chance to find money in trash
                if (Math.random() < 0.1) {
                    value = Math.floor(Math.random() * 5) + 1;
                    pmMessage += `\n...wait, there's $${value} stuck to it!\n`;
                    await bot.heistManager.updateUserEconomy(message.username, value, 0);
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
                
                if (catchRoll < 0.6) {
                    fishRarity = 'common';
                    fishList = fishTypes.common;
                } else if (catchRoll < 0.85) {
                    fishRarity = 'uncommon';
                    fishList = fishTypes.uncommon;
                } else if (catchRoll < 0.95) {
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
                    rare: "🦈",
                    legendary: "🐋"
                };
                
                if (fishRarity === 'legendary') {
                    pmMessage += `${rarityEmojis[fishRarity]} HOLY FUCKIN' SHIT! You caught a ${weight}kg ${fishName}!\n`;
                    pmMessage += `That's worth $${value}! BIGGEST CATCH OF THE YEAR!\n`;
                    pmMessage += `\n🏆 **LEGENDARY CATCH! +2 Trust bonus!**\n`;
                    
                    // Trust bonus for legendary
                    await bot.heistManager.updateUserEconomy(message.username, value, 2);
                } else if (fishRarity === 'rare') {
                    pmMessage += `${rarityEmojis[fishRarity]} Fuckin' ripper! You landed a ${weight}kg ${fishName}!\n`;
                    pmMessage += `Worth $${value}! That's a keeper!\n`;
                    pmMessage += `\n⭐ **RARE CATCH! +1 Trust bonus!**\n`;
                    
                    await bot.heistManager.updateUserEconomy(message.username, value, 1);
                } else {
                    const catchMessages = [
                        `caught a ${weight}kg ${fishName}! Worth $${value}`,
                        `reeled in a ${weight}kg ${fishName}! That's $${value} at the co-op`,
                        `landed a decent ${weight}kg ${fishName}! $${value} in the pocket`,
                        `hooked a ${weight}kg ${fishName}! Fish and chips money: $${value}`
                    ];
                    pmMessage += `${rarityEmojis[fishRarity]} You ${catchMessages[Math.floor(Math.random() * catchMessages.length)]}\n`;
                    
                    await bot.heistManager.updateUserEconomy(message.username, value, 0);
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
            bot.sendPrivateMessage(message.username, pmMessage);
            
            return { success: true };
            
        } catch (error) {
            bot.logger.error('Fish command error:', error);
            bot.sendMessage('fishing rod snapped. bloody cheap Kmart shit.');
            return { success: false };
        }
    }
});