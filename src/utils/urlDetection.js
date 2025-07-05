/**
 * URL detection utilities - CommonJS wrapper
 * This provides CommonJS exports for the ES6 URL detection utilities
 */

// Constants and patterns
const ALLOWED_DOMAINS = [
    'youtube.com', 'youtu.be', 'm.youtube.com'
];

const URL_PATTERNS = {
    // YouTube patterns - handle various formats
    youtube: /(?:^|[\s])(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})(?:[^\s]*)?/gi,
    youtubeGeneral: /(?:^|[\s])(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=.]*)?/gi
};

/**
 * Detects URLs in a message - only from allowed domains
 * @param {string} message - The message to scan for URLs
 * @returns {Object} Object containing detected URLs and metadata
 */
function detectUrls(message) {
    if (!message || typeof message !== 'string') {
        return { hasUrls: false, urls: [] };
    }
    
    // Strip HTML tags but preserve the URL content
    // This handles CyTube's HTML formatted messages
    let cleanMessage = message;
    
    // Extract URLs from href attributes first
    const hrefMatches = message.matchAll(/href="([^"]+)"/g);
    const hrefUrls = [];
    for (const match of hrefMatches) {
        hrefUrls.push(match[1]);
    }
    
    // Remove HTML tags
    cleanMessage = message.replace(/<[^>]*>/g, ' ');
    
    // Combine original message, cleaned message, and href URLs
    const combinedText = `${cleanMessage} ${hrefUrls.join(' ')}`;
    
    const detectedUrls = [];
    const processedUrls = new Set(); // Avoid duplicates
    
    // Check each allowed pattern against the combined text
    Object.entries(URL_PATTERNS).forEach(([type, pattern]) => {
        const matches = combinedText.match(pattern) || [];
        
        matches.forEach(match => {
            // Clean up the match - remove leading whitespace
            const url = match.trim();
            const normalized = normalizeUrl(url);
            
            // Double-check it's from an allowed domain
            if (!processedUrls.has(normalized) && isAllowedUrl(url)) {
                processedUrls.add(normalized);
                
                const urlObj = {
                    url: url,
                    normalized: normalized,
                    type: type === 'youtubeGeneral' ? 'youtube' : type,
                    domain: extractDomain(url)
                };
                
                // Extract YouTube video ID if applicable
                if ((type === 'youtube' || type === 'youtubeGeneral') && url.includes('watch?v=')) {
                    const videoMatch = url.match(/(?:v=|youtu\.be\/|embed\/|v\/)([\w-]{11})/);
                    if (videoMatch) {
                        urlObj.youtubeId = videoMatch[1];
                    }
                }
                
                detectedUrls.push(urlObj);
            }
        });
    });
    
    return {
        hasUrls: detectedUrls.length > 0,
        urls: detectedUrls,
        count: detectedUrls.length
    };
}

/**
 * Checks if a URL is from an allowed domain
 * @param {string} url - URL to check
 * @returns {boolean} True if from allowed domain
 */
function isAllowedUrl(url) {
    const domain = extractDomain(url).toLowerCase();
    
    // Check if domain matches any allowed domain
    return ALLOWED_DOMAINS.some(allowed => {
        // Handle subdomains (e.g., m.youtube.com matches youtube.com)
        return domain === allowed || domain.endsWith('.' + allowed);
    });
}

/**
 * Normalizes a URL for comparison
 * @param {string} url - URL to normalize
 * @returns {string} Normalized URL
 */
function normalizeUrl(url) {
    try {
        // Add protocol if missing
        let normalized = url;
        if (!normalized.match(/^https?:\/\//)) {
            normalized = 'https://' + normalized;
        }
        
        // Parse and reconstruct to normalize
        const parsed = new URL(normalized);
        
        // Remove www. for comparison
        let host = parsed.hostname.toLowerCase();
        if (host.startsWith('www.')) {
            host = host.substring(4);
        }
        
        // Remove trailing slash from pathname
        let path = parsed.pathname;
        if (path.endsWith('/') && path.length > 1) {
            path = path.slice(0, -1);
        }
        
        return `${parsed.protocol}//${host}${path}${parsed.search}${parsed.hash}`;
    } catch (e) {
        // If URL parsing fails, return cleaned version
        return url.toLowerCase().replace(/\/+$/, '');
    }
}

/**
 * Extracts domain from URL
 * @param {string} url - URL to extract domain from
 * @returns {string} Domain name
 */
function extractDomain(url) {
    try {
        let normalized = url;
        if (!normalized.match(/^https?:\/\//)) {
            normalized = 'https://' + normalized;
        }
        
        const parsed = new URL(normalized);
        let domain = parsed.hostname.toLowerCase();
        
        // Remove www.
        if (domain.startsWith('www.')) {
            domain = domain.substring(4);
        }
        
        return domain;
    } catch (e) {
        // Fallback for invalid URLs
        const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
        return match ? match[1] : url;
    }
}

module.exports = {
    detectUrls,
    extractDomain,
    isAllowedUrl,
    normalizeUrl
};