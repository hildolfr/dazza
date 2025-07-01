export function setupWebSocketEvents(apiServer) {
    const { io, bot } = apiServer;
    
    // Track connected clients for logging
    const clients = new Map();
    
    // Store bot event listeners for cleanup
    const botEventListeners = [];
    
    io.on('connection', (socket) => {
        const clientInfo = {
            id: socket.id,
            address: socket.handshake.address,
            origin: socket.handshake.headers.origin,
            connectedAt: Date.now()
        };
        
        clients.set(socket.id, clientInfo);
        
        // Log connection
        bot.logger.debug('[API] WebSocket client connected', clientInfo);
        
        // Send welcome message with current state
        socket.emit('welcome', {
            version: '1.0.0',
            timestamp: Date.now(),
            bot: {
                connected: bot.connection?.connected || false,
                channel: bot.connection?.channel || null,
                username: bot.connection?.username || null,
                room: bot.connection?.room || 'fatpizza'
            }
        });
        
        // Handle client subscriptions
        socket.on('subscribe', (topics) => {
            if (!Array.isArray(topics)) {
                socket.emit('error', {
                    message: 'Topics must be an array',
                    code: 'INVALID_TOPICS'
                });
                return;
            }
            
            const validTopics = ['gallery', 'stats', 'chat', 'bot'];
            const subscribedTopics = topics.filter(topic => {
                // Support room-specific subscriptions like 'chat:fatpizza' or 'stats:room2'
                if (topic.includes(':')) {
                    const [topicType] = topic.split(':');
                    return validTopics.includes(topicType);
                }
                return validTopics.includes(topic);
            });
            
            subscribedTopics.forEach(topic => {
                socket.join(topic);
                bot.logger.debug(`[API] Client ${socket.id} subscribed to topic: ${topic}`);
            });
            
            socket.emit('subscribed', {
                topics: subscribedTopics,
                timestamp: Date.now()
            });
        });
        
        // Handle client unsubscribe
        socket.on('unsubscribe', (topics) => {
            if (!Array.isArray(topics)) {
                return;
            }
            
            topics.forEach(topic => {
                socket.leave(topic);
                bot.logger.debug(`[API] Client ${socket.id} unsubscribed from topic: ${topic}`);
            });
            
            socket.emit('unsubscribed', {
                topics,
                timestamp: Date.now()
            });
        });
        
        // Handle ping/pong for connection health
        socket.on('ping', () => {
            socket.emit('pong', {
                timestamp: Date.now()
            });
        });
        
        // Handle disconnection
        socket.on('disconnect', (reason) => {
            const clientInfo = clients.get(socket.id);
            if (clientInfo) {
                const duration = Date.now() - clientInfo.connectedAt;
                bot.logger.debug(`[API] WebSocket client disconnected`, {
                    ...clientInfo,
                    reason,
                    duration
                });
                clients.delete(socket.id);
            }
        });
    });
    
    // Helper functions for broadcasting events
    
    // Broadcast to specific topic rooms
    apiServer.broadcastToTopic = (topic, event, data) => {
        io.to(topic).emit(event, {
            ...data,
            timestamp: Date.now()
        });
        bot.logger.debug(`[API] Broadcast to topic ${topic}: ${event}`, data);
    };
    
    // Bot-related events
    
    // Helper function to register bot event listeners
    const registerBotListener = (event, handler) => {
        bot.on(event, handler);
        botEventListeners.push({ event, handler });
    };
    
    // When bot connects/disconnects
    registerBotListener('connected', () => {
        apiServer.broadcastToTopic('bot', 'bot:connected', {
            channel: bot.connection.channel,
            username: bot.connection.username,
            room: bot.connection.room || 'fatpizza'
        });
    });
    
    // When userlist is loaded
    registerBotListener('userlist:loaded', (data) => {
        const room = data?.room || bot.connection?.room || 'fatpizza';
        const currentUsers = bot.userlist ? bot.userlist.size : 0;
        const afkUsers = bot.getAFKUsers ? bot.getAFKUsers().length : 0;
        
        // Broadcast to room-specific topic if available
        apiServer.broadcastToTopic(`chat:${room}`, 'chat:usercount', {
            total: currentUsers,
            active: currentUsers - afkUsers,
            afk: afkUsers,
            room: room
        });
        
        // Also broadcast to general chat topic for backward compatibility
        apiServer.broadcastToTopic('chat', 'chat:usercount', {
            total: currentUsers,
            active: currentUsers - afkUsers,
            afk: afkUsers,
            room: room
        });
    });
    
    registerBotListener('disconnected', () => {
        apiServer.broadcastToTopic('bot', 'bot:disconnected', {});
    });
    
    // Gallery-related events
    
    // When an image is added
    registerBotListener('gallery:image:added', (data) => {
        apiServer.broadcastToTopic('gallery', 'gallery:image:added', data);
    });
    
    // When an image is restored
    registerBotListener('gallery:image:restored', (data) => {
        apiServer.broadcastToTopic('gallery', 'gallery:image:restored', data);
    });
    
    // When gallery is updated
    registerBotListener('gallery:updated', (username) => {
        apiServer.broadcastToTopic('gallery', 'gallery:updated', { username });
    });
    
    // Stats-related events
    
    // When user stats change
    registerBotListener('stats:user:update', (data) => {
        const room = data.room || bot.connection?.room || 'fatpizza';
        const payload = { ...data, room };
        
        apiServer.broadcastToTopic(`stats:${room}`, 'stats:user:update', payload);
        apiServer.broadcastToTopic('stats', 'stats:user:update', payload);
    });
    
    // When channel stats change
    registerBotListener('stats:channel:update', (data) => {
        const room = data.room || bot.connection?.room || 'fatpizza';
        const payload = { ...data, room };
        
        apiServer.broadcastToTopic(`stats:${room}`, 'stats:channel:activity', payload);
        apiServer.broadcastToTopic('stats', 'stats:channel:activity', payload);
    });
    
    // Chat-related events (if enabled)
    
    // When a message is received
    registerBotListener('chat:message', (data) => {
        // Only broadcast non-sensitive messages
        if (!data.message.startsWith('!') && !data.isPM) {
            const room = data.room || bot.connection?.room || 'fatpizza';
            const payload = {
                username: data.username,
                message: data.message.substring(0, 500), // Limit message length
                timestamp: data.timestamp,
                room: room
            };
            
            // Broadcast to room-specific topic
            apiServer.broadcastToTopic(`chat:${room}`, 'chat:message', payload);
            
            // Also broadcast to general chat topic for backward compatibility
            apiServer.broadcastToTopic('chat', 'chat:message', payload);
        }
    });
    
    // When users join/leave
    registerBotListener('user:join', (data) => {
        const username = typeof data === 'string' ? data : data.username;
        const room = (typeof data === 'object' && data.room) ? data.room : bot.connection?.room || 'fatpizza';
        
        apiServer.broadcastToTopic(`chat:${room}`, 'chat:user:join', { username, room });
        apiServer.broadcastToTopic('chat', 'chat:user:join', { username, room });
        
        // Also broadcast updated user count
        const currentUsers = bot.userlist ? bot.userlist.size : 0;
        const afkUsers = bot.getAFKUsers ? bot.getAFKUsers().length : 0;
        const userCountPayload = {
            total: currentUsers,
            active: currentUsers - afkUsers,
            afk: afkUsers,
            room: room
        };
        
        apiServer.broadcastToTopic(`chat:${room}`, 'chat:usercount', userCountPayload);
        apiServer.broadcastToTopic('chat', 'chat:usercount', userCountPayload);
    });
    
    registerBotListener('user:leave', (data) => {
        const username = typeof data === 'string' ? data : data.username;
        const room = (typeof data === 'object' && data.room) ? data.room : bot.connection?.room || 'fatpizza';
        
        apiServer.broadcastToTopic(`chat:${room}`, 'chat:user:leave', { username, room });
        apiServer.broadcastToTopic('chat', 'chat:user:leave', { username, room });
        
        // Also broadcast updated user count
        const currentUsers = bot.userlist ? bot.userlist.size : 0;
        const afkUsers = bot.getAFKUsers ? bot.getAFKUsers().length : 0;
        const userCountPayload = {
            total: currentUsers,
            active: currentUsers - afkUsers,
            afk: afkUsers,
            room: room
        };
        
        apiServer.broadcastToTopic(`chat:${room}`, 'chat:usercount', userCountPayload);
        apiServer.broadcastToTopic('chat', 'chat:usercount', userCountPayload);
    });
    
    // Media events
    registerBotListener('media:change', (media) => {
        const room = media.room || bot.connection?.room || 'fatpizza';
        const payload = {
            title: media.title,
            id: media.id,
            type: media.type,
            duration: media.duration,
            room: room
        };
        
        apiServer.broadcastToTopic(`chat:${room}`, 'chat:media:change', payload);
        apiServer.broadcastToTopic('chat', 'chat:media:change', payload);
    });
    
    // Periodic stats broadcast
    const statsBroadcastInterval = setInterval(() => {
        if (io.engine.clientsCount > 0) {
            // Get current stats
            const stats = {
                connected: bot.connection?.connected || false,
                uptime: bot.startTime ? Math.floor((Date.now() - bot.startTime) / 1000) : 0,
                clients: io.engine.clientsCount
            };
            
            apiServer.broadcastToTopic('stats', 'stats:heartbeat', stats);
        }
    }, 30000); // Every 30 seconds
    
    // Store cleanup function for both interval and event listeners
    apiServer.websocketCleanup = () => {
        // Clear the stats broadcast interval
        clearInterval(statsBroadcastInterval);
        
        // Remove all bot event listeners
        botEventListeners.forEach(({ event, handler }) => {
            bot.removeListener(event, handler);
        });
        
        // Clear the array
        botEventListeners.length = 0;
        
        bot.logger.debug('[API] WebSocket cleanup completed - removed all bot event listeners');
    };
    
    // API-specific events that can be emitted from routes
    
    // Single gallery image deletion (called from route)
    apiServer.on('gallery:image:deleted', (data) => {
        apiServer.broadcastToTopic('gallery', 'gallery:image:deleted', data);
    });
    
    // Batch gallery images deletion (called from database)
    registerBotListener('gallery:images:deleted', (data) => {
        apiServer.broadcastToTopic('gallery', 'gallery:images:deleted', data);
    });
    
    // Gallery lock change (called from route)
    apiServer.on('gallery:lock:changed', (data) => {
        apiServer.broadcastToTopic('gallery', 'gallery:lock:changed', data);
    });
    
    return {
        getClientCount: () => clients.size,
        getClients: () => Array.from(clients.values())
    };
}