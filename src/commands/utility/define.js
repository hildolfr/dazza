import { Command } from '../base.js';
import { getDefinition } from '../../services/dictionary.js';

// Crude responses for definitions
const crudeIntros = [
    "bloody hell {user}, ya don't know what {word} means? here ya go dickhead:",
    "oi {user}, did ya sleep through school or somethin? {word} means:",
    "farken hell {user}, even me missus knows what {word} is:",
    "{user} wants to know what {word} means... probably shoulda paid attention instead of havin a wank in class:",
    "crikey {user}, {word}? that's basic as mate:",
    "{user} needs a dictionary for {word}? bet ya need one for 'dickhead' too:",
    "strewth {user}, askin about {word}? here's what the fancy book says:",
    "{user} doesn't know {word}? must be all them bongs killin ya brain cells:",
    "oi {user}, put down the cone and listen up, {word} means:",
    "fuckin oath {user}, {word}? even dazza knows that one:",
    "{user} wants the definition of {word}? shoulda asked ya missus, she knows all about it:",
    "well bugger me {user}, {word}? here's what them educated cunts reckon it means:"
];

const crudeOutros = [
    "...now ya know, ya ignorant bastard",
    "...bet ya still don't get it but",
    "...write it down before ya forget again",
    "...or somethin like that, who gives a shit really",
    "...now piss off and let me get back to me bong",
    "...that's what the book says anyway, could be talkin shit",
    "...surprised ya can even read this far",
    "...now ya owe me a dart for the education",
    "...bet ya wish ya stayed in school now ay",
    "...there's ya free lesson for the day, cunt",
    "...don't make me explain it again",
    "...now stop botherin me with ya homework"
];

// Special responses for sexual/crude words
const dirtyWordResponses = {
    'sex': "hehehehe {user} wants to know about the birds and the bees... ask ya mum mate",
    'penis': "oi {user}, lookin in the dictionary for what ya haven't got? hahaha",
    'vagina': "{user} needs a map to find one of those mate? good luck with that",
    'boobs': "farken hell {user}, if ya need a dictionary for that ya need to get out more",
    'porn': "{user} wants the definition? it's what ya watch when the missus is at bingo",
    'masturbate': "hahaha {user} needs instructions? just do what comes naturally mate",
    'orgasm': "{user} askin about somethin they've never given anyone? rough",
    'dick': "oi {user}, just look in the mirror if ya want an example",
    'pussy': "{user} needs a dictionary? mate ya need to get off the computer",
    'ass': "crikey {user}, it's what ya talk out of most the time",
    'tits': "{user} askin about the good stuff? dictionary won't help ya see any mate",
    'cock': "hahaha {user} checkin if they spelled their nickname right?",
    'fuck': "strewth {user}, that's dazza's favorite word! means everything and nothin",
    'cum': "bloody hell {user}, some things ya learn by doin not readin",
    'dildo': "{user} shoppin for christmas presents? the missus will love that",
    'blowjob': "oi {user}, that's what ya give the boss to keep ya job",
    'anal': "farken hell {user}, that's what this conversation is - a pain in the arse",
    'boner': "{user} needs a definition? hasn't had one since high school probably",
    'horny': "that's you right now {user}, lookin up dirty words in the dictionary",
    'kinky': "oi {user}, that's what ya search history is mate"
};

// Responses for when no definition is found
const noDefResponses = [
    "never heard of that word {user}, must be some fancy uni bullshit",
    "oi {user}, ya just make that word up after a few cones?",
    "{user} that's not even a real word ya drongo",
    "farken hell {user}, stop makin up words",
    "dictionary doesn't have {word}... probably cause {user} can't spell for shit",
    "{user} mate, that's gibberish, lay off the bongs",
    "no such word as {word}, {user} must be cooked",
    "strewth {user}, even google doesn't know what the fuck {word} means",
    "{user} tryna sound smart with made up words? nice try dickhead",
    "oi {user}, {word} isn't in any dictionary, just like ya name isn't in any will"
];

export default new Command({
    name: 'define',
    aliases: ['def', 'urban'],
    description: 'Urban Dictionary definition',
    usage: '!define <word>',
    category: 'utility',
    cooldown: 5000,
    
    async handler(bot, message, args) {
        if (!args.length) {
            bot.sendMessage(message.roomId, 'define what mate?');
            return { success: true };
        }
        
        const word = args.join(' ').toLowerCase();
        const user = `-${message.username}`;
        
        // Check for special dirty word responses
        if (dirtyWordResponses[word]) {
            bot.sendMessage(message.roomId, dirtyWordResponses[word].replace('{user}', user));
            return { success: true };
        }
        
        try {
            const result = await getDefinition(word);
            
            // Pick random intro and outro
            const intro = crudeIntros[Math.floor(Math.random() * crudeIntros.length)]
                .replace('{user}', user)
                .replace('{word}', word);
            const outro = crudeOutros[Math.floor(Math.random() * crudeOutros.length)];
            
            let definition;
            if (typeof result === 'object') {
                definition = result.definition;
            } else {
                definition = result;
            }
            
            // Add some crude commentary for certain keywords in definitions
            if (definition.match(/love|romantic|relationship/i)) {
                bot.sendMessage(message.roomId, `${intro} ${definition}${outro} (gay)`);
            } else if (definition.match(/intelligent|smart|clever/i)) {
                bot.sendMessage(message.roomId, `${intro} ${definition}${outro} (unlike you)`);
            } else if (definition.match(/work|job|employment/i)) {
                bot.sendMessage(message.roomId, `${intro} ${definition}${outro} (somethin you'd know nothin about)`);
            } else if (definition.match(/money|rich|wealth/i)) {
                bot.sendMessage(message.roomId, `${intro} ${definition}${outro} (must be nice ay)`);
            } else {
                bot.sendMessage(message.roomId, `${intro} ${definition}${outro}`);
            }
            
            return { success: true };
        } catch (error) {
            bot.logger.error('Define error:', error);
            const noDefMsg = noDefResponses[Math.floor(Math.random() * noDefResponses.length)]
                .replace('{user}', user)
                .replace('{word}', word);
            bot.sendMessage(message.roomId, noDefMsg);
            return { success: true };
        }
    }
});