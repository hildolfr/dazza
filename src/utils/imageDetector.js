const IMAGE_EXTENSIONS = [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'webm'
];

const IMAGE_REGEX = new RegExp(
    `https?://[^\\s]+\\.(${IMAGE_EXTENSIONS.join('|')})(?:\\?[^\\s]*)?`,
    'gi'
);

export function extractImageUrls(message) {
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

export function isImageUrl(url) {
    return IMAGE_REGEX.test(url);
}