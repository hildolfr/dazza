import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('URLTitleFetcher');

// YouTube-specific comment generator with more variety
const YOUTUBE_COMMENTS = (title, url, username, videoId) => {
    // Extract channel info if possible from title
    const channelMatch = title.match(/(.+?)(?:\s*[-–]\s*(.+))?$/);
    const hasChannel = channelMatch && channelMatch[2];
    
    const comments = [
        // Title-focused insults
        `"${title}" - probably another shit video from -${username}`,
        `oi -${username} posted "${title}", bet it's cooked`,
        `"${title}" - fuckin youtube's full of garbage these days thanks to cunts like -${username}`,
        `-${username} shared "${title}", hope it's better than their usual trash`,
        `"${title}" - youtube recommendations are fucked if -${username}'s watchin this`,
        `another youtube link from -${username}: "${title}", probably clickbait`,
        `-${username} found "${title}" on youtube, their taste is questionable`,
        `"${title}" - bet -${username} watches this shit at 2x speed`,
        `youtube's algorithm is cooked if it showed -${username} "${title}"`,
        `"${title}" - classic -${username} posting the most random shit`,
        
        // More creative responses
        `"${title}" - how many brain cells did -${username} lose watchin this`,
        `-${username} really thought we needed to see "${title}"`,
        `"${title}" - this is why -${username}'s youtube history is set to private`,
        `of all the videos on youtube, -${username} picks "${title}"`,
        `"${title}" - proof that -${username} will watch anything`,
        `youtube should ban -${username} for sharing "${title}"`,
        `"${title}" - this is what -${username} does instead of touchin grass`,
        `-${username}'s youtube rabbit hole led to "${title}", explains a lot`,
        `"${title}" - bet this is in -${username}'s "watch later" with 500 other vids`,
        `imagine being -${username} and thinking "${title}" was worth sharing`,
        
        // Channel-aware comments (if we can detect it)
        hasChannel ? `"${title}" - of course -${username} watches ${channelMatch[2]}` : `"${title}" - peak -${username} content`,
        hasChannel ? `${channelMatch[2]} makes content for people like -${username}` : `"${title}" - exactly what I'd expect from -${username}`,
        
        // Length/type aware
        title.toLowerCase().includes('compilation') ? `"${title}" - -${username} watches compilations like a true smooth brain` : `"${title}" - bet -${username} didn't even finish watching it`,
        title.toLowerCase().includes('react') ? `"${title}" - -${username} watching people watch things, revolutionary` : `"${title}" - quality content from -${username} as always`,
        title.toLowerCase().includes('tiktok') ? `"${title}" - -${username} getting their tiktoks from youtube, cooked` : `"${title}" - another banger from -${username}'s recommendations`,
        
        // Time-based
        `"${title}" - what -${username} watches at 3am instead of sleeping`,
        `"${title}" - -${username}'s procrastination material`,
        
        // Aussie-specific
        `"${title}" - this is why the NBN is slow, cheers -${username}`,
        `"${title}" - -${username} wastin good aussie bandwidth on this shit`,
        `"${title}" - reckon -${username} watches this while on the dunny`
    ];
    
    return comments[Math.floor(Math.random() * comments.length)];
};

// Timeout for fetch operations
const FETCH_TIMEOUT = 5000; // 5 seconds

/**
 * Fetches the title of a URL
 * @param {string} url - The URL to fetch
 * @returns {Promise<string|null>} The title or null if failed
 */
async function fetchTitle(url) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
        
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
            logger.debug(`Failed to fetch ${url}: ${response.status}`);
            return null;
        }
        
        const html = await response.text();
        const $ = cheerio.load(html);
        
        // Try various title selectors
        let title = $('meta[property="og:title"]').attr('content') ||
                    $('meta[name="twitter:title"]').attr('content') ||
                    $('title').text() ||
                    $('h1').first().text();
        
        if (title) {
            // Clean up the title
            title = title.trim().replace(/\s+/g, ' ');
            
            // Remove common suffixes
            title = title.replace(/ \/ X$/, '')  // Remove "/ X" from Twitter
                       .replace(/ - YouTube$/, '');  // Remove "- YouTube"
            
            // Truncate if too long
            if (title.length > 100) {
                title = title.substring(0, 97) + '...';
            }
            
            logger.debug(`Fetched title for ${url}: ${title}`);
            return title;
        }
        
        logger.debug(`No title found for ${url}`);
        return null;
    } catch (error) {
        if (error.name === 'AbortError') {
            logger.debug(`Timeout fetching ${url}`);
        } else {
            logger.debug(`Error fetching ${url}: ${error.message}`);
        }
        return null;
    }
}

/**
 * Gets a contextual comment for a YouTube URL
 * @param {Object} urlData - URL data object
 * @param {string} username - Username who posted the URL
 * @param {string|null} title - The fetched title (optional)
 * @returns {string} Contextual comment
 */
function getYouTubeComment(urlData, username, title = null) {
    // If we couldn't fetch the title, use generic YouTube comments
    if (!title) {
        const genericComments = [
            `another youtube link from -${username}, probably garbage`,
            `-${username} sharin youtube links like anyone asked`,
            `bet -${username}'s video is cooked`,
            `youtube link from -${username}? hard pass`,
            `-${username} found somethin on youtube, shocking`
        ];
        return genericComments[Math.floor(Math.random() * genericComments.length)];
    }
    
    return YOUTUBE_COMMENTS(title, urlData.url, username, urlData.youtubeId);
}

/**
 * Main function to fetch title and generate comment
 * @param {Object} urlData - URL data from detector
 * @param {string} username - Username who posted
 * @returns {Promise<string|null>} Comment with title or null
 */
export async function fetchUrlTitleAndComment(urlData, username) {
    try {
        // Only process YouTube URLs
        if (urlData.type !== 'youtube') {
            return null;
        }
        
        // Fetch the title
        const title = await fetchTitle(urlData.url);
        
        // Generate contextual comment
        const comment = getYouTubeComment(urlData, username, title);
        
        return comment;
    } catch (error) {
        logger.error('Error in fetchUrlTitleAndComment', { error: error.message });
        return null;
    }
}