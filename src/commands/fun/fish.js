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
            
            // Announce fishing start
            const startMessages = [
                `🎣 -${message.username} cracks a tinnie and casts a line at ${spot.name} ${spot.description}...`,
                `🎣 -${message.username} lights up a durry and throws in a line at ${spot.name} ${spot.description}...`,
                `🎣 -${message.username} takes a swig of VB and casts out at ${spot.name} ${spot.description}...`,
                `🎣 -${message.username} checks for cops then starts fishing at ${spot.name} ${spot.description}...`
            ];
            
            bot.sendMessage(startMessages[Math.floor(Math.random() * startMessages.length)]);
            
            // Fishing animation
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const waitingMessages = [
                "...somethin's nibblin'...",
                "...feels like a bite...",
                "...line's twitchin'...",
                "...wait for it...",
                "...nearly got somethin'...",
                "...come on ya bastard..."
            ];
            
            bot.sendMessage(waitingMessages[Math.floor(Math.random() * waitingMessages.length)]);
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Determine catch
            const catchRoll = Math.random() * spot.quality * bait.bonus;
            
            let caught = null;
            let value = 0;
            let responseMessage = "";
            
            if (catchRoll < 0.15) {
                // Caught trash
                caught = trashItems[Math.floor(Math.random() * trashItems.length)];
                responseMessage = `💩 -${message.username} reels in a ${caught.name}! ${caught.comment}`;
                
                // Small chance to find money in trash
                if (Math.random() < 0.1) {
                    value = Math.floor(Math.random() * 5) + 1;
                    responseMessage += ` ...wait, there's $${value} stuck to it!`;
                    await bot.heistManager.updateUserEconomy(message.username, value, 0);
                }
                
            } else if (catchRoll < 0.25) {
                // Nothing
                const nothingMessages = [
                    `❌ -${message.username} caught fuck all. story of ya life`,
                    `❌ -${message.username}'s bait got nicked. crafty little bastards`,
                    `❌ the fish are smarter than -${message.username} today`,
                    `❌ -${message.username} falls asleep and misses the bite`,
                    `❌ -${message.username} was too busy on the cones to notice the fish`
                ];
                responseMessage = nothingMessages[Math.floor(Math.random() * nothingMessages.length)];
                
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
                
                responseMessage = `${rarityEmojis[fishRarity]} `;
                
                if (fishRarity === 'legendary') {
                    responseMessage += `HOLY FUCKIN' SHIT! -${message.username} caught a ${weight}kg ${fishName}! `;
                    responseMessage += `That's worth $${value}! BIGGEST CATCH OF THE YEAR!`;
                    
                    // Trust bonus for legendary
                    await bot.heistManager.updateUserEconomy(message.username, value, 2);
                } else if (fishRarity === 'rare') {
                    responseMessage += `Fuckin' ripper! -${message.username} lands a ${weight}kg ${fishName}! `;
                    responseMessage += `Worth $${value}! That's a keeper!`;
                    
                    await bot.heistManager.updateUserEconomy(message.username, value, 1);
                } else {
                    const catchMessages = [
                        `caught a ${weight}kg ${fishName}! Worth $${value}`,
                        `reels in a ${weight}kg ${fishName}! That's $${value} at the co-op`,
                        `lands a decent ${weight}kg ${fishName}! $${value} in the pocket`,
                        `hooks a ${weight}kg ${fishName}! Fish and chips money: $${value}`
                    ];
                    responseMessage += `-${message.username} ${catchMessages[Math.floor(Math.random() * catchMessages.length)]}`;
                    
                    await bot.heistManager.updateUserEconomy(message.username, value, 0);
                }
                
                // Random fishing stories
                if (Math.random() < 0.1) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    const stories = [
                        "nearly lost me stubby in the struggle!",
                        "that's bigger than the one Davo caught last week!",
                        "gonna tell everyone it was twice this size",
                        "Shazza's gonna be impressed with this one",
                        "better than sittin' at home with the missus",
                        "worth missin' the footy for this",
                        "cops nearly caught me but it was worth it"
                    ];
                    bot.sendMessage(stories[Math.floor(Math.random() * stories.length)]);
                }
            }
            
            bot.sendMessage(responseMessage);
            
            return { success: true };
            
        } catch (error) {
            bot.logger.error('Fish command error:', error);
            bot.sendMessage('fishing rod snapped. bloody cheap Kmart shit.');
            return { success: false };
        }
    }
});