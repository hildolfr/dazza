import { Command } from '../base.js';

export default new Command({
    name: 'uptime',
    description: 'Show bot uptime',
    usage: '!uptime',
    category: 'basic',
    users: ['hildolfr'],
    cooldown: 5000,
    
    async handler(bot, message, args) {
        const uptime = bot.getUptime();
        
        const responses = [
            `been up for ${uptime}, just like me dick when shazza walks past in her trackie dacks`,
            `${uptime} of bein harder than a cat's head, unlike me cock after 50 cones`,
            `still goin after ${uptime}, reckon me knob's been up longer than that but`,
            `${uptime} mate, that's longer than i lasted with shazza last night after me 20th cone`,
            `been throbbin away for ${uptime}, bit like me old fella when i wake up for a piss`,
            `${uptime} of pure fuckin endurance, unlike me dick after a carton of VB`,
            `runnin for ${uptime}, that's more stamina than me root on dole day`,
            `${uptime} and still harder than chinese algebra, just like me morning wood`,
            `been erectin meself for ${uptime}, need another cone to keep the blood flowin`,
            `${uptime} of bein up, which is ${uptime} longer than me cock stays up these days`,
            `still vertical after ${uptime}, must be all them durries keepin me rigid`,
            `${uptime} of throbbin like a dog's dick, gonna need more cones to maintain altitude`,
            `been stiffer than a wedding prick for ${uptime}, fuckin oath`,
            `${uptime} mate, that's longer than it takes me to blow me load after a goon sesh`
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        bot.sendMessage(randomResponse);
        
        return { success: true };
    }
});