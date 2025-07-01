import fetch from 'node-fetch';
import { URL } from 'url';

// Configuration
const DEFAULT_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to fetch with retry and exponential backoff
async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
    let lastError;
    
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url, options);
            return response;
        } catch (error) {
            lastError = error;
            
            // Don't retry on certain errors
            if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                throw error;
            }
            
            // If we have more retries, wait with exponential backoff
            if (attempt < retries - 1) {
                const delayMs = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
                console.debug(`[ImageMetadata] Retry ${attempt + 1}/${retries - 1} for ${url} after ${delayMs}ms`);
                await delay(delayMs);
            }
        }
    }
    
    throw lastError;
}

// Simple metadata extraction without external dependencies
export async function extractImageMetadata(imageUrl) {
    try {
        const metadata = {
            url: imageUrl,
            domain: extractDomain(imageUrl),
            timestamp: Date.now(),
            accessible: false,
            contentType: null,
            contentLength: null,
            error: null
        };

        // Make a HEAD request to get metadata without downloading the full image
        const response = await fetchWithRetry(imageUrl, {
            method: 'HEAD',
            timeout: DEFAULT_TIMEOUT,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Dazza Bot) AppleWebKit/537.36'
            }
        });

        metadata.accessible = response.ok;
        metadata.statusCode = response.status;
        
        if (response.ok) {
            metadata.contentType = response.headers.get('content-type');
            metadata.contentLength = parseInt(response.headers.get('content-length') || '0');
            metadata.lastModified = response.headers.get('last-modified');
            
            // Estimate dimensions for common image hosting services
            metadata.dimensions = estimateDimensions(imageUrl);
        } else {
            metadata.error = `HTTP ${response.status}`;
        }

        return metadata;
    } catch (error) {
        return {
            url: imageUrl,
            domain: extractDomain(imageUrl),
            timestamp: Date.now(),
            accessible: false,
            error: error.message
        };
    }
}

function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return 'unknown';
    }
}

// Estimate dimensions based on URL patterns for common image hosts
function estimateDimensions(url) {
    // Imgur thumbnails
    if (url.includes('imgur.com')) {
        if (url.includes('t.jpg') || url.includes('s.jpg')) {
            return { width: 160, height: 160, estimated: true };
        } else if (url.includes('m.jpg')) {
            return { width: 320, height: 320, estimated: true };
        } else if (url.includes('l.jpg')) {
            return { width: 640, height: 640, estimated: true };
        }
    }
    
    // Discord CDN
    if (url.includes('cdn.discordapp.com')) {
        const sizeMatch = url.match(/[?&]size=(\d+)/);
        if (sizeMatch) {
            const size = parseInt(sizeMatch[1]);
            return { width: size, height: size, estimated: true };
        }
    }
    
    return null;
}

// Check if an image URL is still accessible
export async function checkImageHealth(imageUrl) {
    try {
        const response = await fetchWithRetry(imageUrl, {
            method: 'HEAD',
            timeout: DEFAULT_TIMEOUT,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Dazza Bot) AppleWebKit/537.36'
            }
        });
        
        return {
            accessible: response.ok,
            statusCode: response.status,
            contentType: response.headers.get('content-type'),
            error: response.ok ? null : `HTTP ${response.status}`
        };
    } catch (error) {
        // Log more details for debugging
        console.debug(`[ImageMetadata] Health check failed for ${imageUrl}: ${error.message}`);
        
        return {
            accessible: false,
            statusCode: null,
            contentType: null,
            error: error.message
        };
    }
}

// Batch check multiple image URLs
export async function batchCheckImageHealth(imageUrls, concurrency = 5) {
    const results = [];
    
    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < imageUrls.length; i += concurrency) {
        const batch = imageUrls.slice(i, i + concurrency);
        const batchResults = await Promise.allSettled(
            batch.map(url => checkImageHealth(url))
        );
        
        batchResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                results.push({
                    url: batch[index],
                    ...result.value
                });
            } else {
                results.push({
                    url: batch[index],
                    accessible: false,
                    error: result.reason.message
                });
            }
        });
    }
    
    return results;
}