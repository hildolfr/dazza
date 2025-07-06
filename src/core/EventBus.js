import { EventEmitter } from 'events';
import StackMonitor from './StackMonitor.js';
import { createLogger } from '../utils/LoggerCompatibilityLayer.js';

class EventBus extends EventEmitter {
    constructor(config = {}) {
        super();
        
        // Initialize logger first
        this.logger = createLogger({
            level: config.logLevel || 'info',
            console: config.logToConsole !== false
        });
        
        // Configuration
        this.config = {
            maxListeners: 100,
            logEvents: false,
            eventHistory: 1000,
            // Recursion protection configuration
            maxStackDepth: 10,
            maxEventsPerSecond: 100,
            eventHistoryRetention: 1000,
            circuitBreakerThreshold: 5,
            debugMode: false,
            deduplicationWindow: 100, // ms
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
        
        // Recursion protection state
        this.recursionProtection = {
            // Stack depth tracking
            emissionStack: new Set(),
            currentStackDepth: 0,
            
            // Event chain detection
            eventChains: new Map(), // eventId -> chain info
            activeChains: new Set(),
            
            // Source loop prevention
            eventSources: new Map(), // eventId -> source module
            
            // Circuit breaker
            circuitBreaker: {
                isOpen: false,
                failureCount: 0,
                lastFailureTime: null,
                cooldownPeriod: 60000 // 1 minute
            },
            
            // Event deduplication
            recentEvents: new Map(), // eventKey -> timestamp
            
            // Rate limiting
            eventRates: new Map(), // eventType -> { count, windowStart }
            
            // Memory management
            cleanupInterval: null,
            lastCleanup: Date.now()
        };
        
        // Error context tracking
        this.errorContext = new Map();
        
        // Initialize stack monitoring
        this.stackMonitor = new StackMonitor({
            ...config.stackMonitor,
            enableDebugLogging: this.config.debugMode,
            enableEmergencyShutdown: true
        });
        
        // Initialize cleanup interval
        this.initializeCleanup();
        
        // Setup stack monitoring integration
        this.setupStackMonitoring();
    }
    
    // ===== Stack Monitoring Integration =====
    
    setupStackMonitoring() {
        // Start stack monitoring
        this.stackMonitor.start();
        
        // Listen for stack monitoring events
        this.stackMonitor.on('stack:warning', (data) => {
            this.handleStackWarning(data);
        });
        
        this.stackMonitor.on('stack:critical', (data) => {
            this.handleStackCritical(data);
        });
        
        this.stackMonitor.on('stack:emergency', (data) => {
            this.handleStackEmergency(data);
        });
        
        this.stackMonitor.on('stack:shutdown', (data) => {
            this.handleStackShutdown(data);
        });
        
        this.stackMonitor.on('recursion:detected', (data) => {
            this.handleRecursionDetected(data);
        });
        
        this.stackMonitor.on('recovery:attempt', (data) => {
            this.handleStackRecovery(data);
        });
        
        // Register EventBus for emergency shutdown
        this.stackMonitor.emergencyShutdown.registerComponent(
            'EventBus',
            this.emergencyShutdownHandler.bind(this),
            1 // High priority
        );
        
        this.debugLog('Stack monitoring integration setup completed');
    }
    
    handleStackWarning(data) {
        this.debugLog(`STACK WARNING: Depth ${data.depth} reached threshold ${data.threshold}`);
        
        // Emit warning to modules
        try {
            super.emit('eventbus:stack_warning', {
                ...data,
                timestamp: Date.now(),
                eventBusStats: this.getBasicStats()
            });
        } catch (error) {
            this.debugLog(`Failed to emit stack warning: ${error.message}`);
        }
    }
    
    handleStackCritical(data) {
        this.debugLog(`STACK CRITICAL: Depth ${data.depth} reached threshold ${data.threshold}`);
        
        // Temporarily reduce maxStackDepth to be more aggressive
        const originalMaxDepth = this.config.maxStackDepth;
        this.config.maxStackDepth = Math.max(5, originalMaxDepth - 2);
        
        // Emit critical alert
        try {
            super.emit('eventbus:stack_critical', {
                ...data,
                timestamp: Date.now(),
                eventBusStats: this.getBasicStats(),
                actionTaken: 'reduced_stack_depth'
            });
        } catch (error) {
            this.debugLog(`Failed to emit stack critical: ${error.message}`);
        }
        
        // Restore original max depth after delay
        setTimeout(() => {
            this.config.maxStackDepth = originalMaxDepth;
            this.debugLog('Stack depth limit restored');
        }, 10000);
    }
    
    handleStackEmergency(data) {
        this.debugLog(`STACK EMERGENCY: Depth ${data.depth} reached threshold ${data.threshold}`);
        
        // Open circuit breaker immediately
        this.triggerCircuitBreaker(new Error('Stack emergency detected'));
        
        // Clear event emission stack
        this.recursionProtection.emissionStack.clear();
        this.recursionProtection.activeChains.clear();
        this.recursionProtection.currentStackDepth = 0;
        
        // Emit emergency alert (using super to bypass recursion protection)
        try {
            super.emit('eventbus:stack_emergency', {
                ...data,
                timestamp: Date.now(),
                actionTaken: 'circuit_breaker_opened'
            });
        } catch (error) {
            this.logger.error('[EventBus] Failed to emit stack emergency:', error);
        }
    }
    
    handleStackShutdown(data) {
        this.debugLog(`STACK SHUTDOWN: ${data.reason}`);
        
        // Immediately stop processing events
        this.recursionProtection.circuitBreaker.isOpen = true;
        
        // Emit final shutdown event
        try {
            super.emit('eventbus:emergency_shutdown', {
                ...data,
                timestamp: Date.now(),
                source: 'stack_monitor'
            });
        } catch (error) {
            this.logger.error('[EventBus] Failed to emit emergency shutdown:', error);
        }
        
        // Begin graceful shutdown
        this.emergencyShutdownHandler();
    }
    
    handleRecursionDetected(data) {
        this.debugLog(`RECURSION DETECTED: ${data.pattern.pattern || data.pattern}`);
        
        // Track recursion detection
        const protection = this.recursionProtection;
        
        // Clear related patterns from active chains
        if (data.pattern.functions) {
            for (const func of data.pattern.functions) {
                for (const [eventId, chainInfo] of protection.eventChains.entries()) {
                    if (chainInfo.event && chainInfo.event.includes(func)) {
                        protection.eventChains.delete(eventId);
                        protection.activeChains.delete(eventId);
                    }
                }
            }
        }
        
        // Emit recursion detection event
        try {
            super.emit('eventbus:recursion_detected', {
                ...data,
                timestamp: Date.now(),
                actionTaken: 'cleared_related_chains'
            });
        } catch (error) {
            this.debugLog(`Failed to emit recursion detection: ${error.message}`);
        }
    }
    
    handleStackRecovery(data) {
        this.debugLog(`STACK RECOVERY: Attempt ${data.attempt} for ${data.type}`);
        
        // Reset circuit breaker if it was opened due to stack issues
        if (this.recursionProtection.circuitBreaker.isOpen && data.type === 'critical_depth') {
            this.resetCircuitBreaker();
        }
        
        // Emit recovery event
        try {
            super.emit('eventbus:stack_recovery', {
                ...data,
                timestamp: Date.now()
            });
        } catch (error) {
            this.debugLog(`Failed to emit stack recovery: ${error.message}`);
        }
    }
    
    emergencyShutdownHandler() {
        this.debugLog('EventBus emergency shutdown initiated');
        
        try {
            // Stop stack monitoring
            this.stackMonitor.stop();
            
            // Clear all recursion protection state
            this.recursionProtection.emissionStack.clear();
            this.recursionProtection.activeChains.clear();
            this.recursionProtection.eventChains.clear();
            this.recursionProtection.eventSources.clear();
            this.recursionProtection.recentEvents.clear();
            this.recursionProtection.eventRates.clear();
            this.recursionProtection.currentStackDepth = 0;
            
            // Clear cleanup interval
            if (this.recursionProtection.cleanupInterval) {
                clearInterval(this.recursionProtection.cleanupInterval);
                this.recursionProtection.cleanupInterval = null;
            }
            
            // Remove all listeners to prevent further event processing
            this.removeAllListeners();
            
            this.debugLog('EventBus emergency shutdown completed');
            
        } catch (error) {
            this.logger.error('[EventBus] Error during emergency shutdown:', error);
        }
    }
    
    // ===== Enhanced Emit with Stack Monitoring =====
    
    emitWithStackMonitoring(event, data = {}) {
        // Provide stack trace to stack monitor
        const stackTrace = new Error().stack;
        
        // Analyze stack before emission
        const stackAnalysis = this.stackMonitor.stackAnalyzer.analyzePattern(stackTrace);
        
        if (stackAnalysis.isRecursive) {
            this.debugLog(`Blocking recursive event emission: ${event}`);
            
            // Emit recursion blocking event
            super.emit('eventbus:recursion_blocked', {
                event,
                analysis: stackAnalysis,
                timestamp: Date.now()
            });
            
            return false;
        }
        
        // Proceed with normal emission
        return this.emit(event, {
            ...data,
            _stackAnalysis: stackAnalysis
        });
    }
    
    getBasicStats() {
        return {
            totalEvents: this.stats.totalEvents,
            activeSubscriptions: this.eventHandlers.size,
            currentStackDepth: this.recursionProtection.currentStackDepth,
            circuitBreakerOpen: this.recursionProtection.circuitBreaker.isOpen
        };
    }
    
    // ===== Recursion Protection Methods =====
    
    initializeCleanup() {
        // Clean up memory-safe event history periodically
        this.recursionProtection.cleanupInterval = setInterval(() => {
            this.cleanupRecursionProtection();
        }, 30000); // Every 30 seconds
    }
    
    cleanupRecursionProtection() {
        const now = Date.now();
        const protection = this.recursionProtection;
        
        // Clean up recent events older than deduplication window
        const cutoff = now - this.config.deduplicationWindow;
        for (const [key, timestamp] of protection.recentEvents.entries()) {
            if (timestamp < cutoff) {
                protection.recentEvents.delete(key);
            }
        }
        
        // Clean up event chains older than 5 minutes
        const chainCutoff = now - 300000;
        for (const [eventId, chain] of protection.eventChains.entries()) {
            if (chain.timestamp < chainCutoff) {
                protection.eventChains.delete(eventId);
                protection.activeChains.delete(eventId);
            }
        }
        
        // Clean up event sources older than 5 minutes
        for (const [eventId, source] of protection.eventSources.entries()) {
            if (source.timestamp < chainCutoff) {
                protection.eventSources.delete(eventId);
            }
        }
        
        // Clean up error context older than 5 minutes
        for (const [errorKey, context] of this.errorContext.entries()) {
            if (now - context.timestamp > 300000) {
                this.errorContext.delete(errorKey);
            }
        }
        
        // Reset rate limiting windows every minute
        if (now - protection.lastCleanup > 60000) {
            protection.eventRates.clear();
            protection.lastCleanup = now;
        }
        
        // Check circuit breaker cooldown
        if (protection.circuitBreaker.isOpen && protection.circuitBreaker.lastFailureTime) {
            if (now - protection.circuitBreaker.lastFailureTime > protection.circuitBreaker.cooldownPeriod) {
                this.resetCircuitBreaker();
            }
        }
    }
    
    generateEventId() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    
    createEventKey(event, data) {
        // Create a key for deduplication based on event type and critical data
        const criticalData = {
            event,
            room: data?.room,
            username: data?.username,
            message: data?.message?.substring(0, 100) // Truncate long messages
        };
        
        // For service registration events, include the service name to avoid false duplicates
        if (event === 'service:register' && data?.name) {
            criticalData.serviceName = data.name;
        }
        
        return JSON.stringify(criticalData);
    }
    
    checkStackDepth() {
        if (this.recursionProtection.currentStackDepth >= this.config.maxStackDepth) {
            throw new Error(`Maximum recursion depth exceeded (${this.config.maxStackDepth})`);
        }
    }
    
    checkEventChain(eventId, event, sourceModule) {
        const protection = this.recursionProtection;
        
        // Check if this event is already in an active chain
        if (protection.activeChains.has(eventId)) {
            throw new Error(`Circular event emission detected for event: ${event}`);
        }
        
        // Track event chain
        protection.eventChains.set(eventId, {
            event,
            sourceModule,
            timestamp: Date.now(),
            depth: protection.currentStackDepth
        });
        
        protection.activeChains.add(eventId);
    }
    
    checkSourceLoop(event, sourceModule) {
        // Prevent modules from processing events they originated
        const eventKey = `${event}:${sourceModule}`;
        if (this.recursionProtection.emissionStack.has(eventKey)) {
            throw new Error(`Source loop detected: ${sourceModule} trying to emit ${event} it's already processing`);
        }
    }
    
    checkRateLimit(event) {
        const protection = this.recursionProtection;
        const now = Date.now();
        const windowSize = 1000; // 1 second window
        
        const rateInfo = protection.eventRates.get(event) || { count: 0, windowStart: now };
        
        // Reset window if needed
        if (now - rateInfo.windowStart >= windowSize) {
            rateInfo.count = 0;
            rateInfo.windowStart = now;
        }
        
        rateInfo.count++;
        protection.eventRates.set(event, rateInfo);
        
        if (rateInfo.count > this.config.maxEventsPerSecond) {
            throw new Error(`Rate limit exceeded for event ${event}: ${rateInfo.count} events in ${windowSize}ms`);
        }
    }
    
    checkDeduplication(eventKey) {
        const protection = this.recursionProtection;
        const now = Date.now();
        
        const lastEmission = protection.recentEvents.get(eventKey);
        if (lastEmission && (now - lastEmission) < this.config.deduplicationWindow) {
            return false; // Duplicate event, should be ignored
        }
        
        protection.recentEvents.set(eventKey, now);
        return true; // Event is unique
    }
    
    triggerCircuitBreaker(error) {
        const protection = this.recursionProtection;
        protection.circuitBreaker.failureCount++;
        protection.circuitBreaker.lastFailureTime = Date.now();
        
        if (protection.circuitBreaker.failureCount >= this.config.circuitBreakerThreshold) {
            protection.circuitBreaker.isOpen = true;
            
            // Log critical error
            this.debugLog('CRITICAL', `Circuit breaker opened due to recursion protection failures: ${error.message}`);
            
            // Emit emergency event
            setTimeout(() => {
                try {
                    super.emit('eventbus:emergency', {
                        reason: 'circuit_breaker_open',
                        error: error.message,
                        timestamp: Date.now()
                    });
                } catch (e) {
                    // Even emergency emission failed, log to logger
                    this.logger.error('[EventBus] Emergency event emission failed:', e);
                }
            }, 0);
        }
    }
    
    resetCircuitBreaker() {
        const protection = this.recursionProtection;
        protection.circuitBreaker.isOpen = false;
        protection.circuitBreaker.failureCount = 0;
        protection.circuitBreaker.lastFailureTime = null;
        
        this.debugLog('INFO', 'Circuit breaker reset - normal operation resumed');
    }
    
    debugLog(level, message) {
        if (this.config.debugMode) {
            // Map level to logger method
            switch (level?.toLowerCase()) {
                case 'error':
                case 'critical':
                    this.logger.error(`[EventBus] ${message}`);
                    break;
                case 'warn':
                case 'warning':
                    this.logger.warn(`[EventBus] ${message}`);
                    break;
                case 'info':
                    this.logger.info(`[EventBus] ${message}`);
                    break;
                case 'debug':
                default:
                    this.logger.debug(`[EventBus] ${message}`);
                    break;
            }
        }
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
        const protection = this.recursionProtection;
        
        // Check circuit breaker first
        if (protection.circuitBreaker.isOpen) {
            this.debugLog('WARNING', `Event emission blocked - circuit breaker is open: ${event}`);
            return false;
        }
        
        // Generate unique event ID for tracking
        const eventId = this.generateEventId();
        const eventKey = this.createEventKey(event, data);
        const sourceModule = data._sourceModule || 'unknown';
        
        try {
            // 1. Check stack depth
            this.checkStackDepth();
            
            // 2. Check for source loops
            this.checkSourceLoop(event, sourceModule);
            
            // 3. Check rate limits
            this.checkRateLimit(event);
            
            // 4. Check event deduplication
            if (!this.checkDeduplication(eventKey)) {
                this.debugLog('DEBUG', `Duplicate event ignored: ${event}`);
                return false;
            }
            
            // 5. Check event chains
            this.checkEventChain(eventId, event, sourceModule);
            
            // Increment stack depth
            protection.currentStackDepth++;
            
            // Add to emission stack
            const stackKey = `${event}:${sourceModule}`;
            protection.emissionStack.add(stackKey);
            
            // Store event source
            protection.eventSources.set(eventId, {
                module: sourceModule,
                timestamp: Date.now()
            });
            
            this.debugLog('DEBUG', `Emitting event: ${event} (depth: ${protection.currentStackDepth}, id: ${eventId})`);
            
            // Add metadata
            const eventData = {
                ...data,
                _event: event,
                _timestamp: Date.now(),
                _eventId: eventId,
                _stackDepth: protection.currentStackDepth
            };
            
            // Track event
            this.trackEvent(event, eventData);
            
            // Log if enabled
            if (this.config.logEvents) {
                this.logger.debug(`[EventBus] ${event}:`, eventData);
            }
            
            // Emit event using super to avoid recursion
            super.emit(event, eventData);
            
            // Clean up successful emission
            protection.emissionStack.delete(stackKey);
            protection.activeChains.delete(eventId);
            protection.currentStackDepth--;
            
            this.debugLog('DEBUG', `Event completed successfully: ${event} (depth: ${protection.currentStackDepth})`);
            
            return true;
            
        } catch (error) {
            // Handle recursion protection errors
            this.debugLog('ERROR', `Recursion protection triggered for ${event}: ${error.message}`);
            
            // Clean up on error
            const stackKey = `${event}:${sourceModule}`;
            protection.emissionStack.delete(stackKey);
            protection.activeChains.delete(eventId);
            if (protection.currentStackDepth > 0) {
                protection.currentStackDepth--;
            }
            
            // Trigger circuit breaker
            this.triggerCircuitBreaker(error);
            
            // Handle the error
            this.handleError(event, error, data);
            
            return false;
        }
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
                // Add source module to data for recursion protection
                const eventData = {
                    ...data,
                    _sourceModule: moduleId,
                    _targetModule: moduleId
                };
                
                try {
                    handler(eventData);
                } catch (error) {
                    this.handleError(event, error, eventData);
                }
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
        
        // Use circuit breaker for error events to prevent recursion
        if (this.recursionProtection.circuitBreaker.isOpen) {
            this.debugLog('WARN', `Circuit breaker open, suppressing error event for ${event}`);
            return;
        }
        
        // Emit error event with protection
        try {
            setTimeout(() => {
                super.emit('eventbus:error', {
                    event,
                    error: {
                        message: error.message,
                        stack: error.stack
                    },
                    data
                });
            }, 0);
        } catch (emitError) {
            // Error emission failed, log to logger as last resort
            this.logger.error(`[EventBus] Failed to emit error event for ${event}:`, emitError);
            this.triggerCircuitBreaker(emitError);
        }
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
        const protection = this.recursionProtection;
        
        const stats = {
            totalEvents: this.stats.totalEvents,
            eventCounts: Object.fromEntries(this.stats.eventCounts),
            errorCounts: Object.fromEntries(this.stats.errorCounts),
            activeSubscriptions: this.eventHandlers.size,
            registeredModules: this.moduleSubscriptions.size,
            recursionProtection: {
                currentStackDepth: protection.currentStackDepth,
                activeChains: protection.activeChains.size,
                recentEvents: protection.recentEvents.size,
                eventSources: protection.eventSources.size,
                circuitBreaker: {
                    isOpen: protection.circuitBreaker.isOpen,
                    failureCount: protection.circuitBreaker.failureCount,
                    lastFailureTime: protection.circuitBreaker.lastFailureTime
                },
                eventRates: Object.fromEntries(protection.eventRates),
                emissionStackSize: protection.emissionStack.size
            }
        };
        
        // Add stack monitoring stats if available
        if (this.stackMonitor) {
            stats.stackMonitoring = this.stackMonitor.getStatistics();
        }
        
        return stats;
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
    
    // ===== Recursion Protection Management =====
    
    getRecursionProtectionConfig() {
        return {
            maxStackDepth: this.config.maxStackDepth,
            maxEventsPerSecond: this.config.maxEventsPerSecond,
            eventHistoryRetention: this.config.eventHistoryRetention,
            circuitBreakerThreshold: this.config.circuitBreakerThreshold,
            debugMode: this.config.debugMode,
            deduplicationWindow: this.config.deduplicationWindow
        };
    }
    
    updateRecursionProtectionConfig(newConfig) {
        this.config = {
            ...this.config,
            ...newConfig
        };
        
        this.debugLog('INFO', 'Recursion protection configuration updated');
    }
    
    enableDebugMode() {
        this.config.debugMode = true;
        this.debugLog('INFO', 'Debug mode enabled');
    }
    
    disableDebugMode() {
        this.config.debugMode = false;
    }
    
    forceResetCircuitBreaker() {
        this.resetCircuitBreaker();
        this.debugLog('INFO', 'Circuit breaker manually reset');
    }
    
    getRecursionProtectionStatus() {
        const protection = this.recursionProtection;
        
        return {
            isHealthy: !protection.circuitBreaker.isOpen && protection.currentStackDepth < this.config.maxStackDepth,
            circuitBreakerOpen: protection.circuitBreaker.isOpen,
            currentStackDepth: protection.currentStackDepth,
            maxStackDepth: this.config.maxStackDepth,
            activeChains: protection.activeChains.size,
            recentEventsTracked: protection.recentEvents.size,
            memoryUsage: {
                eventChains: protection.eventChains.size,
                eventSources: protection.eventSources.size,
                emissionStack: protection.emissionStack.size,
                recentEvents: protection.recentEvents.size
            }
        };
    }
    
    clearRecursionProtectionHistory() {
        const protection = this.recursionProtection;
        
        // Clear all tracking data (but keep current state)
        protection.eventChains.clear();
        protection.eventSources.clear();
        protection.recentEvents.clear();
        protection.eventRates.clear();
        
        this.debugLog('INFO', 'Recursion protection history cleared');
    }
    
    // ===== Cleanup and Shutdown =====
    
    async shutdown() {
        // Clear cleanup interval
        if (this.recursionProtection.cleanupInterval) {
            clearInterval(this.recursionProtection.cleanupInterval);
            this.recursionProtection.cleanupInterval = null;
        }
        
        // Shutdown stack monitoring
        if (this.stackMonitor) {
            await this.stackMonitor.shutdown();
        }
        
        // Remove all listeners
        this.removeAllListeners();
        
        // Clear all tracking data
        this.clearRecursionProtectionHistory();
        
        this.debugLog('INFO', 'EventBus shutdown complete');
    }
    
    // ===== Performance Monitoring =====
    
    getPerformanceMetrics() {
        const protection = this.recursionProtection;
        const now = Date.now();
        
        // Calculate average event rate
        let totalEventsInWindow = 0;
        for (const [event, rateInfo] of protection.eventRates.entries()) {
            if (now - rateInfo.windowStart < 1000) {
                totalEventsInWindow += rateInfo.count;
            }
        }
        
        return {
            eventsPerSecond: totalEventsInWindow,
            memoryFootprint: {
                eventHistory: this.eventHistory.length,
                eventChains: protection.eventChains.size,
                eventSources: protection.eventSources.size,
                recentEvents: protection.recentEvents.size,
                eventRates: protection.eventRates.size
            },
            recursionMetrics: {
                maxStackDepthReached: protection.currentStackDepth,
                circuitBreakerTriggered: protection.circuitBreaker.failureCount > 0,
                activeChains: protection.activeChains.size
            }
        };
    }
}

export default EventBus;