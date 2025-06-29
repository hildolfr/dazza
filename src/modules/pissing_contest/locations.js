// Location definitions with time-based weights
export const LOCATIONS = {
    morning: [ // 6am-12pm
        {
            name: "Servo Sideyard",
            effects: { distance: 20, aim: -15 },
            description: "headwind from road, diesel fumes",
            fine: 5,
            fineMessage: "Raj caught ya! $5 fine"
        },
        {
            name: "Bunnings Bog",
            effects: { aim: 40, volume: -40 },
            description: "crusty old trough, probably blocked with puke",
            cloggedChance: 0.3
        },
        {
            name: "Tradie's Ute Tray",
            effects: { distance: 40, aim: -30 },
            description: "elevation bonus, wobbly platform",
            toolDamageChance: 0.2
        },
        {
            name: "Centerlink Line", 
            effects: { volume: -40, aim: -20, all: 20 },
            description: "stage fright from judgment",
            doleBonus: true
        },
        {
            name: "School Pickup Zone",
            effects: { duration: -60 },
            description: "illegal spot, gotta rush",
            fine: 10,
            fineMessage: "School zone fine! $10"
        },
        {
            name: "Maccas Breakfast Rush",
            effects: { volume: 30, aim: -20 },
            description: "hashbrown smell, hangover shakes"
        }
    ],

    arvo: [ // 12pm-6pm
        {
            name: "Beach Shower Block",
            effects: { aim: -40, volume: 20 },
            description: "sand in dick, dehydration"
        },
        {
            name: "Bottlo Loading Dock",
            effects: { volume: 30, distance: -20 },
            description: "slab obstacles, beer courage",
            slabsMultiplier: true
        },
        {
            name: "Cricket Pitch Boundary",
            effects: { distance: 40 },
            description: "showing off distance",
            wicketFail: 0.1
        },
        {
            name: "RSL Car Park",
            effects: { aim: -30, volume: 20 },
            description: "pokies jingle distracts"
        },
        {
            name: "Westfield Level 3",
            effects: { volume: -40, aim: -30 },
            description: "shy bladder central",
            fine: 8,
            fineMessage: "Security! $8 fine"
        },
        {
            name: "The Dog Park",
            effects: { aim: -50, duration: 30 },
            description: "dogs very interested",
            biteChance: 0.05
        }
    ],

    night: [ // 6pm-12am
        {
            name: "Kebab Shop Wall",
            effects: { volume: 40, aim: -30 },
            description: "garlic sauce smell, greasy ground"
        },
        {
            name: "Pub Beer Garden",
            effects: { volume: 30, aim: -40 },
            description: "liquid courage, crowded",
            stageFrightChance: 0.2
        },
        {
            name: "TAB Alley",
            effects: { aim: -20, distance: 30 },
            description: "angry punters, rage pissing"
        },
        {
            name: "Strippers Car Park",
            effects: { volume: 70, aim: -50 },
            description: "blue balls advantage"
        },
        {
            name: "Cousins Wedding Reception",
            effects: { aim: -40, duration: 30 },
            description: "formal pants complication"
        },
        {
            name: "Drive-In Movies",
            effects: { aim: -60, distance: 40 },
            description: "dark as shit, sneaky angle"
        }
    ],

    lateNight: [ // 12am-6am
        {
            name: "Maccas 3am Special",
            effects: { volume: 60 },
            description: "munchies bladder",
            fine: 10,
            fineChance: 0.3,
            fineMessage: "Cop patrol! $10 fine"
        },
        {
            name: "24hr Gym Bushes",
            effects: { distance: 50, aim: -40 },
            description: "roid rage distance"
        },
        {
            name: "Ex's Front Lawn",
            effects: { distance: 50, volume: 40 },
            description: "revenge piss power",
            sprinklerChance: 0.2
        },
        {
            name: "Taxi Rank",
            effects: { duration: 40, aim: -30 },
            description: "desperate times",
            runOverChance: 0.1
        },
        {
            name: "Behind the Cop Shop",
            effects: { distance: 60 },
            description: "adrenaline boost",
            copChance: 0.2
        },
        {
            name: "Servo ATM",
            effects: { all: -40 },
            description: "camera paranoia",
            skimmerFine: 5
        }
    ],

    rural: [ // Any time
        {
            name: "The Bush Dunny",
            effects: { duration: -60, aim: 40 },
            description: "spider fear, drop toilet practice"
        },
        {
            name: "Mates Farm Dam",
            effects: { distance: 70, aim: -30 },
            description: "downhill advantage, mud hazard"
        },
        {
            name: "Highway Rest Stop",
            effects: { intimidation: 20, smallDickPenalty: -40 },
            description: "truckers watching"
        },
        {
            name: "Behind the Roadhouse",
            effects: { aim: -20, distance: 30 },
            description: "tumbleweeds, elevation"
        },
        {
            name: "Camping Ground",
            effects: { all: 25 },
            description: "nature's calling",
            angryChance: 0.3
        }
    ],

    special: [ // Rare special events
        {
            name: "Footy Finals Portaloo",
            effects: { duration: -50, volume: 40 },
            description: "queue pressure, beer volume"
        },
        {
            name: "Races VIP Area",
            effects: { volume: -40, duration: 30 },
            description: "fancy cunts watching"
        },
        {
            name: "Burnout Pad",
            effects: { aim: -40, distance: 50 },
            description: "tire smoke, adrenaline"
        },
        {
            name: "Fishing Spot Rock",
            effects: { distance: 60 },
            description: "high ground advantage",
            tinnieHitChance: 0.1
        },
        {
            name: "Bowlo Greenside",
            effects: { all: -30, aim: 20 },
            description: "old cunts yelling"
        }
    ],

    aimBonus: [ // Locations with aim bonuses
        {
            name: "Train Platform Edge",
            effects: { distance: 50, aim: 30 },
            description: "drop distance, railing guide"
        },
        {
            name: "Officeworks Print Center",
            effects: { aim: 60, volume: -40 },
            description: "laser printer guidance"
        },
        {
            name: "Multi-story Carpark Top Level",
            effects: { distance: 80, aim: -30 },
            description: "height advantage, wind tunnel"
        },
        {
            name: "Bridge Underpass",
            effects: { aim: 40, distance: 20 },
            description: "wall guides, echo motivation"
        }
    ]
};

// Get random location based on current time
export function getRandomLocation() {
    const hour = new Date().getHours();
    let pool = [];
    
    // Determine time-based pool
    if (hour >= 6 && hour < 12) {
        pool = [...LOCATIONS.morning];
    } else if (hour >= 12 && hour < 18) {
        pool = [...LOCATIONS.arvo];
    } else if (hour >= 18 && hour < 24) {
        pool = [...LOCATIONS.night];
    } else {
        pool = [...LOCATIONS.lateNight];
    }
    
    // Add rural locations (always available)
    pool.push(...LOCATIONS.rural);
    
    // Small chance for special locations
    if (Math.random() < 0.1) {
        pool.push(...LOCATIONS.special);
    }
    
    // Small chance for aim bonus locations
    if (Math.random() < 0.15) {
        pool.push(...LOCATIONS.aimBonus);
    }
    
    return pool[Math.floor(Math.random() * pool.length)];
}

// Apply location effects
export function applyLocationEffects(stats, location, user) {
    if (!location || !location.effects) return stats;
    
    const newStats = { ...stats };
    
    for (const [key, value] of Object.entries(location.effects)) {
        switch (key) {
            case 'all':
                newStats.distance *= (1 + value / 100);
                newStats.volume *= (1 + value / 100);
                newStats.aim *= (1 + value / 100);
                newStats.duration *= (1 + value / 100);
                break;
                
            case 'distance':
            case 'volume':
            case 'aim':
            case 'duration':
                newStats[key] *= (1 + value / 100);
                break;
                
            case 'smallDickPenalty':
                // Apply if user has small dick characteristic
                if (user.characteristic && user.characteristic.name.includes('Dick')) {
                    const smallDicks = ["Pencil Dick", "Baby Carrot", "The Acorn", "Micro Mike", "Button Mushroom"];
                    if (smallDicks.some(name => user.characteristic.name.includes(name))) {
                        newStats.all *= (1 + value / 100);
                    }
                }
                break;
        }
    }
    
    // Special location conditions
    if (location.doleBonus && user.onDole) {
        newStats.all *= 1.2;
    }
    
    if (location.slabsMultiplier && user.slabsPurchased) {
        newStats.volume *= (1 + user.slabsPurchased * 0.3);
    }
    
    return newStats;
}

// Check for location-based events
export function checkLocationEvents(location) {
    const events = [];
    
    if (location.fine && location.fineChance && Math.random() < location.fineChance) {
        events.push({
            type: 'fine',
            amount: location.fine,
            message: location.fineMessage
        });
    }
    
    if (location.cloggedChance && Math.random() < location.cloggedChance) {
        events.push({
            type: 'clogged',
            message: "trough's clogged with sawdust!"
        });
    }
    
    if (location.wicketFail && Math.random() < location.wicketFail) {
        events.push({
            type: 'instant_loss',
            message: "hit the wicket! Instant disqualification!"
        });
    }
    
    if (location.biteChance && Math.random() < location.biteChance) {
        events.push({
            type: 'instant_loss', 
            message: "dog bit ya dick! Contest over!"
        });
    }
    
    if (location.sprinklerChance && Math.random() < location.sprinklerChance) {
        events.push({
            type: 'sprinkler',
            message: "sprinklers turned on!"
        });
    }
    
    if (location.copChance && Math.random() < location.copChance) {
        events.push({
            type: 'cop',
            message: "cop showed up!"
        });
    }
    
    if (location.runOverChance && Math.random() < location.runOverChance) {
        events.push({
            type: 'instant_loss',
            message: "cabbie ran ya over!"
        });
    }
    
    if (location.tinnieHitChance && Math.random() < location.tinnieHitChance) {
        events.push({
            type: 'tinnie_hit',
            message: "pissed in ya own tinnie!"
        });
    }
    
    if (location.angryChance && Math.random() < location.angryChance) {
        events.push({
            type: 'angry_campers',
            message: "woke up angry campers!"
        });
    }
    
    return events;
}