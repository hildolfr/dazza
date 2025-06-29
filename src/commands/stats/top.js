import { Command } from '../base.js';

export default new Command({
    name: 'top',
    description: 'Show leaderboards',
    usage: '!top [talkers|bongs|quoted|gamblers|fishing|bottles]',
    category: 'stats',
    cooldown: 10000,
    
    async handler(bot, message, args) {
        const category = args[0]?.toLowerCase();
        
        try {
            // If no category specified, ask for one
            if (!category) {
                bot.sendMessage('which leaderboard ya want mate? !top [talkers|bongs|quoted|gamblers|fishing|bottles]');
                return { success: true };
            }
            
            let results;
            let title;
            
            switch (category) {
                case 'talkers':
                case 'talker':
                    results = await bot.db.getTopTalkers(5);
                    title = '🏆 BIGGEST GOBS IN THE JOINT 🏆\nThese cunts never shut up:';
                    break;
                    
                case 'bongs':
                case 'bong':
                    results = await bot.db.getTopBongUsers(5);
                    title = '🌿 MOST COOKED CUNTS 🌿\nPunchin\' cones like it\'s their job:';
                    break;
                    
                case 'quoted':
                case 'quotes':
                    results = await bot.db.getTopQuotedUsers(5);
                    title = '💬 QUOTABLE LEGENDS 💬\nApparently these cunts are funny:';
                    break;
                    
                case 'gamblers':
                case 'gambler':
                case 'gambling':
                    results = await bot.db.getTopGamblers(5);
                    title = '🎰 LUCKY BASTARDS AT THE POKIES 🎰\nBiggest wins (probably all lost by now):';
                    break;
                    
                case 'fishing':
                case 'fish':
                case 'fishers':
                    results = await bot.db.getTopFishers(5);
                    title = '🎣 MASTER BAITERS LEADERBOARD 🎣\nBiggest catches down at the wharf:';
                    break;
                    
                case 'bottles':
                case 'bottle':
                case 'recycling':
                    results = await bot.db.getTopBottleCollectors(5);
                    title = '♻️ ECO WARRIORS AT THE DEPOT ♻️\nTop bottle collectors (professional piss-heads):';
                    break;
                    
                default:
                    bot.sendMessage('!top [talkers|bongs|quoted|gamblers|fishing|bottles]');
                    return { success: true };
            }
            
            if (!results || results.length === 0) {
                bot.sendMessage('fuck all data on that one yet');
                return { success: true };
            }
            
            const topList = results.map((r, i) => {
                let value;
                let extra = '';
                
                if (category === 'gamblers' || category === 'gambler' || category === 'gambling') {
                    value = `$${r.biggest_win}`;
                    // Add win type
                    if (r.transaction_type === 'pokies') extra = ' (pokies)';
                    else if (r.transaction_type === 'scratchie') extra = ' (scratchie)';
                    else if (r.transaction_type === 'tab') extra = ' (TAB)';
                    if (r.biggest_win >= 1000) extra += ' 💰';
                } else if (category === 'fishing' || category === 'fish' || category === 'fishers') {
                    value = `${r.biggest_catch}kg ${r.fish_type || ''}`;
                    if (r.biggest_catch >= 10) extra = ' 🐋';
                    else if (r.biggest_catch >= 5) extra = ' 🦈';
                } else if (category === 'bongs' || category === 'bong') {
                    value = `${r.bong_count} cones`;
                    if (r.bong_count >= 100) extra = ' 💀';
                } else if (category === 'quoted' || category === 'quotes') {
                    value = `${r.quotable_messages} bangers`;
                } else if (category === 'bottles' || category === 'bottle' || category === 'recycling') {
                    value = `$${r.total_earnings.toFixed(2)} (${r.collection_count} runs, best: $${r.best_haul.toFixed(2)})`;
                    if (r.total_earnings >= 1000) extra = ' 🏆';
                    else if (r.total_earnings >= 500) extra = ' 💰';
                } else {
                    value = `${r.message_count} messages`;
                }
                return `${i + 1}. -${r.username}: ${value}${extra}`;
            }).join('\n');
            
            bot.sendMessage(`${title}\n${topList}`);
            
            return { success: true };
        } catch (error) {
            console.error('Top command error:', error);
            bot.sendMessage(bot.personality.getResponse('error'));
            return { success: false };
        }
    }
});