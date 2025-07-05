/**
 * Image URL extraction utilities - CommonJS wrapper
 * This provides CommonJS exports for the ES6 image detection utilities
 */

const IMAGE_EXTENSIONS = [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'webm'
];

const IMAGE_REGEX = new RegExp(
    `https?://[^\\s]+\\.(${IMAGE_EXTENSIONS.join('|')})(?:\\?[^\\s]*)?`,
    'gi'
);

/**
 * Extract image URLs from a message
 * @param {string} message - The message to scan for image URLs
 * @returns {string[]} Array of image URLs found
 */
function extractImageUrls(message) {
    const urls = [];
    const matches = message.match(IMAGE_REGEX);
    
    if (matches) {
        // Use a Set to automatically deduplicate URLs
        const uniqueUrls = new Set();
        
        for (const url of matches) {
            // Clean up the URL - remove any trailing punctuation
            const cleanUrl = url.replace(/[.,;:!?)]+$/, '');
            uniqueUrls.add(cleanUrl);
        }
        
        // Convert Set back to array
        urls.push(...uniqueUrls);
    }
    
    return urls;
}

/**
 * Check if a URL is an image URL
 * @param {string} url - URL to check
 * @returns {boolean} True if the URL appears to be an image
 */
function isImageUrl(url) {
    return IMAGE_REGEX.test(url);
}

export {
    extractImageUrls,
    isImageUrl
};