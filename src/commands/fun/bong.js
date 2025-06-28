import { Command } from '../base.js';

export default new Command({
    name: 'bong',
    aliases: ['rip', 'cone', 'billy'],
    description: 'Rip a fat cone',
    usage: '!bong',
    category: 'fun',
    cooldown: 300000, // 5 minutes
    cooldownMessage: 'easy on the cones mate, ya lungs need {time}s to recover from that last rip',
    
    async handler(bot, message, args) {
        // Update bong counter first
        const today = new Date().toDateString();
        let newCount = 0;
        
        try {
            // Log user bong
            await bot.db.logUserBong(message.username);
            
            // Increment daily counter
            newCount = await bot.db.incrementBongCount(today);
        } catch (error) {
            console.error('Failed to update bong counter:', error);
        }
        
        const bongResponses = [
            `🌿 That's bong number ${newCount} for today mate`,
            `🌿 ${newCount} cones punched today, feelin' good`, 
            `🌿 Bong ${newCount} done, Shazza's gonna kill me`,
            `🌿 ${newCount} billies today, fuckin' legend`,
            `🌿 Cone ${newCount} sorted, time for a dart`,
            `🌿 *takes a massive fuckin rip* number ${newCount} down the hatch`,
            `🌿 *coughs violently* fuck me dead that was number ${newCount}`,
            `🌿 *bubbling sounds* ... *exhales* ... ${newCount} today, fuckin oath`,
            `🌿 Number ${newCount}... I'm already cooked as... *rips it anyway*`,
            `🌿 *packs a fresh cone* number ${newCount} for you legends *massive rip*`,
            `🌿 ${newCount} today already but... *takes another hit*`,
            `🌿 *chops up* oi Shazza! That's ${newCount}! *bubbling sounds*`,
            `🌿 *coughing fit* number ${newCount} went straight to me head`,
            `🌿 *rips the billy* ${newCount} down, yeah nah yeah that's fuckin mint`,
            `🌿 Number ${newCount}? *loads up the Gatorade bottle bong*`
        ];
        
        const response = bongResponses[Math.floor(Math.random() * bongResponses.length)];
        bot.sendMessage(response);
        
        // Special messages for milestones
        if (newCount % 50 === 0 && newCount > 0) {
            setTimeout(() => {
                bot.sendMessage(`fuckin hell lads, that's ${newCount} cones today! I think I can see through time`);
            }, 2000);
        } else if (newCount % 25 === 0 && newCount > 0) {
            setTimeout(() => {
                bot.sendMessage(`${newCount} billies! me lungs are fucked but we soldier on`);
            }, 2000);
        }
        
        return { success: true };
    }
});