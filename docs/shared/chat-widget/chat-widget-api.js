// ===== CHAT WIDGET API MODULE =====
// Handles all API interactions for the chat widget

class ChatAPI {
    constructor(apiBase = null) {
        // Default to HTTPS on port 3001, matching the pattern from leaderboards
        this.apiBase = apiBase || (window.location.protocol === 'https:' 
            ? 'https://seg.tplinkdns.com:3001/api/v1' 
            : 'http://seg.tplinkdns.com:3001/api/v1');
        
        // Retry configuration
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1 second base delay
    }

    /**
     * Fetch recent chat messages from the API
     * @param {number} limit - Number of messages to fetch (default: 10)
     * @returns {Promise<Object>} Response object with messages or error
     */
    async fetchRecentMessages(limit = 10) {
        const endpoint = `${this.apiBase}/chat/recent?limit=${limit}`;
        
        try {
            const data = await this._fetchWithRetry(endpoint, {
                method: 'GET',
                headers: this._getHeaders()
            });

            if (data.success && data.data && data.data.messages) {
                return {
                    success: true,
                    messages: data.data.messages,
                    count: data.data.messages.length
                };
            }

            return {
                success: false,
                error: 'Invalid response format',
                messages: []
            };
        } catch (error) {
            return {
                success: false,
                error: error.message || 'Failed to fetch messages',
                messages: []
            };
        }
    }

    /**
     * Get standard headers for API requests
     * @returns {Object} Headers object
     */
    _getHeaders() {
        return {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Origin': window.location.origin
        };
    }

    /**
     * Fetch with retry logic
     * @param {string} url - The URL to fetch
     * @param {Object} options - Fetch options
     * @param {number} attempt - Current attempt number
     * @returns {Promise<Object>} Parsed JSON response
     */
    async _fetchWithRetry(url, options, attempt = 1) {
        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                // Handle specific HTTP errors
                if (response.status === 429) {
                    throw new Error('Rate limit exceeded. Please try again later.');
                } else if (response.status === 503) {
                    throw new Error('Service temporarily unavailable.');
                } else if (response.status >= 500) {
                    throw new Error(`Server error (${response.status}). Please try again.`);
                } else if (response.status === 404) {
                    throw new Error('API endpoint not found.');
                } else if (response.status === 403) {
                    throw new Error('Access forbidden. Check your permissions.');
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            }

            const data = await response.json();
            return data;
        } catch (error) {
            // If it's a network error or server error and we have retries left
            if (attempt < this.retryAttempts && this._shouldRetry(error)) {
                const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
                await this._delay(delay);
                return this._fetchWithRetry(url, options, attempt + 1);
            }
            
            // If we've exhausted retries or it's not a retryable error, throw
            throw error;
        }
    }

    /**
     * Determine if an error is retryable
     * @param {Error} error - The error to check
     * @returns {boolean} Whether to retry
     */
    _shouldRetry(error) {
        // Retry on network errors or 5xx server errors
        const retryableMessages = [
            'Failed to fetch',
            'NetworkError',
            'Service temporarily unavailable',
            'Server error'
        ];
        
        return retryableMessages.some(msg => error.message.includes(msg));
    }

    /**
     * Delay helper for retry backoff
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Resolves after delay
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Format a raw message object for display
     * @param {Object} message - Raw message from API
     * @returns {Object} Formatted message object
     */
    formatMessage(message) {
        return {
            id: message.id,
            username: message.username || 'Unknown',
            text: message.message || '',
            timestamp: message.timestamp,
            time: this._formatTime(message.timestamp),
            isSystem: message.username === 'system' || message.username === '[server]'
        };
    }

    /**
     * Format timestamp for display
     * @param {number} timestamp - Unix timestamp in milliseconds
     * @returns {string} Formatted time string
     */
    _formatTime(timestamp) {
        const date = new Date(timestamp);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    /**
     * Get WebSocket URL for real-time updates
     * @returns {string} WebSocket URL
     */
    getWebSocketUrl() {
        return window.location.protocol === 'https:' 
            ? 'wss://seg.tplinkdns.com:3001' 
            : 'ws://seg.tplinkdns.com:3001';
    }

    /**
     * Test API connectivity
     * @returns {Promise<Object>} Connection status
     */
    async testConnection() {
        try {
            const result = await this.fetchRecentMessages(1);
            return {
                connected: result.success,
                error: result.error || null,
                apiBase: this.apiBase
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message,
                apiBase: this.apiBase
            };
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatAPI;
} else {
    window.ChatAPI = ChatAPI;
}