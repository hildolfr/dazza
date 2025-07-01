import { Command } from '../base.js';

export default new Command({
    name: 'urls',
    aliases: ['url', 'links'],
    description: 'Shows recent URLs or URL statistics',
    usage: '!urls [username|stats|domain <domain>]',
    examples: [
        '!urls - Show recent URLs',
        '!urls stats - Show URL statistics',
        '!urls Bob - Show URLs posted by Bob',
        '!urls domain youtube.com - Show YouTube links'
    ],
    category: 'stats',
    cooldown: 5000,

    async handler(bot, message, args) {
        try {
            if (args.length === 0) {
                // Show recent URLs
                return await showRecentUrls(bot, message);
            }

            const subcommand = args[0].toLowerCase();

            if (subcommand === 'stats') {
                return await showUrlStats(bot, message);
            } else if (subcommand === 'domain' && args[1]) {
                return await showDomainUrls(bot, message, args[1]);
            } else {
                // Assume it's a username
                return await showUserUrls(bot, message, args[0]);
            }
        } catch (error) {
            bot.logger.error('Error in urls command', { error: error.message });
            bot.sendMessage(message.roomId, 'failed to retrieve URL data mate');
            return { success: false };
        }
    }

});

async function showRecentUrls(bot, message) {
        const urls = await bot.db.getRecentUrls(5, message.roomId);
        
        if (urls.length === 0) {
            bot.sendMessage(message.roomId, 'no URLs posted recently mate');
            return { success: true };
        }

        bot.sendMessage(message.roomId, `last ${urls.length} URLs:`);
        
        for (const urlEntry of urls) {
            const timeDiff = Date.now() - urlEntry.timestamp;
            const minutes = Math.floor(timeDiff / 60000);
            const hours = Math.floor(minutes / 60);
            
            let timeAgo;
            if (hours > 0) {
                timeAgo = `${hours}h ago`;
            } else if (minutes > 0) {
                timeAgo = `${minutes}m ago`;
            } else {
                timeAgo = 'just now';
            }
            
            const prefix = urlEntry.url.startsWith('http') ? '' : 'https://';
            bot.sendMessage(message.roomId, `-${urlEntry.username} (${timeAgo}): ${prefix}${urlEntry.url}`);
        }
        
        return { success: true };
}

async function showUrlStats(bot, message) {
        const stats = await bot.db.getUrlStats(message.roomId);
        
        bot.sendMessage(message.roomId, `URL stats: ${stats.totalUrls} total links from ${stats.uniqueDomains} domains`);
        
        if (stats.topDomains.length > 0) {
            const topDomainsStr = stats.topDomains
                .slice(0, 5)
                .map(d => `${d.domain} (${d.count})`)
                .join(', ');
            bot.sendMessage(message.roomId, `top domains: ${topDomainsStr}`);
        }
        
        if (stats.topPosters.length > 0) {
            const topPostersStr = stats.topPosters
                .slice(0, 5)
                .map(p => `-${p.username} (${p.count})`)
                .join(', ');
            bot.sendMessage(message.roomId, `top link posters: ${topPostersStr}`);
        }
        
        return { success: true };
}

async function showUserUrls(bot, message, username) {
        const urls = await bot.db.getUrlsByUser(username, 5, message.roomId);
        
        if (urls.length === 0) {
            bot.sendMessage(message.roomId, `no URLs found from -${username}`);
            return { success: true };
        }

        bot.sendMessage(message.roomId, `last ${urls.length} URLs from -${username}:`);
        
        for (const urlEntry of urls) {
            const timeDiff = Date.now() - urlEntry.timestamp;
            const minutes = Math.floor(timeDiff / 60000);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            
            let timeAgo;
            if (days > 0) {
                timeAgo = `${days}d ago`;
            } else if (hours > 0) {
                timeAgo = `${hours}h ago`;
            } else if (minutes > 0) {
                timeAgo = `${minutes}m ago`;
            } else {
                timeAgo = 'just now';
            }
            
            const prefix = urlEntry.url.startsWith('http') ? '' : 'https://';
            bot.sendMessage(message.roomId, `${timeAgo}: ${prefix}${urlEntry.url}`);
        }
        
        return { success: true };
}

async function showDomainUrls(bot, message, domain) {
        // Clean up domain (remove protocol if provided)
        domain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '');
        
        const urls = await bot.db.getUrlsByDomain(domain, 5, message.roomId);
        
        if (urls.length === 0) {
            bot.sendMessage(message.roomId, `no URLs found from ${domain}`);
            return { success: true };
        }

        bot.sendMessage(message.roomId, `last ${urls.length} URLs from ${domain}:`);
        
        for (const urlEntry of urls) {
            const timeDiff = Date.now() - urlEntry.timestamp;
            const minutes = Math.floor(timeDiff / 60000);
            const hours = Math.floor(minutes / 60);
            
            let timeAgo;
            if (hours > 0) {
                timeAgo = `${hours}h ago`;
            } else if (minutes > 0) {
                timeAgo = `${minutes}m ago`;
            } else {
                timeAgo = 'just now';
            }
            
            const prefix = urlEntry.url.startsWith('http') ? '' : 'https://';
            bot.sendMessage(message.roomId, `-${urlEntry.username} (${timeAgo}): ${prefix}${urlEntry.url}`);
        }
        
        return { success: true };
}