import { Command } from '../base.js';

export default new Command({
    name: 'top',
    description: 'Show leaderboards',
    usage: '!top [talkers|bongs|drinkers|quoted|gamblers|fishing|bottles|cashie|sign_spinning|beggars]',
    category: 'stats',
    cooldown: 2000,
    
    async handler(bot, message, args) {
        const category = args[0]?.toLowerCase();
        
        try {
            // If no category specified, list options
            if (!category) {
                bot.sendMessage('!top [talkers|bongs|drinkers|quoted|gamblers|fishing|bottles|cashie|sign_spinning|beggars]');
                return { success: true };
            }
            
            let results;
            let title;
            
            switch (category) {
                case 'talkers':
                case 'talker':
                    results = await bot.db.getTopTalkers(5);
                    title = 'Top yappers:';
                    break;
                    
                case 'bongs':
                case 'bong':
                    results = await bot.db.getTopBongUsers(5);
                    title = '🌿 Most cooked cunts:';
                    break;
                    
                case 'drinkers':
                case 'drinker':
                case 'drinks':
                case 'drink':
                case 'pissheads':
                case 'alcoholics':
                    results = await bot.db.getTopDrinkers(5);
                    title = '🍺 Top Piss-heads:';
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
                    
                case 'cashie':
                case 'cashies':
                case 'cash':
                    results = await bot.db.getTopCashieWorkers(5);
                    title = '💪 HARDEST WORKING CASH-IN-HAND CREW 💪\nThese legends know how to hustle:';
                    break;
                    
                case 'beggars':
                case 'beggar':
                case 'begging':
                case 'beg':
                    results = await bot.db.getTopBeggars(5);
                    title = '🤲 SHAMELESS BEGGARS 🤲\nThese pathetic cunts have no dignity:';
                    break;
                    
                case 'sign_spinning':
                case 'sign':
                case 'signspinning':
                case 'signs':
                    results = await bot.db.getTopSignSpinners(5);
                    title = '🪧 PROFESSIONAL SIGN SPINNERS 🪧\nMasters of roadside advertising:';
                    break;
                    
                default:
                    bot.sendMessage('!top [talkers|bongs|drinkers|quoted|gamblers|fishing|bottles|cashie|sign_spinning|beggars]');
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
                } else if (category === 'drinkers' || category === 'drinker' || category === 'drinks' || category === 'drink' || category === 'pissheads' || category === 'alcoholics') {
                    value = `${r.drink_count} drinks`;
                    if (r.drink_count >= 500) extra = ' 💀';
                    else if (r.drink_count >= 100) extra = ' 🍺';
                } else if (category === 'quoted' || category === 'quotes') {
                    value = `${r.quotable_messages} bangers`;
                } else if (category === 'bottles' || category === 'bottle' || category === 'recycling') {
                    value = `$${r.total_earnings} (${r.collection_count} runs)`;
                    if (r.total_earnings >= 1000) extra = ' 🏆';
                    else if (r.total_earnings >= 500) extra = ' 💰';
                } else if (category === 'cashie' || category === 'cashies' || category === 'cash') {
                    value = `$${r.total_earnings} (${r.job_count} jobs)`;
                    if (r.total_earnings >= 3000) extra = ' 🤑';
                    else if (r.total_earnings >= 1500) extra = ' 💸';
                    else if (r.total_earnings >= 500) extra = ' 💰';
                } else if (category === 'beggars' || category === 'beggar' || category === 'begging' || category === 'beg') {
                    value = `${r.times_begged} begs, $${r.total_received} (${r.success_rate}% success)`;
                    if (r.times_robbed > 0) {
                        value = `${r.times_begged} begs, $${r.total_received} (robbed ${r.times_robbed}x)`;
                    }
                    // Add shaming emojis for frequent beggars
                    if (r.times_begged >= 20) extra = ' 🤡💩';
                    else if (r.times_begged >= 10) extra = ' 🤡';
                    else if (r.times_begged >= 5) extra = ' 😔';
                } else if (category === 'sign_spinning' || category === 'sign' || category === 'signspinning' || category === 'signs') {
                    value = `$${r.total_earnings} (${r.total_spins} shifts)`;
                    if (r.perfect_days > 0) extra = ` ${r.perfect_days} perfect days 🌟`;
                    else if (r.best_shift >= 100) extra = ' 💪';
                    else if (r.cops_called > 0) extra = ` (${r.cops_called}x cop trouble)`;
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