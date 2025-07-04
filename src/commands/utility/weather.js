import { Command } from '../base.js';
import { getWeather } from '../../services/weather.js';

// Temperature-based crude responses
const hotResponses = [
    "fuckin' hell, me balls are sweatin' like a whore in church",
    "hot as satan's arsehole out there",
    "sweatin' more than a fat bloke runnin' for the ice cream truck",
    "hot enough to fry an egg on me cock",
    "hotter than shazza after a few wines",
    "me nuts are stuck to me leg it's that fuckin' hot",
    "sweatin' like a pedophile at a wiggles concert",
    "hot as a stolen TV mate",
    "could cook a snag on the footpath it's that hot",
    "hotter than two rats fuckin' in a wool sock"
];

const coldResponses = [
    "cold as a witch's tit out there",
    "me dick's shriveled up to the size of a cashew",
    "freezin' me balls off, they've gone back inside",
    "colder than shazza when I forget our anniversary",
    "nipples could cut glass it's that cold",
    "me cock's turned into an innie",
    "cold enough to freeze the balls off a brass monkey",
    "shrinkage alert! me old fella's gone into hibernation",
    "colder than a dead dingo's donger",
    "freezin' like a nun's nasty"
];

const niceResponses = [
    "perfect weather for crackin' a few tinnies",
    "not bad, might actually leave the house today",
    "decent enough to sit on the porch and punch a few cones",
    "weather's alright, unlike me fuckin' life",
    "good as gold for a barbie and some bongs",
    "perfect weather to do fuck all in",
    "nice enough to pretend I'm lookin' for work",
    "weather's mint, time to get on the piss",
    "beaut day for gettin' cooked in the backyard",
    "tops weather for a sesh with the boys"
];

const rainyResponses = [
    "pissin' down like a cow on a flat rock",
    "wetter than an otter's pocket out there",
    "rainin' harder than shazza yellin' at me for smokin' inside",
    "wet as a shag on a rock",
    "pissin' down, good excuse to stay in and rip bongs",
    "rainin' cats and dogs, probably literal in this shithole",
    "wetter than a submarine with screen doors",
    "bucketing down like me bladder after 20 beers",
    "rainin' like a bastard, perfect bong weather",
    "wet enough to drown a fish"
];

const unknownLocationResponses = [
    "never heard of that shithole mate",
    "that place even real? or you just makin' shit up?",
    "fuck knows where that is, probably doesn't exist",
    "you havin' a laugh? that ain't a real place",
    "either you can't spell or that place is made up",
    "what kinda cooked cunt names a place that?",
    "mate that sounds like somewhere you'd find in shazza's romance novels",
    "pull the other one, that place ain't real",
    "sounds like a place I'd make up when I'm cooked",
    "that place exists about as much as me job prospects"
];

const errorResponses = [
    "weather service is fucked, probably the government's fault",
    "can't check shit right now, internet's probably cut off again",
    "weather machine's broken, just like everything else in me life",
    "system's cooked mate, probably needs a cone to fix it",
    "error? more like terror, this shit's fucked",
    "computer says no, just like centrelink",
    "weather service is having a sook, try again later",
    "it's carked it mate, probably needs a kick",
    "broken as me relationship with shazza",
    "fucked if I know what's wrong, probably needs turning off and on"
];

export default new Command({
    name: 'weather',
    aliases: ['w'],
    description: 'Check weather',
    usage: '!weather <location>',
    category: 'utility',
    cooldown: 10000,
    cooldownMessage: 'still lookin\' out the window mate, check back in {time}s',
    
    async handler(bot, message, args) {
        if (!args.length) {
            const noArgsResponses = [
                'weather where ya dropkick?',
                'gotta tell me where dickhead',
                'where? ya muppet',
                'location required ya numpty',
                'weather for where? me arsehole?',
                'need a place name ya daft cunt',
                'where abouts? can\'t read minds mate',
                'location? or should I just guess like a fuckin\' psychic?',
                'oi specify a location ya donkey',
                'where? use ya words mate'
            ];
            bot.sendMessage(message.roomId, noArgsResponses[Math.floor(Math.random() * noArgsResponses.length)]);
            return { success: true };
        }
        
        const location = args.join(' ');
        
        try {
            const weather = await getWeather(location);
            
            // Extract temperature from weather string
            const tempMatch = weather.match(/([+-]?\d+)°C/);
            let crudeResponse = '';
            
            if (tempMatch) {
                const temp = parseInt(tempMatch[1]);
                
                // Select response based on temperature
                if (temp >= 30) {
                    crudeResponse = hotResponses[Math.floor(Math.random() * hotResponses.length)];
                } else if (temp <= 10) {
                    crudeResponse = coldResponses[Math.floor(Math.random() * coldResponses.length)];
                } else {
                    crudeResponse = niceResponses[Math.floor(Math.random() * niceResponses.length)];
                }
            } else {
                // Check for rain in the weather string
                if (weather.toLowerCase().includes('rain') || weather.toLowerCase().includes('drizzle')) {
                    crudeResponse = rainyResponses[Math.floor(Math.random() * rainyResponses.length)];
                } else {
                    crudeResponse = niceResponses[Math.floor(Math.random() * niceResponses.length)];
                }
            }
            
            // Format response with location and crude comment
            const responses = [
                `${location}: ${weather}. ${crudeResponse}`,
                `fuckin' ${location} - ${weather}. ${crudeResponse}`,
                `${weather} in ${location}. ${crudeResponse}`,
                `oi ${location}'s ${weather}. ${crudeResponse}`,
                `${location} weather check: ${weather}. ${crudeResponse}`,
                `mate, ${location} is ${weather}. ${crudeResponse}`,
                `${weather} over in ${location}. ${crudeResponse}`,
                `${location}: ${weather} - ${crudeResponse}`,
                `checked ${location} for ya - ${weather}. ${crudeResponse}`,
                `${location}'s lookin' like ${weather}. ${crudeResponse}`
            ];
            
            bot.sendMessage(message.roomId, responses[Math.floor(Math.random() * responses.length)]);
            return { success: true };
        } catch (error) {
            bot.logger.error('Weather error:', error);
            if (error.message === 'Unknown location') {
                bot.sendMessage(message.roomId, unknownLocationResponses[Math.floor(Math.random() * unknownLocationResponses.length)]);
            } else {
                bot.sendMessage(message.roomId, errorResponses[Math.floor(Math.random() * errorResponses.length)]);
            }
            return { success: true };
        }
    }
});