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
        for (const url of matches) {
            // Clean up the URL - remove any trailing punctuation
            const cleanUrl = url.replace(/[.,;:!?)]+$/, '');
            urls.push(cleanUrl);
        }
    }
    
    return urls;
}

export function isImageUrl(url) {
    return IMAGE_REGEX.test(url);
}