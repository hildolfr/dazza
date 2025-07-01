/**
 * ChatWidget - Main Web Component for live chat widget
 * Integrates all chat modules and provides a complete chat experience
 */

import { chatWidgetStyles } from './chat-widget-styles.js';
import { createTemplate, createMessageTemplate, createStatusTemplate } from './chat-widget-template.js';
import { ChatMessages } from './chat-widget-messages.js';
import { ChatAPI } from './chat-widget-api.js';
import { ChatSocket } from './chat-widget-socket.js';

class ChatWidget extends HTMLElement {
    constructor() {
        super();
        
        // Create shadow DOM
        this.attachShadow({ mode: 'open' });
        
        // Component state
        this._isMinimized = false;
        this._isConnected = false;
        this._messageCount = 0;
        this._unreadCount = 0;
        this._userCount = { total: 0, active: 0, afk: 0 };
        
        // Module instances (will be initialized in connectedCallback)
        this.api = null;
        this.socket = null;
        this.messages = null;
        
        // Bind methods
        this._handleToggle = this._handleToggle.bind(this);
        this._handleSocketMessage = this._handleSocketMessage.bind(this);
        this._handleSocketConnect = this._handleSocketConnect.bind(this);
        this._handleSocketDisconnect = this._handleSocketDisconnect.bind(this);
        this._handleSocketError = this._handleSocketError.bind(this);
        this._handleRetryConnection = this._handleRetryConnection.bind(this);
        this._handleUserCount = this._handleUserCount.bind(this);
    }
    
    /**
     * Define observed attributes
     */
    static get observedAttributes() {
        return ['position', 'theme', 'start-minimized', 'api-url', 'ws-url'];
    }
    
    /**
     * Called when element is added to DOM
     */
    connectedCallback() {
        this._render();
        this._initializeModules();
        this._setupEventListeners();
        this._connect();
    }
    
    /**
     * Called when element is removed from DOM
     */
    disconnectedCallback() {
        this._cleanup();
    }
    
    /**
     * Called when an attribute changes
     */
    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        
        switch (name) {
            case 'position':
                this._updatePosition(newValue);
                break;
            case 'theme':
                this._updateTheme(newValue);
                break;
            case 'start-minimized':
                if (this._isMinimized !== (newValue === 'true')) {
                    this._handleToggle();
                }
                break;
            case 'api-url':
            case 'ws-url':
                // Reconnect with new URLs if already connected
                if (this._isConnected) {
                    this._reconnect();
                }
                break;
        }
    }
    
    /**
     * Render the component
     */
    _render() {
        const position = this.getAttribute('position') || 'bottom-right';
        const startMinimized = this.getAttribute('start-minimized') === 'true';
        
        // Apply styles
        const styleSheet = document.createElement('style');
        styleSheet.textContent = chatWidgetStyles;
        this.shadowRoot.appendChild(styleSheet);
        
        // Create template
        const template = createTemplate({ position, startMinimized });
        const container = document.createElement('div');
        container.innerHTML = template;
        this.shadowRoot.appendChild(container);
        
        // Update state
        this._isMinimized = startMinimized;
        
        // Cache important elements
        this._cacheElements();
    }
    
    /**
     * Cache important DOM elements
     */
    _cacheElements() {
        this._container = this.shadowRoot.querySelector('.chat-container');
        this._header = this.shadowRoot.querySelector('.chat-header');
        this._toggleBtn = this.shadowRoot.querySelector('.chat-toggle');
        this._messagesContainer = this.shadowRoot.querySelector('.chat-messages');
        this._statusElement = this.shadowRoot.querySelector('.chat-status');
        this._placeholderElement = this.shadowRoot.querySelector('.chat-placeholder');
        this._notificationBadge = this.shadowRoot.querySelector('.chat-notification-badge');
        this._badgeCount = this.shadowRoot.querySelector('.badge-count');
        this._userCountElement = this.shadowRoot.querySelector('.chat-user-count');
        this._userCountText = this.shadowRoot.querySelector('.user-count-text');
    }
    
    /**
     * Initialize module instances
     */
    _initializeModules() {
        // Get URLs from attributes or use defaults
        const apiUrl = this.getAttribute('api-url') || null;
        const wsUrl = this.getAttribute('ws-url') || null;
        
        // Initialize API module
        this.api = new ChatAPI(apiUrl);
        
        // Get WebSocket URL from API module if not provided
        const socketUrl = wsUrl || this.api.getWebSocketUrl();
        
        // Initialize Socket module
        this.socket = new ChatSocket(socketUrl);
        
        // Initialize Messages module
        this.messages = new ChatMessages(this._messagesContainer, {
            maxMessages: 50,
            autoScroll: true,
            filterBotCommands: true,
            filterServerMessages: false
        });
    }
    
    /**
     * Set up event listeners
     */
    _setupEventListeners() {
        // Header click to toggle
        this._header.addEventListener('click', this._handleToggle);
        
        // Socket events
        this.socket.addEventListener('connected', this._handleSocketConnect);
        this.socket.addEventListener('disconnected', this._handleSocketDisconnect);
        this.socket.addEventListener('error', this._handleSocketError);
        this.socket.addEventListener('message', this._handleSocketMessage);
        this.socket.addEventListener('usercount', this._handleUserCount);
        
        // Retry button if it exists
        const retryBtn = this.shadowRoot.querySelector('.retry-button');
        if (retryBtn) {
            retryBtn.addEventListener('click', this._handleRetryConnection);
        }
    }
    
    /**
     * Connect to chat services
     */
    async _connect() {
        try {
            // Update status
            this._updateConnectionStatus('connecting');
            
            // Load initial messages and channel stats in parallel
            const [messagesResult, channelStats] = await Promise.all([
                this.api.fetchRecentMessages(20),
                this.api.fetchChannelStats()
            ]);
            
            if (messagesResult.success && messagesResult.messages.length > 0) {
                // Remove placeholder
                if (this._placeholderElement) {
                    this._placeholderElement.style.display = 'none';
                }
                
                // Add messages
                this.messages.setMessages(messagesResult.messages);
                this._messageCount = messagesResult.messages.length;
            }
            
            // Update user count if available
            if (channelStats.success && channelStats.data) {
                this._updateUserCount({
                    total: channelStats.data.currentUsers || 0,
                    active: channelStats.data.activeUsers || 0,
                    afk: channelStats.data.afkUsers || 0
                });
            }
            
            // Connect WebSocket
            await this.socket.connect();
            
            // Subscribe to chat events
            this.socket.subscribe(['chat']);
            
        } catch (error) {
            console.error('ChatWidget connection error:', error);
            this._handleConnectionError(error);
        }
    }
    
    /**
     * Reconnect to services (used when URLs change)
     */
    async _reconnect() {
        this._cleanup();
        this._initializeModules();
        await this._connect();
    }
    
    /**
     * Handle toggle minimize/maximize
     */
    _handleToggle(event) {
        if (event) {
            event.stopPropagation();
        }
        
        this._isMinimized = !this._isMinimized;
        this._container.classList.toggle('minimized', this._isMinimized);
        
        // Update toggle button text
        const toggleIcon = this._toggleBtn.querySelector('.toggle-icon');
        if (toggleIcon) {
            toggleIcon.textContent = this._isMinimized ? '+' : '−';
        }
        
        // Clear unread count when maximizing
        if (!this._isMinimized) {
            this._clearUnreadCount();
        }
        
        // Emit custom event
        this.dispatchEvent(new CustomEvent('chat-toggle', {
            detail: { minimized: this._isMinimized }
        }));
    }
    
    /**
     * Handle socket connection
     */
    _handleSocketConnect(event) {
        this._isConnected = true;
        this._updateConnectionStatus('connected');
        
        // Start time updates
        this.messages.startTimeUpdates();
        
        // Emit custom event
        this.dispatchEvent(new CustomEvent('chat-connected', {
            detail: { timestamp: Date.now() }
        }));
    }
    
    /**
     * Handle socket disconnection
     */
    _handleSocketDisconnect(event) {
        this._isConnected = false;
        this._updateConnectionStatus('disconnected');
        
        // Emit custom event
        this.dispatchEvent(new CustomEvent('chat-disconnected', {
            detail: { timestamp: Date.now() }
        }));
    }
    
    /**
     * Handle socket errors
     */
    _handleSocketError(event) {
        console.error('ChatWidget socket error:', event.detail);
        this._handleConnectionError(event.detail.error);
    }
    
    /**
     * Handle incoming messages
     */
    _handleSocketMessage(event) {
        const messageData = event.detail;
        
        // Add message to display
        this.messages.addMessage(messageData);
        this._messageCount++;
        
        // Update unread count if minimized
        if (this._isMinimized) {
            this._incrementUnreadCount();
        }
        
        // Emit custom event
        this.dispatchEvent(new CustomEvent('chat-message-received', {
            detail: messageData
        }));
    }
    
    /**
     * Handle retry connection button
     */
    _handleRetryConnection() {
        this._connect();
    }
    
    /**
     * Handle user count update from WebSocket
     */
    _handleUserCount(event) {
        const data = event.detail;
        console.log('[ChatWidget] User count update:', data);
        this._updateUserCount(data);
    }
    
    /**
     * Update user count display
     */
    _updateUserCount(data) {
        this._userCount = data;
        
        if (this._userCountElement && this._userCountText) {
            // Show the user count element
            this._userCountElement.style.display = 'inline-flex';
            
            // Update the count text
            this._userCountText.textContent = data.total || '0';
            
            // Add tooltip with active/afk breakdown
            const activeCount = data.active || 0;
            const afkCount = data.afk || 0;
            this._userCountElement.title = `${activeCount} active, ${afkCount} AFK`;
        }
    }
    
    /**
     * Update connection status display
     */
    _updateConnectionStatus(status) {
        if (this._statusElement) {
            this._statusElement.setAttribute('data-status', status);
            this._statusElement.innerHTML = createStatusTemplate(status);
        }
        
        // Update in messages module as well
        this.messages.updateConnectionStatus(status);
    }
    
    /**
     * Handle connection errors
     */
    _handleConnectionError(error) {
        this._updateConnectionStatus('error');
        
        // Show error in messages area
        if (this._placeholderElement) {
            this._placeholderElement.innerHTML = `
                <div class="error-icon">�</div>
                <p class="error-message">${error.message || 'Failed to connect to chat'}</p>
                <button class="retry-button">Retry Connection</button>
            `;
            this._placeholderElement.style.display = 'flex';
            
            // Add retry listener
            const retryBtn = this._placeholderElement.querySelector('.retry-button');
            if (retryBtn) {
                retryBtn.addEventListener('click', this._handleRetryConnection);
            }
        }
    }
    
    /**
     * Update widget position
     */
    _updatePosition(position) {
        if (this._container) {
            this._container.setAttribute('data-position', position);
        }
    }
    
    /**
     * Update widget theme
     */
    _updateTheme(theme) {
        if (theme === 'dark') {
            this.style.setProperty('--chat-bg-color', '#1a1a1a');
            this.style.setProperty('--chat-text-color', '#ffffff');
        } else {
            this.style.setProperty('--chat-bg-color', 'white');
            this.style.setProperty('--chat-text-color', '#333');
        }
    }
    
    /**
     * Increment unread message count
     */
    _incrementUnreadCount() {
        this._unreadCount++;
        this._updateNotificationBadge();
    }
    
    /**
     * Clear unread message count
     */
    _clearUnreadCount() {
        this._unreadCount = 0;
        this._updateNotificationBadge();
    }
    
    /**
     * Update notification badge display
     */
    _updateNotificationBadge() {
        if (!this._notificationBadge || !this._badgeCount) return;
        
        if (this._unreadCount > 0 && this._isMinimized) {
            this._badgeCount.textContent = this._unreadCount > 99 ? '99+' : this._unreadCount;
            this._notificationBadge.style.display = 'block';
        } else {
            this._notificationBadge.style.display = 'none';
        }
    }
    
    /**
     * Clean up resources
     */
    _cleanup() {
        // Stop time updates
        if (this.messages) {
            this.messages.stopTimeUpdates();
            this.messages.destroy();
        }
        
        // Disconnect socket
        if (this.socket) {
            this.socket.disconnect();
        }
        
        // Remove event listeners
        if (this._header) {
            this._header.removeEventListener('click', this._handleToggle);
        }
        
        // Clear references
        this.api = null;
        this.socket = null;
        this.messages = null;
    }
    
    // Public API methods
    
    /**
     * Minimize the chat widget
     */
    minimize() {
        if (!this._isMinimized) {
            this._handleToggle();
        }
    }
    
    /**
     * Maximize the chat widget
     */
    maximize() {
        if (this._isMinimized) {
            this._handleToggle();
        }
    }
    
    /**
     * Get current connection status
     */
    get connected() {
        return this._isConnected;
    }
    
    /**
     * Get current minimized state
     */
    get minimized() {
        return this._isMinimized;
    }
    
    /**
     * Get message count
     */
    get messageCount() {
        return this._messageCount;
    }
}

// Don't register here - let index.js handle registration

// Export for use in other modules
export default ChatWidget;