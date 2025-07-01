import { Command } from '../base.js';

export default new Command({
    name: 'mood',
    aliases: ['vibe', 'feeling'],
    description: 'Check Dazza\'s current mood',
    usage: '!mood',
    category: 'fun',
    cooldown: 30000,
    
    async handler(bot, message, args) {
        // Get current hour in Gold Coast time (UTC+10, no DST)
        const gcTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Australia/Brisbane"}));
        const hour = gcTime.getHours();
        const day = gcTime.getDay(); // 0 = Sunday, 6 = Saturday
        
        // Get today's bong count
        const bongCount = await bot.db.getBongCount(gcTime.toDateString());
        
        // Get recent message count (last hour)
        const recentMessages = await bot.db.getRecentMessages(50);
        const myRecentMessages = recentMessages.filter(m => 
            m.username.toLowerCase() === bot.username.toLowerCase() &&
            (Date.now() - m.timestamp) < 3600000 // last hour
        ).length;
        
        // Base mood based on time of day
        let mood, reason;
        
        if (hour >= 6 && hour < 12) {
            // Morning
            if (bongCount === 0) {
                mood = 'rough as guts';
                reason = 'haven\'t had me wake n bake yet';
            } else if (bongCount < 5) {
                mood = 'gettin there';
                reason = 'few cones in but could use more';
            } else {
                mood = 'pretty good';
                reason = 'nice morning session sorted';
            }
        } else if (hour >= 12 && hour < 17) {
            // Arvo
            if (bongCount < 10) {
                mood = 'bit dusty';
                reason = 'running behind on me cone quota';
            } else if (bongCount < 20) {
                mood = 'cruisin nicely';
                reason = 'good arvo on the gold coast';
            } else {
                mood = 'fuckin cooked';
                reason = `${bongCount} cones deep already`;
            }
        } else if (hour >= 17 && hour < 22) {
            // Evening
            if (bongCount < 15) {
                mood = 'bit antsy';
                reason = 'need to catch up on cones';
            } else if (bongCount < 30) {
                mood = 'mellow as';
                reason = 'perfect evening vibe';
            } else {
                mood = 'absolutely munted';
                reason = 'probably should slow down but won\'t';
            }
        } else {
            // Late night/early morning
            if (hour >= 22 || hour < 3) {
                mood = 'wired but tired';
                reason = 'classic late night gold coast energy';
            } else {
                mood = 'fuckin sideways';
                reason = 'what am I even doing up';
            }
        }
        
        // Weekend modifier
        if (day === 0 || day === 6) {
            if (bongCount > 25) {
                mood = 'living me best life';
                reason = 'weekend on the goldie with plenty of cones';
            }
        }
        
        // Activity-based modifiers
        if (myRecentMessages > 10) {
            mood = 'chatty as fuck';
            reason = 'must be the sativa';
        } else if (myRecentMessages === 0) {
            mood = 'quiet but lurkin';
            reason = 'just vibin and watchin videos';
        }
        
        // Special moods based on bong milestones
        if (bongCount === 69) {
            mood = 'nice';
            reason = 'you know why';
        } else if (bongCount === 100) {
            mood = 'achieved nirvana';
            reason = 'century of cones, gold coast legend';
        } else if (bongCount > 50) {
            mood = 'transcended reality';
            reason = 'existing on a higher plane';
        }
        
        // Random events
        const randomEvent = Math.random();
        if (randomEvent < 0.1) {
            mood = 'paranoid';
            reason = 'think the neighbours are cops';
        } else if (randomEvent < 0.2) {
            mood = 'hungry as';
            reason = 'could demolish a kebab right now';
        } else if (randomEvent < 0.3) {
            mood = 'philosophical';
            reason = 'contemplating the universe from me balcony';
        }
        
        const responses = [
            `feelin ${mood} ay, ${reason}`,
            `${mood} mate, ${reason}`,
            `fuckin ${mood} right now, ${reason}`,
            `${mood} as, ${reason}`,
            `yeah nah ${mood}, ${reason}`,
            `${mood} cobber, ${reason}`,
            `oi im ${mood}, ${reason}`
        ];
        
        bot.sendMessage(message.roomId, responses[Math.floor(Math.random() * responses.length)]);
        
        return { success: true };
    }
});