import { EventEmitter } from 'events';
import io from 'socket.io-client';

class RoomConnection extends EventEmitter {
    constructor(options) {
        super();
        
        this.room = options.room;
        this.server = options.server;
        this.username = options.username;
        this.password = options.password;
        this.socketOptions = options.socketOptions;
        this.eventBus = options.eventBus;
        this.logger = options.logger;
        
        this.socket = null;
        this.connected = false;
        this.loggedIn = false;
        this.reconnectAttempts = 0;
        this.heartbeatInterval = null;
    }
    
    async connect() {
        if (this.connected) {
            this.logger.warn(`Already connected to ${this.room}`);
            return;
        }
        
        try {
            // Fetch socket configuration from CyTube
            const socketUrl = await this.getSocketConfig();
            this.logger.info(`Connecting to ${socketUrl}...`);
            
            this.socket = io(socketUrl, {
                transports: ['websocket'],
                reconnection: false,
                path: '/socket.io/'
            });
            
            this.setupSocketHandlers();
            
            // Wait for connection
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 30000);
                
                this.socket.once('connect', () => {
                    clearTimeout(timeout);
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    resolve();
                });
                
                this.socket.once('connect_error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });
            
            // Start heartbeat
            this.startHeartbeat();
            
            // Join the channel first
            await this.joinChannel();
            
            // Attempt login if credentials provided
            if (this.username && this.password) {
                await this.login();
            }
            
            this.logger.info(`Connected to ${this.room}`);
            
        } catch (error) {
            this.logger.error(`Failed to connect to ${this.room}:`, error);
            throw error;
        }
    }
    
    async disconnect() {
        if (!this.connected) {
            return;
        }
        
        this.stopHeartbeat();
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket.removeAllListeners();
            this.socket = null;
        }
        
        this.connected = false;
        this.loggedIn = false;
        
        this.logger.info(`Disconnected from ${this.room}`);
    }
    
    async login() {
        if (!this.connected) {
            throw new Error('Not connected');
        }
        
        if (this.loggedIn) {
            return;
        }
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Login timeout'));
            }, 10000);
            
            this.socket.once('login', (data) => {
                clearTimeout(timeout);
                if (data.success) {
                    this.loggedIn = true;
                    this.emit('login', data);
                    resolve(data);
                } else {
                    reject(new Error(data.error || 'Login failed'));
                }
            });
            
            this.socket.emit('login', {
                name: this.username,
                pw: this.password
            });
        });
    }
    
    async joinChannel() {
        if (!this.connected) {
            throw new Error('Not connected to server');
        }

        this.logger.info(`Joining channel: ${this.room}`);
        
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

            this.socket.emit('joinChannel', { name: this.room });
        });
    }
    
    setupSocketHandlers() {
        // Connection events
        this.socket.on('connect', () => {
            this.connected = true;
            this.emit('connect');
        });
        
        this.socket.on('disconnect', (reason) => {
            this.connected = false;
            this.loggedIn = false;
            this.emit('disconnect', reason);
            
            // Handle reconnection
            if (reason === 'io server disconnect') {
                // Server disconnected us, try to reconnect
                this.scheduleReconnect();
            }
        });
        
        this.socket.on('connect_error', (error) => {
            this.emit('error', error);
        });
        
        // CyTube events - forward all to RoomConnection
        const cytubeEvents = [
            'chatMsg', 'pm', 'userJoin', 'userLeave', 'userlist',
            'setUserMeta', 'addUser', 'setAFK', 'voteskip',
            'changeMedia', 'mediaUpdate', 'setCurrent', 'queue',
            'queueFail', 'addQueue', 'delete', 'moveVideo',
            'setTemp', 'setLeader', 'kick', 'ban', 'banlist',
            'channelOpts', 'channelPerms', 'setMotd', 'drink',
            'announcement'
        ];
        
        cytubeEvents.forEach(event => {
            this.socket.on(event, (data) => {
                this.emit(event, data);
            });
        });
        
        // Handle errors
        this.socket.on('error', (error) => {
            this.logger.error(`Socket error for ${this.room}:`, error);
            this.emit('error', error);
        });
        
        // Handle login response
        this.socket.on('login', (data) => {
            if (!data.success && this.loggedIn) {
                // We were logged in but now we're not
                this.loggedIn = false;
                this.emit('logout', data);
            }
        });
        
        // Handle rank changes
        this.socket.on('rank', (rank) => {
            this.emit('rank', rank);
        });
    }
    
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.connected && this.socket) {
                this.socket.emit('ping');
            }
        }, 30000);
    }
    
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    scheduleReconnect() {
        if (this.reconnectAttempts >= 10) {
            this.logger.error(`Max reconnection attempts reached for ${this.room}`);
            return;
        }
        
        this.reconnectAttempts++;
        const delay = Math.min(5000 * this.reconnectAttempts, 30000);
        
        this.logger.info(`Scheduling reconnect for ${this.room} in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => {
            this.connect().catch(error => {
                this.logger.error(`Reconnection failed for ${this.room}:`, error);
                this.scheduleReconnect();
            });
        }, delay);
    }
    
    // Message sending methods
    sendMessage(message) {
        if (!this.connected) {
            throw new Error('Not connected');
        }
        
        this.socket.emit('chatMsg', {
            msg: message,
            meta: {}
        });
    }
    
    sendPrivateMessage(username, message) {
        if (!this.connected) {
            throw new Error('Not connected');
        }
        
        this.socket.emit('pm', {
            to: username,
            msg: message
        });
    }
    
    // Utility methods
    isConnected() {
        return this.connected;
    }
    
    isLoggedIn() {
        return this.loggedIn;
    }
    
    // Media control methods
    queueMedia(id, type, pos = 'end', temp = false) {
        if (!this.connected) {
            throw new Error('Not connected');
        }
        
        this.socket.emit('queue', {
            id,
            type,
            pos,
            temp
        });
    }
    
    deleteMedia(uid) {
        if (!this.connected) {
            throw new Error('Not connected');
        }
        
        this.socket.emit('delete', uid);
    }
    
    moveMedia(from, after) {
        if (!this.connected) {
            throw new Error('Not connected');
        }
        
        this.socket.emit('moveVideo', { from, after });
    }
    
    // User management methods
    kickUser(username, reason = '') {
        if (!this.connected) {
            throw new Error('Not connected');
        }
        
        this.socket.emit('kick', {
            name: username,
            reason
        });
    }
    
    banUser(username, reason = '') {
        if (!this.connected) {
            throw new Error('Not connected');
        }
        
        this.socket.emit('ban', {
            name: username,
            reason
        });
    }
    
    async getSocketConfig() {
        try {
            const response = await fetch(`${this.server}/socketconfig/${this.room}.json`);
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

export default RoomConnection;