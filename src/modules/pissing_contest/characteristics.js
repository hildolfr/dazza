// Characteristic types and their effects
export const CHARACTERISTICS = {
    // INTIMIDATION TYPES (10)
    intimidation: [
        {
            name: "The Horse Cock",
            effects: { opponent_aim: -15, opponent_duration: -10 },
            description: "opponent gets nervous",
            rarity: "uncommon"
        },
        {
            name: "Big Dick Energy",
            effects: { opponent_stage_fright_chance: 25, opponent_aim: -20 },
            description: "intimidating presence",
            rarity: "uncommon"
        },
        {
            name: "The Anaconda",
            effects: { opponent_aim: -30, opponent_duration: -20 },
            description: "opponent keeps looking",
            rarity: "uncommon"
        },
        {
            name: "Meat Hammer",
            effects: { opponent_distance: -25, opponent_aim: -15 },
            description: "opponent unfocused",
            rarity: "uncommon"
        },
        {
            name: "Third Leg Larry",
            effects: { opponent_volume: -40 },
            description: "causes shy bladder",
            rarity: "uncommon"
        },
        {
            name: "The Intimidator",
            effects: { opponent_duration: -20, opponent_volume: -30 },
            description: "opponent stutters",
            rarity: "uncommon"
        },
        {
            name: "Donkey Dick",
            effects: { opponent_duration: -50, opponent_distance: 10 },
            description: "opponent quick finish",
            rarity: "uncommon"
        },
        {
            name: "The Monster",
            effects: { opponent_forfeit_chance: 30, opponent_all: -25 },
            description: "might scare opponent away",
            rarity: "rare"
        },
        {
            name: "Porn Star Pete",
            effects: { opponent_aim: -35, opponent_distance: -15 },
            description: "opponent distracted",
            rarity: "uncommon"
        },
        {
            name: "Alpha Hog",
            effects: { opponent_all: -20 },
            description: "opponent loses confidence",
            rarity: "uncommon"
        }
    ],

    // MOCKERY TYPES (10)
    mockery: [
        {
            name: "Pencil Dick",
            effects: { opponent_all: 20 },
            description: "opponent relaxes",
            rarity: "common"
        },
        {
            name: "Baby Carrot",
            effects: { opponent_duration: 30, opponent_aim: -20 },
            description: "opponent laughing",
            rarity: "common"
        },
        {
            name: "The Acorn",
            effects: { opponent_aim: 40 },
            description: "opponent pities",
            rarity: "common"
        },
        {
            name: "Micro Mike",
            effects: { opponent_distance: 40, opponent_aim: -10 },
            description: "opponent showing off",
            rarity: "common"
        },
        {
            name: "Button Mushroom",
            effects: { opponent_all: 15 },
            description: "boosts opponent confidence",
            rarity: "common"
        },
        {
            name: "The Innie",
            effects: { opponent_aim: -10, opponent_duration: 25 },
            description: "opponent staring",
            rarity: "common"
        },
        {
            name: "Tic Tac",
            effects: { opponent_all: 30 },
            description: "opponent confidence soars",
            rarity: "common"
        },
        {
            name: "Pinky Finger",
            effects: { opponent_aim: 50, opponent_volume: 20 },
            description: "easy target practice",
            rarity: "common"
        },
        {
            name: "The Nugget",
            effects: { opponent_aim: 60, opponent_distance: 30 },
            description: "opponent cant miss",
            rarity: "common"
        },
        {
            name: "Clit Dick",
            effects: { opponent_duration: 10, opponent_aim: 40 },
            description: "precision advantage",
            rarity: "common"
        }
    ],

    // PERFORMANCE SPECIALISTS (10)
    performance: [
        {
            name: "Fire Hose Frank",
            effects: { distance: 60, duration: -40, aim: -30 },
            description: "extreme distance",
            rarity: "legendary",
            forceComment: true
        },
        {
            name: "The Camel",
            effects: { volume: 50, distance: -20 },
            description: "massive bladder",
            rarity: "uncommon"
        },
        {
            name: "Marathon Man",
            effects: { duration_min: 20, distance: -30, aim: 20 },
            description: "goes forever",
            rarity: "uncommon"
        },
        {
            name: "Quick Draw McGraw",
            effects: { duration_max: 3, aim: -40, distance: 30 },
            description: "lightning fast",
            rarity: "uncommon"
        },
        {
            name: "Old Faithful",
            effects: { all: -25, aim: 40 },
            description: "reliable performer",
            rarity: "uncommon"
        },
        {
            name: "The Sprinkler",
            effects: { aim: -50, random_spikes: true },
            description: "unpredictable stream",
            rarity: "uncommon"
        },
        {
            name: "Pressure Washer",
            effects: { distance_min: 3, aim: -40, duration: -20 },
            description: "high pressure",
            rarity: "legendary",
            forceComment: true
        },
        {
            name: "The Dripper",
            effects: { duration: 80, distance: -60, aim: 50 },
            description: "slow and steady",
            rarity: "uncommon"
        },
        {
            name: "Beer Bladder",
            effects: { volume: 40, aim: -30, duration: 20 },
            description: "fullness advantage",
            rarity: "uncommon"
        },
        {
            name: "The Firehose",
            effects: { distance: 70, aim: -60, duration: -30 },
            description: "maximum pressure",
            rarity: "legendary",
            forceComment: true
        }
    ],

    // FAILURE PRONE (5)
    failure: [
        {
            name: "Stage Fright Steve",
            effects: { forfeit_chance: 25, all: -40 },
            description: "performance anxiety",
            rarity: "uncommon"
        },
        {
            name: "Nervous Nelly",
            effects: { aim: -30, fail_vs_big: true },
            description: "easily intimidated",
            rarity: "uncommon"
        },
        {
            name: "The Quitter",
            effects: { quit_if_losing: true },
            description: "gives up easily",
            rarity: "uncommon"
        },
        {
            name: "Broken Bobby",
            effects: { malfunction_chance: 15, aim: -50 },
            description: "equipment issues",
            rarity: "uncommon"
        },
        {
            name: "Shy Guy",
            effects: { volume: -60, aim: -40, cant_perform_watched: true },
            description: "stage fright prone",
            rarity: "uncommon"
        }
    ],

    // HOMOPHOBIC HUMOR (5)
    distracted: [
        {
            name: "Curious George",
            effects: { aim: -40, duration: -20, opponent_confidence: 10 },
            description: "keeps peeking",
            rarity: "uncommon",
            forceComment: true
        },
        {
            name: "The Admirer",
            effects: { all: -30, opponent_aim: 20 },
            description: "caught staring",
            rarity: "uncommon",
            forceComment: true
        },
        {
            name: "Closet Case",
            effects: { aim: -50, split_stream: true },
            description: "sneaking looks",
            rarity: "uncommon"
        },
        {
            name: "The Comparer",
            effects: { aim: -30, volume: -40 },
            description: "busy measuring",
            rarity: "uncommon"
        },
        {
            name: "Sword Fighter",
            effects: { aim: -60, moves_closer: true },
            description: "wants to cross streams",
            rarity: "uncommon"
        }
    ],

    // ENVIRONMENTAL/SPECIAL (5)
    special: [
        {
            name: "Wind Sailor",
            effects: { wind_multiplier: 2, aim: -20 },
            description: "affected by wind",
            rarity: "uncommon"
        },
        {
            name: "Weather Immune",
            effects: { ignore_weather: true },
            description: "unaffected by conditions",
            rarity: "rare"
        },
        {
            name: "Cold Blooded",
            effects: { cold_turtle: true, volume: -40, aim: 30 },
            description: "shrinks in cold",
            rarity: "uncommon"
        },
        {
            name: "The Legend",
            effects: { all: 25, dazza_impressed: true },
            description: "legendary status",
            rarity: "legendary",
            forceComment: true
        },
        {
            name: "Piss God",
            effects: { all: 40, perfect_aim: true, intimidates_all: true },
            description: "godlike abilities",
            rarity: "legendary"
        },
        {
            name: "Pierced Python",
            effects: { 
                distance: 55, 
                opponent_aim: -35, 
                opponent_confidence: -25, 
                opponent_duration: -15,
                aim: -40,
                split_stream: true,
                intimidates_all: true,
                volume: 30
            },
            description: "jewelry causes havoc",
            rarity: "legendary",
            forceComment: true
        }
    ],

    // COUNTER/COMBO (5)
    counter: [
        {
            name: "The Equalizer",
            effects: { negate_size: true, aim: 20 },
            description: "size doesn't matter",
            rarity: "rare"
        },
        {
            name: "Confidence King",
            effects: { immune_intimidation: true, aim: 30 },
            description: "unshakeable",
            rarity: "rare"
        },
        {
            name: "Steady Hands",
            effects: { aim: 60, distance: -20, immune_shakes: true },
            description: "sick control",
            rarity: "uncommon"
        },
        {
            name: "The Mirror",
            effects: { copy_best_stat: true },
            description: "copies opponent strength",
            rarity: "rare"
        },
        {
            name: "Laser Guided",
            effects: { aim: 80, volume: -30 },
            description: "precision focused",
            rarity: "rare"
        }
    ],

    // AIM SPECIALISTS (15)
    aim: [
        {
            name: "Crooked Dick Craig",
            effects: { aim: -60, pulls_left: true, distance: 20 },
            description: "aims left always",
            rarity: "uncommon",
            forceComment: true
        },
        {
            name: "One-Eyed Willie",
            effects: { aim: -40, volume: 30 },
            description: "no depth perception",
            rarity: "uncommon"
        },
        {
            name: "The Stormtrooper",
            effects: { aim: -80, distance: 40 },
            description: "can't hit anything",
            rarity: "uncommon"
        },
        {
            name: "Snipers Knob",
            effects: { aim: 70, volume: -30 },
            description: "tactical precision",
            rarity: "rare"
        },
        {
            name: "Bentley",
            effects: { aim: -50, confuse_opponent: true },
            description: "bent shaft",
            rarity: "uncommon",
            forceComment: true
        },
        {
            name: "GPS Guided",
            effects: { aim: 90, duration: -40 },
            description: "can hit a fly at 10 paces",
            rarity: "rare"
        },
        {
            name: "The Cyclops",
            effects: { aim: -30, distance: 20 },
            description: "one ball throws balance",
            rarity: "uncommon"
        },
        {
            name: "Shaky Pete",
            effects: { aim: -45, duration: 15 },
            description: "constant shivers",
            rarity: "uncommon"
        },
        {
            name: "Cross-Eyed Carl",
            effects: { aim: -70, might_hit_opponent: true },
            description: "dangerous aim",
            rarity: "uncommon"
        },
        {
            name: "The Marksman",
            effects: { aim: 50, volume: -20 },
            description: "steady aim",
            rarity: "uncommon"
        },
        {
            name: "Spray and Pray",
            effects: { aim: -90, distance: 60, volume: 40 },
            description: "chaotic stream",
            rarity: "rare"
        },
        {
            name: "Lefty Loosey",
            effects: { aim: -35, duration: 25 },
            description: "favors left side",
            rarity: "uncommon"
        },
        {
            name: "The Pendulum",
            effects: { aim: -40, distance: 30 },
            description: "swings side to side",
            rarity: "uncommon"
        },
        {
            name: "Laser Dick",
            effects: { aim: 100, all: -50 },
            description: "dead-on aim but pisses like a girl",
            rarity: "legendary"
        },
        {
            name: "Parkinsons Paul",
            effects: { aim: -55, duration: 40 },
            description: "uncontrollable shaking",
            rarity: "uncommon"
        }
    ],

    // BALL-RELATED AIM (10)
    balls: [
        {
            name: "One Nut Wonder",
            effects: { aim: -25, distance: 30 },
            description: "lopsided stance",
            rarity: "uncommon"
        },
        {
            name: "Big Balls Barry",
            effects: { aim: -35, volume: 40 },
            description: "balls interfere",
            rarity: "uncommon"
        },
        {
            name: "High and Tight",
            effects: { aim: 40, volume: -20 },
            description: "tucked for precision",
            rarity: "uncommon"
        },
        {
            name: "Low Hangers",
            effects: { aim: -45, duration: 50 },
            description: "saggy interference",
            rarity: "uncommon"
        },
        {
            name: "The Tangled Sack",
            effects: { aim: -60, forfeit_chance: 20 },
            description: "twisted balls",
            rarity: "uncommon",
            forceComment: true
        },
        {
            name: "Smooth as Eggs",
            effects: { aim: 30 },
            description: "freshly shaved",
            rarity: "uncommon"
        },
        {
            name: "The Beanbag",
            effects: { aim: -40, duration: 60 },
            description: "saggy sack",
            rarity: "uncommon"
        },
        {
            name: "Blue Baller",
            effects: { aim: -50, volume: 70 },
            description: "backed up",
            rarity: "uncommon"
        },
        {
            name: "The Juggler",
            effects: { aim: -70, opponent_laughing: true },
            description: "constant adjusting",
            rarity: "uncommon",
            forceComment: true
        },
        {
            name: "Nuts of Steel",
            effects: { immune_ball_failures: true, aim: 25 },
            description: "unbreakable",
            rarity: "rare"
        }
    ],

    // VOLUME SPECIALISTS (8)
    volume: [
        {
            name: "The Gusher",
            effects: { volume: 80, aim: -40 },
            description: "extreme volume",
            rarity: "rare"
        },
        {
            name: "Dehydrated Dave",
            effects: { volume: -70, distance: 50 },
            description: "concentrated stream",
            rarity: "uncommon"
        },
        {
            name: "Bladder Buster",
            effects: { volume_min: 1500, duration: -30 },
            description: "massive capacity",
            rarity: "rare"
        },
        {
            name: "The Trickler",
            effects: { volume: -80, duration: 60, aim: 40 },
            description: "weak flow",
            rarity: "uncommon"
        },
        {
            name: "Kidney Flusher",
            effects: { volume: 60, opponent_needs_piss: true },
            description: "inspires urgency",
            rarity: "uncommon"
        },
        {
            name: "The Reservoir",
            effects: { volume: 100, distance: -50 },
            description: "maximum capacity",
            rarity: "rare"
        },
        {
            name: "Dust Bowl",
            effects: { volume: -90, ghost_piss_chance: true },
            description: "practically empty",
            rarity: "uncommon"
        },
        {
            name: "Heavy Flow",
            effects: { volume: 70, aim: -40, intimidates_small_bladders: true },
            description: "impressive volume",
            rarity: "rare"
        }
    ],

    // SUBSTANCE/INTOXICATION (8)
    substance: [
        {
            name: "Coke Dick Colin",
            effects: { malfunction_chance: 80, volume: -90 },
            description: "equipment failure likely",
            rarity: "uncommon"
        },
        {
            name: "Beer Goggles Bob",
            effects: { aim: -60, opponent_confidence: 40 },
            description: "thinks he's winning",
            rarity: "uncommon"
        },
        {
            name: "Stoned Stupid",
            effects: { all: -50, forget_chance: 30 },
            description: "might forget to start",
            rarity: "uncommon"
        },
        {
            name: "Speed Freak",
            effects: { duration_max: 2, distance: 60, aim: -70 },
            description: "hyperfast stream",
            rarity: "uncommon"
        },
        {
            name: "Whiskey Dick Wayne",
            effects: { cant_start_chance: 50, all: -40 },
            description: "whiskey problems",
            rarity: "uncommon"
        },
        {
            name: "Meth Head Mark",
            effects: { random_changes: true, infinite_stream_chance: true },
            description: "unpredictable effects",
            rarity: "uncommon"
        },
        {
            name: "Shroom Tripper",
            effects: { aim: -90, confuse_opponent: true },
            description: "seeing colors",
            rarity: "uncommon"
        },
        {
            name: "Blackout Barry",
            effects: { wrong_direction_chance: 40 },
            description: "might piss anywhere",
            rarity: "uncommon"
        }
    ],

    // TECHNIQUE-BASED (8)
    technique: [
        {
            name: "The Leaner",
            effects: { distance: 40, volume: -30, angle_45: true },
            description: "45 degree angle",
            rarity: "rare",
            forceComment: true
        },
        {
            name: "Hands Free Harry",
            effects: { aim: -80, duration: 30 },
            description: "no hands technique",
            rarity: "uncommon"
        },
        {
            name: "Two Hander",
            effects: { aim: 60, distance: -20 },
            description: "needs both hands",
            rarity: "uncommon"
        },
        {
            name: "The Helicopter",
            effects: { aim: -90, distance: 40, splash_damage: true },
            description: "spinning technique",
            rarity: "uncommon",
            forceComment: true
        },
        {
            name: "Sitting Sam",
            effects: { aim: 80, distance: -60, opponent_mocks: true },
            description: "sits to pee",
            rarity: "uncommon",
            forceComment: true
        },
        {
            name: "The Squatter",
            effects: { volume: 50, distance: -70 },
            description: "weird stance",
            rarity: "uncommon"
        },
        {
            name: "Pinch and Roll",
            effects: { aim: 70, duration: -40 },
            description: "foreskin technique",
            rarity: "uncommon"
        },
        {
            name: "The Shaker",
            effects: { duration: 30, aim: -20 },
            description: "excessive shaking",
            rarity: "uncommon"
        }
    ],

    // COMBO DISRUPTORS (7)
    disruptor: [
        {
            name: "The Psycher",
            effects: { opponent_random: -30 },
            description: "fake sounds",
            rarity: "uncommon"
        },
        {
            name: "Trash Talker",
            effects: { opponent_all: -20 },
            description: "verbal assault",
            rarity: "uncommon"
        },
        {
            name: "The Moaner",
            effects: { opponent_aim: -50 },
            description: "sex noises",
            rarity: "uncommon"
        },
        {
            name: "Stage Whisperer",
            effects: { opponent_confidence: -40 },
            description: "mutters constantly",
            rarity: "uncommon"
        },
        {
            name: "The Giggler",
            effects: { opponent_aim: -30, catch_giggles: true },
            description: "contagious laughter",
            rarity: "uncommon"
        },
        {
            name: "Commentary Craig",
            effects: { opponent_all: -25 },
            description: "live commentary",
            rarity: "uncommon"
        },
        {
            name: "The Jinxer",
            effects: { opponent_fail_chance: 20 },
            description: "calls moves",
            rarity: "uncommon"
        }
    ],

    // ENVIRONMENTAL MANIPULATORS (5)
    environmental: [
        {
            name: "Wind Whisperer",
            effects: { favorable_wind: 70 },
            description: "controls wind",
            rarity: "rare"
        },
        {
            name: "The Weatherman",
            effects: { all: 20, knows_conditions: true },
            description: "weather expert",
            rarity: "rare"
        },
        {
            name: "Storm Caller",
            effects: { weather_change_chance: 30 },
            description: "changes weather",
            rarity: "rare"
        },
        {
            name: "Temperature Tommy",
            effects: { make_colder: true },
            description: "chills the air",
            rarity: "rare"
        },
        {
            name: "The Groundskeeper",
            effects: { aim: 30, distance: 20 },
            description: "knows terrain",
            rarity: "rare"
        }
    ],

    // RARE LEGENDARY FAILURES (8)
    legendary_failure: [
        {
            name: "The Disaster",
            effects: { catastrophic_fail_chance: 50 },
            description: "everything fails",
            rarity: "legendary"
        },
        {
            name: "Murphys Law",
            effects: { random_failures: true },
            description: "what can go wrong will",
            rarity: "legendary"
        },
        {
            name: "The Catastrophe",
            effects: { all_failure_chance: 25 },
            description: "prone to all failures",
            rarity: "legendary"
        },
        {
            name: "Bad Luck Brian",
            effects: { bad_rng: true, opponent_lucky: true },
            description: "cursed luck",
            rarity: "legendary"
        },
        {
            name: "The Cursed",
            effects: { multiple_failures: true },
            description: "multiple issues",
            rarity: "legendary"
        },
        {
            name: "Glass Cannon",
            effects: { perfect_or_fail: true },
            description: "all or nothing",
            rarity: "legendary"
        },
        {
            name: "The Imploder",
            effects: { start_strong_fail: true },
            description: "dramatic failure",
            rarity: "legendary"
        },
        {
            name: "The Jinx",
            effects: { mutual_malfunction: true },
            description: "curses both players",
            rarity: "legendary"
        }
    ],

    // SELF-CONDITION CHARACTERISTICS (5)
    self_condition: [
        {
            name: "Iron Bladder",
            effects: { self_condition: "The Zone" },
            description: "immune to all conditions",
            rarity: "legendary"
        },
        {
            name: "Zen Master",
            effects: { self_condition: "Full Tank" },
            description: "can't be intimidated",
            rarity: "legendary"
        },
        {
            name: "The Professional",
            effects: { self_condition: "Laser Focus" },
            description: "ignores distractions",
            rarity: "legendary"
        },
        {
            name: "Battle Hardened",
            effects: { self_condition: "Stainless" },
            description: "seen it all before",
            rarity: "legendary"
        },
        {
            name: "The Veteran",
            effects: { self_condition: "No Warmup", duration_range: [8, 12], all: 20 },
            description: "experienced pisser",
            rarity: "legendary"
        }
    ],

    // MUTUAL CONDITION CHARACTERISTICS (5)
    mutual_condition: [
        {
            name: "The Awkward",
            effects: { mutual_condition: "Shy Bladder" },
            description: "makes everyone nervous",
            rarity: "rare"
        },
        {
            name: "Drama Queen",
            effects: { mutual_condition: "Stage Fright" },
            description: "too theatrical",
            rarity: "rare"
        },
        {
            name: "The Infectious",
            effects: { mutual_condition: "The Giggles" },
            description: "contagious laughter",
            rarity: "rare"
        },
        {
            name: "Chaos Bringer",
            effects: { mutual_condition: "random" },
            description: "brings chaos",
            rarity: "legendary"
        },
        {
            name: "The Jinx",
            effects: { mutual_condition: "Equipment Malfunction" },
            description: "jinxes everyone",
            rarity: "legendary"
        }
    ]
};

// Helper function to get a random characteristic
export function getRandomCharacteristic() {
    // Calculate rarity weights
    const rarityWeights = {
        common: 30,
        uncommon: 15,
        rare: 5,
        legendary: 1
    };
    
    // Flatten all characteristics into one array with weights
    const allCharacteristics = [];
    
    for (const category of Object.values(CHARACTERISTICS)) {
        for (const char of category) {
            const weight = rarityWeights[char.rarity] || 15;
            for (let i = 0; i < weight; i++) {
                allCharacteristics.push(char);
            }
        }
    }
    
    return allCharacteristics[Math.floor(Math.random() * allCharacteristics.length)];
}

// Get characteristic by name
export function getCharacteristicByName(name) {
    for (const category of Object.values(CHARACTERISTICS)) {
        const found = category.find(c => c.name === name);
        if (found) return found;
    }
    return null;
}

// Check if two characteristics should force commentary
export function shouldForceCommentary(char1, char2) {
    // Size extremes
    const bigDicks = ["The Horse Cock", "The Monster", "Donkey Dick", "The Anaconda", "Alpha Hog"];
    const smallDicks = ["Pencil Dick", "Baby Carrot", "The Acorn", "Micro Mike", "Button Mushroom", "The Innie", "Tic Tac", "Pinky Finger", "The Nugget", "Clit Dick"];
    
    if ((bigDicks.includes(char1.name) && smallDicks.includes(char2.name)) ||
        (smallDicks.includes(char1.name) && bigDicks.includes(char2.name))) {
        return true;
    }
    
    // Either has forceComment flag
    return char1.forceComment || char2.forceComment;
}