/**
 * Username normalization utilities to ensure consistent username handling
 * across the entire application and prevent case-sensitivity issues.
 * 
 * This is a CommonJS version of the functionality originally in usernameNormalizer.js
 */

/**
 * Map to cache canonical usernames to avoid repeated database lookups
 * Structure: lowercase username -> canonical casing
 */
const canonicalCache = new Map();

/**
 * Get the canonical (properly cased) version of a username.
 * First checks the online userlist, then the cache, then the database.
 * 
 * @param {Object} bot - The bot instance (for userlist access)
 * @param {string} username - The username to normalize
 * @returns {Promise<string>} The canonical username
 */
async function getCanonicalUsername(bot, username) {
    if (!username || typeof username !== 'string') {
        return username;
    }
    
    const lowerUsername = username.toLowerCase();
    
    // Check if user is currently online (most authoritative source)
    let onlineUser = null;
    
    // Handle both single-room bot and multi-room bot
    if (bot.userlist && bot.userlist.values) {
        // Single room bot
        onlineUser = Array.from(bot.userlist.values())
            .find(u => u.name.toLowerCase() === lowerUsername);
    } else if (bot.rooms) {
        // Multi-room bot - check all rooms
        for (const room of bot.rooms.values()) {
            if (room.userlist) {
                onlineUser = Array.from(room.userlist.values())
                    .find(u => u.name.toLowerCase() === lowerUsername);
                if (onlineUser) break;
            }
        }
    }
    
    if (onlineUser) {
        // Update cache with current online casing
        canonicalCache.set(lowerUsername, onlineUser.name);
        return onlineUser.name;
    }
    
    // Check cache
    if (canonicalCache.has(lowerUsername)) {
        return canonicalCache.get(lowerUsername);
    }
    
    // Check database for existing user (try multiple tables for best match)
    try {
        // First check user_economy (most important for money-related operations)
        let result = await bot.db.get(
            'SELECT username FROM user_economy WHERE LOWER(username) = LOWER(?)',
            [username]
        );
        
        if (!result) {
            // Check user_stats as fallback
            result = await bot.db.get(
                'SELECT username FROM user_stats WHERE LOWER(username) = LOWER(?)',
                [username]
            );
        }
        
        if (!result) {
            // Check messages for any historical usage
            result = await bot.db.get(
                'SELECT username FROM messages WHERE LOWER(username) = LOWER(?) ORDER BY timestamp DESC LIMIT 1',
                [username]
            );
        }
        
        if (result) {
            canonicalCache.set(lowerUsername, result.username);
            return result.username;
        }
    } catch (error) {
        // Log error but don't crash
        if (bot.logger) {
            bot.logger.error('Error getting canonical username:', { error: error.message, stack: error.stack });
        }
    }
    
    // No existing record found, return the username as provided
    // This preserves the casing for new users
    canonicalCache.set(lowerUsername, username);
    return username;
}

/**
 * Clear the canonical cache (useful after database updates or user renames)
 */
function clearCanonicalCache() {
    canonicalCache.clear();
}

/**
 * Get the size of the canonical cache (for monitoring)
 */
function getCanonicalCacheSize() {
    return canonicalCache.size;
}

/**
 * Ensure consistent username in database operations.
 * This should be used before any INSERT or UPDATE operation involving usernames.
 * 
 * @param {Object} bot - The bot instance
 * @param {string} username - The username to normalize
 * @returns {Promise<string>} The canonical username to use in database
 */
async function normalizeUsernameForDb(bot, username) {
    return await getCanonicalUsername(bot, username);
}

/**
 * Compare two usernames in a case-insensitive manner
 * 
 * @param {string} username1 - First username
 * @param {string} username2 - Second username
 * @returns {boolean} True if usernames match (case-insensitive)
 */
function usernamesMatch(username1, username2) {
    if (!username1 || !username2) return false;
    return username1.toLowerCase() === username2.toLowerCase();
}

/**
 * Batch normalize multiple usernames efficiently
 * 
 * @param {Object} bot - The bot instance
 * @param {string[]} usernames - Array of usernames to normalize
 * @returns {Promise<Map>} Map of original username -> canonical username
 */
async function batchNormalizeUsernames(bot, usernames) {
    const result = new Map();
    
    for (const username of usernames) {
        const canonical = await getCanonicalUsername(bot, username);
        result.set(username, canonical);
    }
    
    return result;
}

export {
    normalizeUsernameForDb,
    getCanonicalUsername,
    usernamesMatch,
    clearCanonicalCache,
    getCanonicalCacheSize,
    batchNormalizeUsernames
};