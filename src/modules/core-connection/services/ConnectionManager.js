class ConnectionManager {
    constructor(module) {
        this.module = module;
        this.logger = module.logger;
        this.reconnectTimers = new Map();
    }
    
    async monitorConnections() {
        // Check all connections periodically
        setInterval(() => {
            for (const [room, connection] of this.module.connections) {
                if (!connection.isConnected() && !this.reconnectTimers.has(room)) {
                    this.logger.warn(`Connection lost for ${room}, scheduling reconnect`);
                    this.scheduleReconnect(room, connection);
                }
            }
        }, 10000);
    }
    
    scheduleReconnect(room, connection) {
        if (this.reconnectTimers.has(room)) {
            return;
        }
        
        const timer = setTimeout(async () => {
            try {
                await connection.connect();
                this.reconnectTimers.delete(room);
            } catch (error) {
                this.logger.error(`Reconnection failed for ${room}:`, error);
                this.reconnectTimers.delete(room);
                // Schedule another attempt
                this.scheduleReconnect(room, connection);
            }
        }, this.module.config.reconnectDelay);
        
        this.reconnectTimers.set(room, timer);
    }
    
    cancelReconnect(room) {
        const timer = this.reconnectTimers.get(room);
        if (timer) {
            clearTimeout(timer);
            this.reconnectTimers.delete(room);
        }
    }
    
    async reconnectAll() {
        const promises = [];
        
        for (const [room, connection] of this.module.connections) {
            if (!connection.isConnected()) {
                promises.push(
                    connection.connect().catch(error => {
                        this.logger.error(`Failed to reconnect ${room}:`, error);
                    })
                );
            }
        }
        
        await Promise.all(promises);
    }
}

export default ConnectionManager;