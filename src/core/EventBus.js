import { EventEmitter } from 'events';

class EventBus extends EventEmitter {
    constructor(config = {}) {
        super();
        
        // Configuration
        this.config = {
            maxListeners: 100,
            logEvents: false,
            eventHistory: 1000,
            ...config
        };
        
        this.setMaxListeners(this.config.maxListeners);
        
        // Event tracking
        this.eventHistory = [];
        this.moduleSubscriptions = new Map(); // module -> Set of events
        this.eventSubscribers = new Map(); // event -> Set of modules
        this.eventHandlers = new Map(); // module:event -> handler
        
        // Statistics
        this.stats = {
            totalEvents: 0,
            eventCounts: new Map(),
            errorCounts: new Map()
        };
        
        // Room filtering
        this.moduleRooms = new Map(); // module -> Set of allowed rooms
    }
    
    // ===== Module Registration =====
    
    registerModule(moduleId, allowedRooms = []) {
        if (!this.moduleSubscriptions.has(moduleId)) {
            this.moduleSubscriptions.set(moduleId, new Set());
        }
        
        // Store allowed rooms for automatic filtering
        this.moduleRooms.set(moduleId, new Set(allowedRooms));
    }
    
    unregisterModule(moduleId) {
        // Remove all subscriptions for this module
        const subscriptions = this.moduleSubscriptions.get(moduleId);
        if (subscriptions) {
            for (const event of subscriptions) {
                this.unsubscribe(moduleId, event);
            }
        }
        
        this.moduleSubscriptions.delete(moduleId);
        this.moduleRooms.delete(moduleId);
    }
    
    // ===== Subscription Management =====
    
    subscribe(moduleId, event, handler) {
        // Track subscription
        if (!this.moduleSubscriptions.has(moduleId)) {
            this.moduleSubscriptions.set(moduleId, new Set());
        }
        this.moduleSubscriptions.get(moduleId).add(event);
        
        if (!this.eventSubscribers.has(event)) {
            this.eventSubscribers.set(event, new Set());
        }
        this.eventSubscribers.get(event).add(moduleId);
        
        // Create wrapped handler with room filtering
        const wrappedHandler = (data) => {
            // Check room permissions if data contains room
            if (data?.room) {
                const allowedRooms = this.moduleRooms.get(moduleId);
                if (allowedRooms && allowedRooms.size > 0 && !allowedRooms.has(data.room)) {
                    // Module doesn't have permission for this room
                    return;
                }
            }
            
            // Call original handler
            return handler(data);
        };
        
        // Store handler reference for cleanup
        const handlerKey = `${moduleId}:${event}`;
        this.eventHandlers.set(handlerKey, wrappedHandler);
        
        // Subscribe to event
        this.on(event, wrappedHandler);
    }
    
    unsubscribe(moduleId, event) {
        const handlerKey = `${moduleId}:${event}`;
        const handler = this.eventHandlers.get(handlerKey);
        
        if (handler) {
            this.off(event, handler);
            this.eventHandlers.delete(handlerKey);
        }
        
        // Clean up tracking
        const moduleEvents = this.moduleSubscriptions.get(moduleId);
        if (moduleEvents) {
            moduleEvents.delete(event);
        }
        
        const eventModules = this.eventSubscribers.get(event);
        if (eventModules) {
            eventModules.delete(moduleId);
            if (eventModules.size === 0) {
                this.eventSubscribers.delete(event);
            }
        }
    }
    
    // ===== Event Emission =====
    
    emit(event, data = {}) {
        // Add metadata
        const eventData = {
            ...data,
            _event: event,
            _timestamp: Date.now()
        };
        
        // Track event
        this.trackEvent(event, eventData);
        
        // Log if enabled
        if (this.config.logEvents) {
            console.log(`[EventBus] ${event}:`, eventData);
        }
        
        // Emit event
        try {
            super.emit(event, eventData);
        } catch (error) {
            this.handleError(event, error, eventData);
        }
        
        return true;
    }
    
    // ===== Bulk Operations =====
    
    emitToRoom(room, event, data = {}) {
        this.emit(event, { ...data, room });
    }
    
    emitToRooms(rooms, event, data = {}) {
        for (const room of rooms) {
            this.emitToRoom(room, event, data);
        }
    }
    
    emitToModule(moduleId, event, data = {}) {
        // Only emit if module is subscribed to this event
        const moduleEvents = this.moduleSubscriptions.get(moduleId);
        if (moduleEvents && moduleEvents.has(event)) {
            const handlerKey = `${moduleId}:${event}`;
            const handler = this.eventHandlers.get(handlerKey);
            if (handler) {
                handler(data);
            }
        }
    }
    
    // ===== Event Tracking =====
    
    trackEvent(event, data) {
        this.stats.totalEvents++;
        
        // Track event count
        const count = this.stats.eventCounts.get(event) || 0;
        this.stats.eventCounts.set(event, count + 1);
        
        // Store in history
        if (this.config.eventHistory > 0) {
            this.eventHistory.push({
                event,
                data: this.sanitizeForHistory(data),
                timestamp: Date.now()
            });
            
            // Trim history
            if (this.eventHistory.length > this.config.eventHistory) {
                this.eventHistory.shift();
            }
        }
    }
    
    sanitizeForHistory(data) {
        // Remove sensitive data from history
        const sanitized = { ...data };
        const sensitiveKeys = ['password', 'token', 'secret', 'key'];
        
        for (const key of sensitiveKeys) {
            if (key in sanitized) {
                sanitized[key] = '[REDACTED]';
            }
        }
        
        return sanitized;
    }
    
    // ===== Error Handling =====
    
    handleError(event, error, data) {
        // Track error count
        const count = this.stats.errorCounts.get(event) || 0;
        this.stats.errorCounts.set(event, count + 1);
        
        // Emit error event
        this.emit('eventbus:error', {
            event,
            error: {
                message: error.message,
                stack: error.stack
            },
            data
        });
    }
    
    // ===== Utilities =====
    
    getSubscribers(event) {
        return Array.from(this.eventSubscribers.get(event) || []);
    }
    
    getModuleSubscriptions(moduleId) {
        return Array.from(this.moduleSubscriptions.get(moduleId) || []);
    }
    
    getEventHistory(event = null, limit = 100) {
        let history = this.eventHistory;
        
        if (event) {
            history = history.filter(entry => entry.event === event);
        }
        
        return history.slice(-limit);
    }
    
    getStats() {
        return {
            totalEvents: this.stats.totalEvents,
            eventCounts: Object.fromEntries(this.stats.eventCounts),
            errorCounts: Object.fromEntries(this.stats.errorCounts),
            activeSubscriptions: this.eventHandlers.size,
            registeredModules: this.moduleSubscriptions.size
        };
    }
    
    removeModuleListeners(moduleId) {
        const events = this.moduleSubscriptions.get(moduleId);
        if (events) {
            for (const event of events) {
                this.unsubscribe(moduleId, event);
            }
        }
    }
    
    // ===== Event Waiting =====
    
    async waitForEvent(event, timeout = 5000, filter = null) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.off(event, handler);
                reject(new Error(`Timeout waiting for event: ${event}`));
            }, timeout);
            
            const handler = (data) => {
                if (!filter || filter(data)) {
                    clearTimeout(timer);
                    this.off(event, handler);
                    resolve(data);
                }
            };
            
            this.on(event, handler);
        });
    }
    
    // ===== Event Patterns =====
    
    async request(event, data = {}, timeout = 5000) {
        const requestId = Math.random().toString(36).substring(7);
        const responseEvent = `${event}:response:${requestId}`;
        
        // Wait for response
        const responsePromise = this.waitForEvent(responseEvent, timeout);
        
        // Send request
        this.emit(event, { ...data, _requestId: requestId });
        
        return responsePromise;
    }
    
    respond(event, handler) {
        this.on(event, async (data) => {
            if (data._requestId) {
                try {
                    const response = await handler(data);
                    this.emit(`${event}:response:${data._requestId}`, response);
                } catch (error) {
                    this.emit(`${event}:response:${data._requestId}`, {
                        error: error.message
                    });
                }
            }
        });
    }
}

export default EventBus;