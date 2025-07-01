/**
 * ChatSocket - WebSocket handler for chat widget
 * Manages Socket.IO connections with automatic reconnection and event handling
 */
class ChatSocket extends EventTarget {
    constructor(wsUrl, options = {}) {
        super();
        
        this.wsUrl = wsUrl;
        this.options = {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            ...options
        };
        
        this.socket = null;
        this.isConnected = false;
        this.subscribedTopics = [];
    }
    
    /**
     * Dynamically load Socket.IO if not present
     * @returns {Promise<void>}
     */
    async loadSocketIO() {
        if (typeof io !== 'undefined') {
            return Promise.resolve();
        }
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
            script.async = true;
            
            script.onload = () => {
                console.log('Socket.IO loaded successfully');
                resolve();
            };
            
            script.onerror = () => {
                reject(new Error('Failed to load Socket.IO'));
            };
            
            document.head.appendChild(script);
        });
    }
    
    /**
     * Connect to WebSocket server
     * @returns {Promise<void>}
     */
    async connect() {
        try {
            // Ensure Socket.IO is loaded
            await this.loadSocketIO();
            
            // Create socket connection
            this.socket = io(this.wsUrl, this.options);
            
            // Set up event handlers
            this.setupEventHandlers();
            
            // Wait for connection to be established
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 10000); // 10 second timeout
                
                this.socket.once('connect', () => {
                    clearTimeout(timeout);
                    resolve();
                });
                
                this.socket.once('connect_error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
            
        } catch (error) {
            console.error('Failed to connect:', error);
            this.emit('error', { error });
            throw error;
        }
    }
    
    /**
     * Set up Socket.IO event handlers
     */
    setupEventHandlers() {
        this.socket.on('connect', () => {
            this.isConnected = true;
            console.log('ChatSocket connected');
            
            // Re-subscribe to topics on reconnection
            if (this.subscribedTopics.length > 0) {
                this.subscribe(this.subscribedTopics);
            }
            
            this.emit('connected');
        });
        
        this.socket.on('disconnect', () => {
            this.isConnected = false;
            console.log('ChatSocket disconnected');
            this.emit('disconnected');
        });
        
        this.socket.on('error', (error) => {
            console.error('ChatSocket error:', error);
            this.emit('error', { error });
        });
        
        // Handle chat messages
        this.socket.on('chat:message', (data) => {
            this.emit('message', data);
        });
        
        // Handle other chat events
        this.socket.on('chat:user:join', (data) => {
            this.emit('userJoin', data);
        });
        
        this.socket.on('chat:user:leave', (data) => {
            this.emit('userLeave', data);
        });
        
        // Handle stats updates if subscribed
        this.socket.on('stats:user:update', (data) => {
            this.emit('statsUpdate', data);
        });
        
        // Handle user count updates
        this.socket.on('chat:usercount', (data) => {
            this.emit('usercount', data);
        });
    }
    
    /**
     * Subscribe to specific topics
     * @param {string[]} topics - Array of topics to subscribe to
     */
    subscribe(topics) {
        if (!this.socket || !this.isConnected) {
            console.warn('Cannot subscribe: socket not connected');
            return;
        }
        
        // Store topics for re-subscription on reconnect
        this.subscribedTopics = [...new Set([...this.subscribedTopics, ...topics])];
        
        this.socket.emit('subscribe', topics);
        console.log('Subscribed to topics:', topics);
    }
    
    /**
     * Unsubscribe from specific topics
     * @param {string[]} topics - Array of topics to unsubscribe from
     */
    unsubscribe(topics) {
        if (!this.socket || !this.isConnected) {
            console.warn('Cannot unsubscribe: socket not connected');
            return;
        }
        
        // Remove topics from stored list
        this.subscribedTopics = this.subscribedTopics.filter(topic => !topics.includes(topic));
        
        this.socket.emit('unsubscribe', topics);
        console.log('Unsubscribed from topics:', topics);
    }
    
    /**
     * Send a message through the socket
     * @param {string} event - Event name
     * @param {any} data - Data to send
     */
    send(event, data) {
        if (!this.socket || !this.isConnected) {
            console.warn('Cannot send: socket not connected');
            return;
        }
        
        this.socket.emit(event, data);
    }
    
    /**
     * Disconnect from WebSocket server
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
            this.subscribedTopics = [];
            console.log('ChatSocket disconnected manually');
        }
    }
    
    /**
     * Emit custom events
     * @param {string} eventName - Name of the event
     * @param {any} detail - Event detail data
     */
    emit(eventName, detail = {}) {
        this.dispatchEvent(new CustomEvent(eventName, { detail }));
    }
    
    /**
     * Check if socket is currently connected
     * @returns {boolean}
     */
    get connected() {
        return this.isConnected;
    }
}

// Export for use in other modules
export { ChatSocket };

// Also expose globally for non-module usage
if (typeof window !== 'undefined') {
    window.ChatSocket = ChatSocket;
}