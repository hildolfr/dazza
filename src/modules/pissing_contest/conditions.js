// Condition types and their effects
export const CONDITIONS = {
    // FAILURE CONDITIONS (instant loss)
    failure: [
        {
            name: "Stage Fright",
            type: "failure",
            description: "can't perform under pressure",
            message: "couldn't even get it out"
        },
        {
            name: "Shy Bladder", 
            type: "failure",
            description: "someone's watching, can't start",
            message: "got shy bladder and froze up"
        },
        {
            name: "Equipment Malfunction",
            type: "failure", 
            description: "something's wrong down there",
            message: "had equipment problems"
        },
        {
            name: "The Clench",
            type: "failure",
            description: "gotta shit too bad, can't piss",
            message: "clenched too hard to piss"
        },
        {
            name: "Whiskey Dick",
            type: "failure",
            description: "too drunk to function",
            message: "was too pissed to piss"
        },
        {
            name: "Froze Solid",
            type: "failure",
            description: "too cold, turtle mode",
            message: "went full turtle mode"
        },
        {
            name: "Pulled a Muscle",
            type: "failure",
            description: "tried too hard, injured",
            message: "hurt himself trying"
        },
        {
            name: "Cop Showed Up",
            type: "failure",
            description: "both players run away",
            message: "got spooked by the cops",
            mutual: true
        }
    ],

    // DEBUFF CONDITIONS
    debuff: [
        {
            name: "Split Stream",
            type: "debuff",
            effects: { distance: -50 },
            description: "stream splits in two",
            message: "got split stream"
        },
        {
            name: "Weak Flow",
            type: "debuff",
            effects: { all: -20 },
            description: "pathetic pressure",
            message: "suffering from weak flow"
        },
        {
            name: "The Shakes",
            type: "debuff",
            effects: { random_stat: -40 },
            description: "uncontrollable shaking",
            message: "got the shakes"
        },
        {
            name: "Can't Find It",
            type: "debuff",
            effects: { duration: -15 },
            description: "fumbling around",
            message: "couldn't find it quickly"
        },
        {
            name: "Zipper Stuck",
            type: "debuff",
            effects: { volume: -25 },
            description: "late start",
            message: "zipper got stuck"
        },
        {
            name: "The Dribbles",
            type: "debuff",
            effects: { distance_max: 1 },
            description: "pathetic dribble",
            message: "just dribbling"
        },
        {
            name: "Twisted Nut",
            type: "debuff",
            effects: { all: -50 },
            description: "extreme pain",
            message: "twisted a nut in agony"
        },
        {
            name: "Sack Stuck",
            type: "debuff",
            effects: { aim: -40, volume: -30 },
            description: "zipper accident",
            message: "sack stuck in zipper"
        }
    ],

    // BUFF CONDITIONS
    buff: [
        {
            name: "Perfect Pressure",
            type: "buff",
            effects: { distance: 30 },
            description: "ideal bladder pressure",
            message: "achieved perfect pressure"
        },
        {
            name: "Morning Glory",
            type: "buff",
            effects: { all: 15 },
            description: "morning advantage",
            message: "blessed with morning glory"
        },
        {
            name: "The Zone",
            type: "buff",
            effects: { immune_debuffs: true },
            description: "in the zone",
            message: "entered the zone"
        },
        {
            name: "Hydro Power",
            type: "buff",
            effects: { volume: 40 },
            description: "well hydrated",
            message: "powered by hydration"
        },
        {
            name: "Laser Focus",
            type: "buff",
            effects: { duration: 25 },
            description: "total concentration",
            message: "achieved laser focus"
        }
    ],

    // WEIRD/COMBO CONDITIONS
    weird: [
        {
            name: "Backwards Flow",
            type: "weird",
            effects: { distance: -999 },
            description: "pissed on self",
            message: "somehow pissed backwards on himself"
        },
        {
            name: "The Fountain",
            type: "weird",
            effects: { distance: 0, straight_up: true },
            description: "straight up fountain",
            message: "created a fountain straight up"
        },
        {
            name: "Ghost Piss",
            type: "weird",
            effects: { volume: 0 },
            description: "no volume recorded",
            message: "ghost piss - where'd it go?"
        },
        {
            name: "The Infinite Stream",
            type: "weird",
            effects: { duration: 999 },
            description: "won't stop pissing",
            message: "can't stop pissing (medical emergency)"
        },
        {
            name: "Piss Shivers",
            type: "weird",
            effects: { aim: -50, shaking: true },
            description: "uncontrollable shaking",
            message: "got the piss shivers"
        },
        {
            name: "The Misfire",
            type: "weird",
            effects: { wrong_way: true },
            description: "aimed wrong way",
            message: "misfired completely wrong direction"
        },
        {
            name: "Power Washer",
            type: "weird",
            effects: { distance: 50, volume: 50, duration: -50 },
            description: "extreme pressure burst",
            message: "went full power washer mode"
        },
        {
            name: "The Trickle",
            type: "weird",
            effects: { duration: 80, distance: -80, volume: -80 },
            description: "eternal trickle",
            message: "trickling forever"
        },
        {
            name: "Fire Hose",
            type: "weird",
            effects: { all: 30, aim: -60 },
            description: "uncontrolled power",
            message: "fire hose mode activated"
        }
    ]
};

// Get random condition (natural roll)
export function getRandomCondition() {
    // 10% chance of condition
    if (Math.random() > 0.1) return null;
    
    // Weight different condition types
    const weights = {
        failure: 1,
        debuff: 6,
        buff: 2,
        weird: 1
    };
    
    // Build weighted array
    const weightedTypes = [];
    for (const [type, weight] of Object.entries(weights)) {
        for (let i = 0; i < weight; i++) {
            weightedTypes.push(type);
        }
    }
    
    // Pick random type
    const type = weightedTypes[Math.floor(Math.random() * weightedTypes.length)];
    const conditions = CONDITIONS[type];
    
    return conditions[Math.floor(Math.random() * conditions.length)];
}

// Apply condition effects to stats
export function applyConditionEffects(stats, condition) {
    if (!condition || !condition.effects) return stats;
    
    const newStats = { ...stats };
    
    for (const [key, value] of Object.entries(condition.effects)) {
        switch (key) {
            case 'all':
                // Apply to all stats
                newStats.distance *= (1 + value / 100);
                newStats.volume *= (1 + value / 100);
                newStats.aim *= (1 + value / 100);
                newStats.duration *= (1 + value / 100);
                break;
                
            case 'random_stat':
                // Apply to random stat
                const statNames = ['distance', 'volume', 'aim', 'duration'];
                const randomStat = statNames[Math.floor(Math.random() * statNames.length)];
                newStats[randomStat] *= (1 + value / 100);
                break;
                
            case 'distance':
            case 'volume':
            case 'aim':
            case 'duration':
                newStats[key] *= (1 + value / 100);
                break;
                
            case 'distance_max':
                newStats.distance = Math.min(newStats.distance, value);
                break;
                
            case 'distance_min':
                newStats.distance = Math.max(newStats.distance, value);
                break;
                
            case 'volume_min':
                newStats.volume = Math.max(newStats.volume, value);
                break;
                
            case 'duration_max':
                newStats.duration = Math.min(newStats.duration, value);
                break;
                
            case 'duration_min':
                newStats.duration = Math.max(newStats.duration, value);
                break;
                
            // Special flags handled elsewhere
            case 'immune_debuffs':
            case 'straight_up':
            case 'wrong_way':
            case 'shaking':
                newStats[key] = value;
                break;
        }
    }
    
    return newStats;
}

// Check if condition causes instant failure
export function isFailureCondition(condition) {
    return condition && condition.type === 'failure';
}

// Get condition by name
export function getConditionByName(name) {
    for (const category of Object.values(CONDITIONS)) {
        const found = category.find(c => c.name === name);
        if (found) return found;
    }
    return null;
}