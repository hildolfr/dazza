// Weather system for pissing contests
export const WEATHER = {
    wind: [
        {
            name: "Dead Still",
            effects: {},
            description: "no wind"
        },
        {
            name: "Light Breeze",
            effects: { distance_variance: 10, aim: -5 },
            description: "gentle breeze"
        },
        {
            name: "Gusty as Fuck",
            effects: { distance_variance: 30, aim: -20 },
            description: "unpredictable gusts"
        },
        {
            name: "Cyclone Warning",
            effects: { distance_tailwind: 50, distance_headwind: -40, aim: -60 },
            description: "extreme winds"
        },
        {
            name: "Dust Storm",
            effects: { aim: -80, might_hit_opponent: true },
            description: "can't see shit"
        },
        {
            name: "Willy Willy",
            effects: { random_effects: true },
            description: "spinning wind chaos"
        }
    ],

    temperature: [
        {
            name: "Freezing Me Nuts Off",
            temp: "<5°C",
            effects: { volume: -40, duration: 20, turtle_mode: true },
            description: "ball-shrinking cold"
        },
        {
            name: "Bit Nippy",
            temp: "5-15°C", 
            effects: { volume: -20 },
            description: "slight shrinkage"
        },
        {
            name: "Not Too Shabby",
            temp: "15-25°C",
            effects: {},
            description: "decent enough"
        },
        {
            name: "Bloody Hot",
            temp: "25-35°C",
            effects: { volume: 30, duration: -20 },
            description: "hydration advantage"
        },
        {
            name: "Satan's Armpit",
            temp: ">35°C",
            effects: { volume: -50, pass_out_chance: 0.1 },
            description: "dehydration danger"
        },
        {
            name: "Humid as Balls",
            temp: "any + humidity",
            effects: { aim: -30, duration: 40 },
            description: "sweaty mess"
        }
    ],

    special: [
        {
            name: "Pissing Rain",
            effects: { aim: -40, volume: 20 },
            description: "ironic weather",
            message: "it's pissin' down!"
        },
        {
            name: "Hailstorm",
            effects: { instant_forfeit_chance: 0.2 },
            description: "dangerous hail",
            message: "fuck! hail!"
        },
        {
            name: "Lightning Storm", 
            effects: { malfunction_chance: 10 },
            description: "metal zipper danger",
            message: "lightning risk!"
        }
    ]
};

// Get random weather
export function getRandomWeather() {
    const weather = {
        wind: null,
        temperature: null,
        special: null
    };
    
    // Always have wind
    weather.wind = WEATHER.wind[Math.floor(Math.random() * WEATHER.wind.length)];
    
    // Always have temperature
    weather.temperature = WEATHER.temperature[Math.floor(Math.random() * WEATHER.temperature.length)];
    
    // 10% chance of special weather
    if (Math.random() < 0.1) {
        weather.special = WEATHER.special[Math.floor(Math.random() * WEATHER.special.length)];
    }
    
    return weather;
}

// Apply weather effects
export function applyWeatherEffects(stats, weather, isWindSailor = false) {
    const newStats = { ...stats };
    
    // Apply wind effects
    if (weather.wind && weather.wind.effects) {
        const windMultiplier = isWindSailor ? 2 : 1;
        
        if (weather.wind.effects.distance_variance) {
            const variance = weather.wind.effects.distance_variance * windMultiplier;
            const adjustment = (Math.random() - 0.5) * 2 * variance;
            newStats.distance *= (1 + adjustment / 100);
        }
        
        if (weather.wind.effects.distance_tailwind && Math.random() < 0.5) {
            newStats.distance *= (1 + (weather.wind.effects.distance_tailwind * windMultiplier) / 100);
        }
        
        if (weather.wind.effects.distance_headwind && Math.random() < 0.5) {
            newStats.distance *= (1 + (weather.wind.effects.distance_headwind * windMultiplier) / 100);
        }
        
        if (weather.wind.effects.aim) {
            newStats.aim *= (1 + (weather.wind.effects.aim * windMultiplier) / 100);
        }
    }
    
    // Apply temperature effects
    if (weather.temperature && weather.temperature.effects) {
        for (const [key, value] of Object.entries(weather.temperature.effects)) {
            if (typeof value === 'number') {
                switch (key) {
                    case 'volume':
                    case 'duration':
                    case 'aim':
                        newStats[key] *= (1 + value / 100);
                        break;
                }
            }
        }
    }
    
    // Apply special weather effects
    if (weather.special && weather.special.effects) {
        for (const [key, value] of Object.entries(weather.special.effects)) {
            if (typeof value === 'number') {
                switch (key) {
                    case 'aim':
                    case 'volume':
                        newStats[key] *= (1 + value / 100);
                        break;
                }
            }
        }
    }
    
    return newStats;
}

// Format weather for display
export function formatWeather(weather) {
    const parts = [];
    
    if (weather.wind) {
        parts.push(weather.wind.name);
    }
    
    if (weather.temperature) {
        parts.push(weather.temperature.name);
    }
    
    if (weather.special) {
        parts.push(weather.special.name);
    }
    
    return parts.join(", ");
}

// Check for weather-based events
export function checkWeatherEvents(weather, stats) {
    const events = [];
    
    if (weather.wind && weather.wind.effects.might_hit_opponent && Math.random() < 0.3) {
        events.push({
            type: 'hit_opponent',
            message: "wind blew piss onto opponent!"
        });
    }
    
    if (weather.temperature && weather.temperature.effects.turtle_mode && Math.random() < 0.3) {
        events.push({
            type: 'turtle_mode',
            message: "full turtle mode activated"
        });
    }
    
    if (weather.temperature && weather.temperature.effects.pass_out_chance && 
        Math.random() < weather.temperature.effects.pass_out_chance) {
        events.push({
            type: 'pass_out',
            message: "passed out from heat!"
        });
    }
    
    if (weather.special && weather.special.effects.instant_forfeit_chance && 
        Math.random() < weather.special.effects.instant_forfeit_chance) {
        events.push({
            type: 'instant_forfeit',
            message: "got hit by hail! Forfeit!"
        });
    }
    
    if (weather.special && weather.special.effects.malfunction_chance && 
        Math.random() < weather.special.effects.malfunction_chance / 100) {
        events.push({
            type: 'malfunction',
            message: "lightning struck zipper!"
        });
    }
    
    if (weather.wind && weather.wind.effects.random_effects) {
        // Willy willy causes random changes
        events.push({
            type: 'random_change',
            stat: ['distance', 'volume', 'aim', 'duration'][Math.floor(Math.random() * 4)],
            change: Math.random() < 0.5 ? -30 : 30
        });
    }
    
    return events;
}

// Get weather/location combo effects
export function getComboEffects(weather, location) {
    const combos = [
        {
            condition: location.name === "Beach Shower Block" && weather.temperature.name === "Bloody Hot",
            name: "Dehydration Station",
            effects: { volume: -60 }
        },
        {
            condition: location.name.includes("Alley") && weather.special && weather.special.name === "Pissing Rain",
            name: "Slippery Dicks",
            effects: { aim: -40, fall_risk: true }
        },
        {
            condition: location.name.includes("Bush") && weather.wind.name.includes("Gusty"),
            name: "Piss Mist",
            effects: { hits_self: true }
        },
        {
            condition: location.name.includes("Servo") && weather.temperature.name === "Freezing Me Nuts Off",
            name: "Shrinkage City",
            effects: { all: -50 }
        }
    ];
    
    for (const combo of combos) {
        if (combo.condition) {
            return combo;
        }
    }
    
    return null;
}