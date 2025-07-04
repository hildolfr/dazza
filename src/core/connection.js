import { io } from 'socket.io-client';
import EventEmitter from 'events';
import { createLogger } from '../utils/logger.js';

export class CyTubeConnection extends EventEmitter {
    constructor(roomId, config) {
        super();
        this.roomId = roomId;
        this.config = config;
        this.socket = null;
        this.connected = false;
        this.authenticated = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = config.maxReconnectAttempts || 10;
        this.reconnectDelay = 5000;
        this.connectionState = 'disconnected'; // disconnected, connecting, connected, reconnecting
        this.reconnectTimer = null;
        this.lastConnectionAttempt = 0;
        this.minTimeBetweenAttempts = 2000; // 2 seconds minimum
        this.logger = createLogger({
            level: config.logging?.level || 'info',
            console: config.logging?.console !== false
        });
    }

    async connect() {
        if (this.connectionState === 'connecting' || this.connectionState === 'connected') {
            throw new Error(`Already ${this.connectionState}`);
        }
        
        // Enforce minimum time between connection attempts
        const now = Date.now();
        const timeSinceLastAttempt = now - this.lastConnectionAttempt;
        if (timeSinceLastAttempt < this.minTimeBetweenAttempts) {
            const waitTime = this.minTimeBetweenAttempts - timeSinceLastAttempt;
            throw new Error(`Too soon to reconnect. Wait ${waitTime}ms`);
        }
        
        this.lastConnectionAttempt = now;
        this.setConnectionState('connecting');
        
        // Fetch socket configuration from CyTube
        const socketUrl = await this.getSocketConfig();
        this.logger.info(`Connecting to ${socketUrl}...`);
        
        this.socket = io(socketUrl, {
            transports: ['websocket'],
            reconnection: false, // We'll handle reconnection manually
            path: '/socket.io/'  // CyTube specific path
        });

        this.setupEventHandlers();
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.setConnectionState('disconnected');
                reject(new Error('Connection timeout'));
            }, 30000);

            this.socket.once('connect', () => {
                clearTimeout(timeout);
                this.connected = true;
                this.reconnectAttempts = 0;
                this.setConnectionState('connected');
                this.logger.info('Connected to CyTube server');
                resolve();
            });

            this.socket.once('connect_error', (error) => {
                clearTimeout(timeout);
                this.setConnectionState('disconnected');
                
                // Check for rate limit error
                if (error.message && error.message.includes('Rate limit')) {
                    this.logger.error('Rate limited by server! Backing off...');
                    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 60000); // Double delay, max 1 minute
                }
                
                reject(error);
            });
        });
    }

    setupEventHandlers() {
        // Remove all existing listeners first to prevent duplicates
        if (this.socket) {
            this.logger.debug('Removing existing socket listeners to prevent duplicates');
            this.socket.removeAllListeners();
        }
        
        this.logger.debug('Setting up socket event handlers');
        
        this.socket.on('disconnect', (reason) => {
            this.logger.info(`Disconnected: ${reason}`);
            this.connected = false;
            this.authenticated = false;
            this.setConnectionState('disconnected');
            this.emit('disconnected', reason);
            
            if (reason !== 'io client disconnect') {
                this.scheduleReconnect();
            }
        });

        this.socket.on('error', (error) => {
            this.logger.error('Socket error:', error);
            this.emit('error', error);
        });

        // Forward CyTube events
        const cytubeEvents = [
            'chatMsg', 'userlist', 'addUser', 'userLeave', 
            'usercount', 'rank', 'login', 'loginError',
            'channelOpts', 'channelPerms', 'setMotd',
            'mediaUpdate', 'changeMedia', 'moveVideo',
            'chatCooldown', 'noflood', 'needPassword',
            'setAFK', // AFK status updates
            'pm' // Private messages
        ];

        cytubeEvents.forEach(event => {
            this.socket.on(event, (...args) => {
                this.emit(event, ...args);
            });
        });
    }

    async joinChannel(channel) {
        if (!this.connected) {
            throw new Error('Not connected to server');
        }

        this.logger.info(`Joining channel: ${channel}`);
        this.socket.emit('joinChannel', { name: channel });

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Channel join timeout'));
            }, 10000);

            const cleanup = () => {
                clearTimeout(timeout);
                this.socket.off('rank');
                this.socket.off('needPassword');
                this.socket.off('channelOpts');
            };

            // CyTube might send rank or channelOpts to indicate successful join
            const handleJoinSuccess = () => {
                cleanup();
                this.logger.info(`Joined channel successfully`);
                resolve();
            };

            this.socket.once('rank', handleJoinSuccess);
            this.socket.once('channelOpts', handleJoinSuccess);

            this.socket.once('needPassword', () => {
                cleanup();
                reject(new Error('Channel requires password'));
            });
        });
    }

    async login(username, password) {
        if (!this.connected) {
            throw new Error('Not connected to server');
        }

        this.logger.info(`Logging in as: ${username}`);
        this.socket.emit('login', { name: username, pw: password });

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Login timeout'));
            }, 10000);

            const cleanup = () => {
                clearTimeout(timeout);
                this.socket.off('login');
                this.socket.off('loginError');
            };

            this.socket.once('login', (data) => {
                cleanup();
                this.authenticated = true;
                this.logger.info('Login successful');
                resolve(data);
            });

            this.socket.once('loginError', (error) => {
                cleanup();
                this.logger.error('Login failed:', error);
                reject(new Error(error));
            });
        });
    }

    sendChatMessage(message) {
        if (!this.connected) {
            this.logger.error('Cannot send message: not connected');
            return;
        }

        this.socket.emit('chatMsg', { 
            msg: message,
            meta: {} 
        });
    }

    disconnect() {
        // Cancel any pending reconnect
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.socket) {
            // Remove all listeners before disconnecting
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }
        this.connected = false;
        this.authenticated = false;
        this.setConnectionState('disconnected');
    }

    scheduleReconnect() {
        // Cancel any existing reconnect timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error('Max reconnection attempts reached');
            this.emit('reconnectFailed');
            return;
        }

        this.reconnectAttempts++;
        
        // Exponential backoff with jitter
        const baseDelay = this.reconnectDelay * Math.min(Math.pow(1.5, this.reconnectAttempts - 1), 10);
        const jitter = Math.random() * 0.3 * baseDelay; // 30% jitter
        const delay = Math.min(baseDelay + jitter, 300000); // Max 5 minutes
        
        this.setConnectionState('reconnecting');
        this.logger.info(`Reconnecting in ${Math.round(delay/1000)}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.emit('reconnecting');
        }, delay);
    }
    
    setConnectionState(state) {
        const oldState = this.connectionState;
        this.connectionState = state;
        if (oldState !== state) {
            this.emit('stateChange', { from: oldState, to: state });
        }
    }
    
    getConnectionState() {
        return this.connectionState;
    }
    
    isConnected() {
        return this.connectionState === 'connected' && this.connected;
    }
    
    async getSocketConfig() {
        try {
            const response = await fetch(`${this.config.cytube.url}/socketconfig/${this.config.cytube.channel}.json`);
            if (!response.ok) {
                throw new Error(`Failed to fetch socket config: ${response.status}`);
            }
            
            const socketConfig = await response.json();
            
            // Find a secure server, or fall back to any available server
            const server = socketConfig.servers.find(s => s.secure) || socketConfig.servers[0];
            
            if (!server) {
                throw new Error('No available servers in socket config');
            }
            
            this.logger.info(`Using socket server: ${server.url}`);
            return server.url;
        } catch (error) {
            this.logger.error('Failed to fetch socket config:', error);
            throw error;
        }
    }
}