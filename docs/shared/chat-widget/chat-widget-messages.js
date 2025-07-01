/**
 * ChatMessages class - Handles message rendering and management for the chat widget
 */
export class ChatMessages {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            maxMessages: options.maxMessages || 50,
            autoScroll: options.autoScroll !== false,
            filterBotCommands: options.filterBotCommands !== false,
            filterServerMessages: options.filterServerMessages !== false,
            ...options
        };
        
        this.messages = [];
        this.messagesElement = null;
        this.statusElement = null;
        
        this._initializeElements();
    }
    
    /**
     * Initialize DOM elements
     */
    _initializeElements() {
        // Find or create messages container
        this.messagesElement = this.container.querySelector('.chat-messages');
        if (!this.messagesElement) {
            this.messagesElement = document.createElement('div');
            this.messagesElement.className = 'chat-messages';
            this.container.appendChild(this.messagesElement);
        }
        
        // Find status element if it exists
        this.statusElement = this.container.querySelector('.chat-status, .connection-status');
    }
    
    /**
     * Add a new message to the chat
     * @param {Object} messageData - Message object with username, message, timestamp properties
     */
    addMessage(messageData) {
        console.log('[ChatMessages] Adding message:', messageData);
        
        // Filter message if needed
        if (this.shouldFilterMessage(messageData)) {
            console.log('[ChatMessages] Message filtered out');
            return;
        }
        
        // Add timestamp if not present
        if (!messageData.timestamp) {
            messageData.timestamp = Date.now();
        }
        
        // Add timeAgo property
        messageData.timeAgo = this.formatTime(messageData.timestamp);
        
        // Add message to array
        this.messages.push(messageData);
        
        // Maintain max message limit
        while (this.messages.length > this.options.maxMessages) {
            this.messages.shift();
        }
        
        // Render messages
        this._render();
    }
    
    /**
     * Set/replace all messages
     * @param {Array} messages - Array of message objects
     */
    setMessages(messages) {
        // Filter and process messages
        this.messages = messages
            .filter(msg => !this.shouldFilterMessage(msg))
            .slice(-this.options.maxMessages)
            .map(msg => ({
                ...msg,
                timeAgo: this.formatTime(msg.timestamp)
            }));
        
        this._render();
    }
    
    /**
     * Clear all messages
     */
    clear() {
        this.messages = [];
        this._render();
    }
    
    /**
     * Update connection status in header
     * @param {string} status - Connection status ('connected', 'disconnected', 'connecting')
     */
    updateConnectionStatus(status) {
        if (!this.statusElement) {
            return;
        }
        
        const statusClasses = {
            connected: 'status-connected',
            disconnected: 'status-disconnected',
            connecting: 'status-connecting'
        };
        
        // Remove all status classes
        Object.values(statusClasses).forEach(cls => {
            this.statusElement.classList.remove(cls);
        });
        
        // Add appropriate status class
        if (statusClasses[status]) {
            this.statusElement.classList.add(statusClasses[status]);
        }
        
        // Update status text if element supports it
        const textElement = this.statusElement.querySelector('.status-text');
        if (textElement) {
            textElement.textContent = status;
        }
    }
    
    /**
     * Render messages to DOM
     */
    _render() {
        if (this.messages.length === 0) {
            this.messagesElement.innerHTML = '<div class="chat-loading">No messages yet...</div>';
            return;
        }
        
        // Update timeAgo for all messages before rendering
        const now = Date.now();
        this.messages.forEach(msg => {
            msg.timeAgo = this.formatTime(msg.timestamp, now);
        });
        
        // Render messages
        this.messagesElement.innerHTML = this.messages.map(msg => `
            <div class="chat-message">
                <span class="chat-username">${this.escapeHtml(msg.username)}:</span>
                <span class="chat-text">${this.escapeHtml(msg.message)}</span>
                <span class="chat-time">${msg.timeAgo}</span>
            </div>
        `).join('');
        
        // Auto-scroll to bottom if enabled
        if (this.options.autoScroll) {
            this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
        }
    }
    
    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
    
    /**
     * Format timestamp to relative time
     * @param {number} timestamp - Unix timestamp in milliseconds
     * @param {number} now - Current timestamp (optional)
     * @returns {string} Formatted time string (e.g., "2m ago", "5s ago")
     */
    formatTime(timestamp, now = Date.now()) {
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        
        if (seconds < 5) {
            return 'now';
        } else if (seconds < 60) {
            return `${seconds}s ago`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            return `${minutes}m ago`;
        } else if (seconds < 86400) {
            const hours = Math.floor(seconds / 3600);
            return `${hours}h ago`;
        } else {
            const days = Math.floor(seconds / 86400);
            return `${days}d ago`;
        }
    }
    
    /**
     * Determine if message should be filtered out
     * @param {Object} message - Message object
     * @returns {boolean} True if message should be filtered
     */
    shouldFilterMessage(message) {
        if (!message || !message.message) {
            return true;
        }
        
        // Filter bot commands (starting with !)
        if (this.options.filterBotCommands && message.message.startsWith('!')) {
            return true;
        }
        
        // Filter server messages (from specific usernames)
        if (this.options.filterServerMessages) {
            const serverUsernames = ['server', 'system', '[server]', '[system]'];
            const lowerUsername = (message.username || '').toLowerCase();
            if (serverUsernames.includes(lowerUsername)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Start periodic time updates
     * Updates relative timestamps every 30 seconds
     */
    startTimeUpdates() {
        this.stopTimeUpdates(); // Clear any existing interval
        
        this._timeUpdateInterval = setInterval(() => {
            if (this.messages.length > 0) {
                this._render();
            }
        }, 30000); // Update every 30 seconds
    }
    
    /**
     * Stop periodic time updates
     */
    stopTimeUpdates() {
        if (this._timeUpdateInterval) {
            clearInterval(this._timeUpdateInterval);
            this._timeUpdateInterval = null;
        }
    }
    
    /**
     * Destroy the instance and clean up
     */
    destroy() {
        this.stopTimeUpdates();
        this.clear();
        this.container = null;
        this.messagesElement = null;
        this.statusElement = null;
    }
}

// Export helper functions for external use if needed
export const messageHelpers = {
    escapeHtml: ChatMessages.prototype.escapeHtml,
    formatTime: ChatMessages.prototype.formatTime,
    shouldFilterMessage: ChatMessages.prototype.shouldFilterMessage
};