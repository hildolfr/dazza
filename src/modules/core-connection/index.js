const BaseModule = require('../../core/BaseModule');
const io = require('socket.io-client');
const RoomConnection = require('./services/RoomConnection');
const ConnectionManager = require('./services/ConnectionManager');

class CoreConnectionModule extends BaseModule {
    constructor(context) {
        super(context);
        this.connections = new Map();
        this.connectionManager = null;
    }

    async init() {
        await super.init();
        this.connectionManager = new ConnectionManager(this);
        
        // Initialize room connections from config
        const rooms = this._context.config.rooms || [];
        for (const roomConfig of rooms) {
            await this.createConnection(roomConfig);
        }
        
        // Listen for connection requests
        this.subscribe('connection:create', this.handleConnectionCreate.bind(this));
        this.subscribe('connection:destroy', this.handleConnectionDestroy.bind(this));
        
        // API for other modules to send messages
        this.publish('connection:api', {
            sendMessage: this.sendMessage.bind(this),
            sendPrivateMessage: this.sendPrivateMessage.bind(this),
            getConnection: this.getConnection.bind(this),
            getAllConnections: this.getAllConnections.bind(this)
        });
    }
    
    async start() {
        // Connect all configured rooms
        for (const [roomId, connection] of this.connections) {
            await connection.connect();
        }
    }
    
    async stop() {
        // Disconnect all rooms
        for (const [roomId, connection] of this.connections) {
            await connection.disconnect();
        }
        this.connections.clear();
    }
    
    async createConnection(roomConfig) {
        const { room, server, username, password } = roomConfig;
        
        if (this.connections.has(room)) {
            this.logger.warn(`Connection to ${room} already exists`);
            return this.connections.get(room);
        }
        
        const connection = new RoomConnection({
            room,
            server: server || 'https://cytu.be',
            username,
            password,
            socketOptions: this.config.socketOptions,
            eventBus: this.eventBus,
            logger: this.logger
        });
        
        // Set up connection event handlers
        this.setupConnectionHandlers(connection);
        
        this.connections.set(room, connection);
        this.logger.info(`Created connection for room: ${room}`);
        
        return connection;
    }
    
    setupConnectionHandlers(connection) {
        const room = connection.room;
        
        // Forward all CyTube events to the event bus with room context
        connection.on('connect', () => {
            this.publish('cytube:connect', { room });
        });
        
        connection.on('disconnect', (reason) => {
            this.publish('cytube:disconnect', { room, reason });
        });
        
        connection.on('login', (data) => {
            this.publish('cytube:login', { room, ...data });
        });
        
        connection.on('chatMsg', (data) => {
            this.publish('chat:message', {
                room,
                username: data.username,
                message: data.msg,
                time: data.time,
                meta: data.meta || {}
            });
        });
        
        connection.on('userJoin', (data) => {
            this.publish('user:join', {
                room,
                username: data.name,
                meta: data.meta || {}
            });
        });
        
        connection.on('userLeave', (data) => {
            this.publish('user:leave', {
                room,
                username: data.name
            });
        });
        
        connection.on('setUserMeta', (data) => {
            this.publish('user:meta', {
                room,
                username: data.name,
                meta: data.meta
            });
        });
        
        connection.on('userlist', (users) => {
            this.publish('room:userlist', {
                room,
                users: users.map(u => ({
                    username: u.name,
                    rank: u.rank,
                    meta: u.meta || {}
                }))
            });
        });
        
        connection.on('changeMedia', (data) => {
            this.publish('media:change', {
                room,
                id: data.id,
                type: data.type,
                title: data.title,
                duration: data.seconds,
                currentTime: data.currentTime
            });
        });
        
        connection.on('queue', (data) => {
            this.publish('media:queue', {
                room,
                items: data.items || data
            });
        });
        
        connection.on('addQueue', (data) => {
            this.publish('media:queued', {
                room,
                item: data.item,
                after: data.after,
                addedBy: data.addedby
            });
        });
        
        connection.on('pm', (data) => {
            this.publish('chat:pm', {
                room,
                from: data.username,
                message: data.msg,
                time: data.time,
                to: data.to
            });
        });
        
        // Error handling
        connection.on('error', (error) => {
            this.logger.error(`Connection error for ${room}:`, error);
            this.publish('cytube:error', { room, error: error.message });
        });
    }
    
    async handleConnectionCreate({ room, server, username, password }) {
        try {
            const connection = await this.createConnection({
                room,
                server,
                username,
                password
            });
            
            await connection.connect();
            
            this.publish('connection:created', { room });
        } catch (error) {
            this.logger.error(`Failed to create connection for ${room}:`, error);
            this.publish('connection:error', { room, error: error.message });
        }
    }
    
    async handleConnectionDestroy({ room }) {
        const connection = this.connections.get(room);
        if (!connection) {
            this.logger.warn(`No connection found for room: ${room}`);
            return;
        }
        
        try {
            await connection.disconnect();
            this.connections.delete(room);
            this.publish('connection:destroyed', { room });
        } catch (error) {
            this.logger.error(`Failed to destroy connection for ${room}:`, error);
            this.publish('connection:error', { room, error: error.message });
        }
    }
    
    // API Methods
    sendMessage(room, message) {
        const connection = this.connections.get(room);
        if (!connection) {
            throw new Error(`No connection found for room: ${room}`);
        }
        
        return connection.sendMessage(message);
    }
    
    sendPrivateMessage(room, username, message) {
        const connection = this.connections.get(room);
        if (!connection) {
            throw new Error(`No connection found for room: ${room}`);
        }
        
        return connection.sendPrivateMessage(username, message);
    }
    
    getConnection(room) {
        return this.connections.get(room);
    }
    
    getAllConnections() {
        return Array.from(this.connections.entries()).map(([room, conn]) => ({
            room,
            connected: conn.isConnected(),
            username: conn.username,
            server: conn.server
        }));
    }
}

module.exports = CoreConnectionModule;