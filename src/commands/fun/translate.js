import { Command } from '../base.js';
import { translateToAussie } from '../../services/translator.js';

// Crude responses about translations
const crudeResponses = [
    // General crude translation jokes
    'fuckin hell {username}, even google translate got a bigger vocab than you',
    'oi {username}, i translated that but it still sounds like shit mate',
    'jesus {username}, that translation made about as much sense as a screen door on a submarine',
    '{username} mate, i speak better french after 20 bongs and that\'s saying something',
    'crikey {username}, that got lost in translation worse than my dick in shazza\'s fat rolls',
    
    // Sexual innuendo about language barriers
    'yeah {username}, language barriers never stopped me rootin foreign sheilas',
    'reminds me of this swedish bird i rooted, didn\'t understand a word but she knew what "harder" meant',
    '{username} that\'s what the thai ladyboy said before i realized what was happening',
    'oi {username}, only phrase you need internationally is "wanna root?" trust me mate',
    'fuck {username}, i\'ve made more international connections than qantas if ya know what i mean',
    
    // Mocking different languages
    'hon hon hon baguette {username}, that\'s all the french ya need mate',
    'ching chong bing bong, there\'s ya chinese translation {username}',
    '{username} why learn spanish when "cerveza" and "puta" covers everything important',
    'oi {username}, germans sound angry even when they\'re talking about butterflies',
    'italian\'s easy {username}, just wave ya hands around like a poofter',
    
    // Variations for swear words detected
    'fuck me {username}, you kiss ya mother with that mouth? she charges me extra for that',
    'strewth {username}, that\'s filthier than the magazines under me mattress',
    '{username} mate, i haven\'t heard language that colorful since i walked in on me parents',
    'bloody hell {username}, save that dirty talk for the bedroom ya horny cunt',
    'oi {username}, that\'s nastier than finding pubes in ya maccas burger',
    
    // International sex/relationship jokes
    'that\'s how i sweet talked that brazilian bird at the servo {username}',
    '{username} reminds me of me mail order bride, couldn\'t understand her either',
    'yeah {username}, i told the german backpacker the same thing before she left crying',
    'oi {username}, that\'s smoother than the pickup lines i use on tourist sheilas',
    'fuck {username}, i\'ve had better communication with me right hand'
];

// Responses for sexual content
const sexualContentResponses = [
    'oi oi {username}, getting a bit frisky with the translator are we?',
    'fuck me {username}, save that for pornhub mate',
    '{username} ya dirty bastard, the translator\'s blushing',
    'christ {username}, even google needs a cold shower after that one',
    'bloody hell {username}, that\'s hornier than a three-balled tomcat'
];

// Responses for when already in Aussie
const alreadyAussieResponses = [
    '{username} ya drongo, that\'s already in perfect aussie',
    'oi {username}, can\'t improve on perfection mate',
    'fuck me {username}, that\'s already translated ya numpty',
    '{username} mate, that\'s like asking me to make vegemite more australian',
    'bloody hell {username}, what am i supposed to do, add more cunts to it?'
];

// Check if text contains sexual terms
function hasSexyContent(text) {
    const sexyWords = ['sex', 'fuck', 'root', 'cock', 'dick', 'pussy', 'tits', 'ass', 'porn', 'nude', 'naked', 'horny', 'bang', 'shag', 'bonk'];
    const lower = text.toLowerCase();
    return sexyWords.some(word => lower.includes(word));
}

// Check if text contains swear words
function hasSwearing(text) {
    const swearWords = ['fuck', 'shit', 'cunt', 'piss', 'bastard', 'bitch', 'damn', 'hell', 'arse', 'ass'];
    const lower = text.toLowerCase();
    return swearWords.some(word => lower.includes(word));
}

export default new Command({
    name: 'translate',
    aliases: ['trans', 'aussie'],
    description: 'Translate to Australian',
    usage: '!translate <text>',
    category: 'fun',
    cooldown: 3000,
    
    async handler(bot, message, args) {
        if (!args.length) {
            bot.sendMessage(message.roomId, 'translate what ya galah?');
            return { success: true };
        }
        
        const text = args.join(' ');
        const translated = translateToAussie(text);
        
        // Detect what kind of crude response to use
        let response;
        if (hasSexyContent(text)) {
            response = sexualContentResponses[Math.floor(Math.random() * sexualContentResponses.length)];
        } else if (translated.includes('already proper Aussie')) {
            response = alreadyAussieResponses[Math.floor(Math.random() * alreadyAussieResponses.length)];
        } else if (hasSwearing(text)) {
            // Use swearing-specific responses
            const swearResponses = crudeResponses.filter((r, i) => i >= 15 && i <= 19);
            response = swearResponses[Math.floor(Math.random() * swearResponses.length)];
        } else {
            response = crudeResponses[Math.floor(Math.random() * crudeResponses.length)];
        }
        
        // Replace username placeholder
        response = response.replace('{username}', `-${message.username}`);
        
        // Send both the crude response and translation
        bot.sendMessage(message.roomId, `${response} ... ${translated}`);
        
        return { success: true };
    }
});