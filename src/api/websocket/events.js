export function setupWebSocketEvents(apiServer) {
    const { io, bot } = apiServer;
    
    // Track connected clients for logging
    const clients = new Map();
    
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
                username: bot.connection?.username || null
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
            const subscribedTopics = topics.filter(topic => validTopics.includes(topic));
            
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
    
    // When bot connects/disconnects
    bot.on('connected', () => {
        apiServer.broadcastToTopic('bot', 'bot:connected', {
            channel: bot.connection.channel,
            username: bot.connection.username
        });
    });
    
    bot.on('disconnected', () => {
        apiServer.broadcastToTopic('bot', 'bot:disconnected', {});
    });
    
    // Gallery-related events
    
    // When an image is added
    bot.on('gallery:image:added', (data) => {
        apiServer.broadcastToTopic('gallery', 'gallery:image:added', data);
    });
    
    // When gallery is updated
    bot.on('gallery:updated', (username) => {
        apiServer.broadcastToTopic('gallery', 'gallery:updated', { username });
    });
    
    // Stats-related events
    
    // When user stats change
    bot.on('stats:user:update', (data) => {
        apiServer.broadcastToTopic('stats', 'stats:user:update', data);
    });
    
    // When channel stats change
    bot.on('stats:channel:update', (data) => {
        apiServer.broadcastToTopic('stats', 'stats:channel:activity', data);
    });
    
    // Chat-related events (if enabled)
    
    // When a message is received
    bot.on('chat:message', (data) => {
        // Only broadcast non-sensitive messages
        if (!data.message.startsWith('!') && !data.isPM) {
            apiServer.broadcastToTopic('chat', 'chat:message', {
                username: data.username,
                message: data.message.substring(0, 500), // Limit message length
                timestamp: data.timestamp
            });
        }
    });
    
    // When users join/leave
    bot.on('user:join', (username) => {
        apiServer.broadcastToTopic('chat', 'chat:user:join', { username });
    });
    
    bot.on('user:leave', (username) => {
        apiServer.broadcastToTopic('chat', 'chat:user:leave', { username });
    });
    
    // Media events
    bot.on('media:change', (media) => {
        apiServer.broadcastToTopic('chat', 'chat:media:change', {
            title: media.title,
            id: media.id,
            type: media.type,
            duration: media.duration
        });
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
    
    // Store interval for cleanup
    apiServer.websocketCleanup = () => {
        clearInterval(statsBroadcastInterval);
    };
    
    // API-specific events that can be emitted from routes
    
    // Gallery image deletion (called from route)
    apiServer.on('gallery:image:deleted', (data) => {
        apiServer.broadcastToTopic('gallery', 'gallery:image:deleted', data);
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