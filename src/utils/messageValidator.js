export const MAX_MESSAGE_LENGTH = 240; // CyTube's typical limit

export function validateMessage(message) {
    if (!message || typeof message !== 'string') {
        return { valid: false, error: 'Invalid message type' };
    }
    
    if (message.length > MAX_MESSAGE_LENGTH) {
        return { valid: false, error: 'Message too long' };
    }
    
    // Basic XSS prevention
    const dangerous = /<script|<iframe|javascript:|onerror=/i;
    if (dangerous.test(message)) {
        return { valid: false, error: 'Invalid message content' };
    }
    
    return { valid: true };
}

export function truncateMessage(message, maxLength = MAX_MESSAGE_LENGTH) {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength - 3) + '...';
}

export function sanitizeUsername(username) {
    if (!username || typeof username !== 'string') return '';
    // Remove any control characters and trim
    return username.replace(/[\x00-\x1F\x7F]/g, '').trim();
}