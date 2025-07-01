/**
 * Chat Widget Template Module
 * Exports a function that returns the HTML template string for the chat widget
 */

/**
 * Creates the HTML template for the chat widget
 * @param {Object} options - Configuration options
 * @param {string} options.position - Widget position (default: 'bottom-right')
 * @param {boolean} options.startMinimized - Whether to start minimized (default: false)
 * @returns {string} HTML template string
 */
export function createTemplate(options = {}) {
    const { 
        position = 'bottom-right',
        startMinimized = false 
    } = options;

    return `
        <div class="chat-container${startMinimized ? ' minimized' : ''}" data-position="${position}">
            <!-- Chat Header -->
            <div class="chat-header">
                <div class="chat-header-content">
                    <span class="chat-title">LIVE CHAT</span>
                    <span class="chat-status" data-status="connecting">
                        <span class="status-dot"></span>
                        <span class="status-text">Connecting...</span>
                    </span>
                </div>
                <button class="chat-toggle" aria-label="Toggle chat">
                    <span class="toggle-icon">${startMinimized ? '+' : '‚àí'}</span>
                </button>
            </div>
            
            <!-- Chat Messages Container -->
            <div class="chat-body">
                <div class="chat-messages" id="messages">
                    <!-- Loading/Empty State -->
                    <div class="chat-placeholder">
                        <div class="loading-spinner"></div>
                        <p class="placeholder-text">Connecting to chat...</p>
                    </div>
                    
                    <!-- Messages will be inserted here dynamically -->
                </div>
                
                <!-- Optional: Message input (if needed in future) -->
                <div class="chat-input-container" style="display: none;">
                    <input type="text" class="chat-input" placeholder="Type a message..." disabled>
                    <button class="chat-send" disabled>Send</button>
                </div>
            </div>
            
            <!-- Notification Badge -->
            <div class="chat-notification-badge" style="display: none;">
                <span class="badge-count">0</span>
            </div>
        </div>
    `;
}

/**
 * Creates a chat message element template
 * @param {Object} messageData - Message data
 * @param {string} messageData.username - Username of the sender
 * @param {string} messageData.message - Message content
 * @param {number} messageData.timestamp - Unix timestamp
 * @param {string} messageData.type - Message type (chat, join, leave, system)
 * @returns {string} HTML string for the message
 */
export function createMessageTemplate(messageData) {
    const { username, message, timestamp, type = 'chat' } = messageData;
    const time = new Date(timestamp).toLocaleTimeString('en-AU', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    switch (type) {
        case 'join':
            return `
                <div class="chat-message system-message join-message">
                    <span class="message-icon">í</span>
                    <span class="message-text">${username} joined the chat</span>
                    <span class="message-time">${time}</span>
                </div>
            `;
        
        case 'leave':
            return `
                <div class="chat-message system-message leave-message">
                    <span class="message-icon">ê</span>
                    <span class="message-text">${username} left the chat</span>
                    <span class="message-time">${time}</span>
                </div>
            `;
        
        case 'system':
            return `
                <div class="chat-message system-message">
                    <span class="message-icon">9</span>
                    <span class="message-text">${message}</span>
                    <span class="message-time">${time}</span>
                </div>
            `;
        
        case 'chat':
        default:
            return `
                <div class="chat-message user-message">
                    <span class="chat-username">${username}:</span>
                    <span class="chat-text">${message}</span>
                    <span class="chat-time">${time}</span>
                </div>
            `;
    }
}

/**
 * Creates a connection status template
 * @param {string} status - Connection status (connected, connecting, disconnected, error)
 * @returns {string} HTML string for the status
 */
export function createStatusTemplate(status) {
    const statusConfig = {
        connected: {
            text: 'Connected',
            class: 'connected'
        },
        connecting: {
            text: 'Connecting...',
            class: 'connecting'
        },
        disconnected: {
            text: 'Disconnected',
            class: 'disconnected'
        },
        error: {
            text: 'Connection Error',
            class: 'error'
        }
    };

    const config = statusConfig[status] || statusConfig.disconnected;

    return `
        <span class="status-dot ${config.class}"></span>
        <span class="status-text">${config.text}</span>
    `;
}

/**
 * Creates an empty state template
 * @param {string} message - Message to display
 * @returns {string} HTML string for empty state
 */
export function createEmptyStateTemplate(message = 'No messages yet') {
    return `
        <div class="chat-empty-state">
            <div class="empty-icon">=¨</div>
            <p class="empty-message">${message}</p>
        </div>
    `;
}

/**
 * Creates an error state template
 * @param {string} error - Error message
 * @returns {string} HTML string for error state
 */
export function createErrorTemplate(error = 'Failed to connect to chat') {
    return `
        <div class="chat-error-state">
            <div class="error-icon">†</div>
            <p class="error-message">${error}</p>
            <button class="retry-button">Retry Connection</button>
        </div>
    `;
}

// Export all template functions
export default {
    createTemplate,
    createMessageTemplate,
    createStatusTemplate,
    createEmptyStateTemplate,
    createErrorTemplate
};