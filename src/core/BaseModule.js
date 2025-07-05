import { EventEmitter } from 'events';
import path from 'path';
import { promises as fs } from 'fs';

class BaseModule extends EventEmitter {
    constructor(context) {
        super();
        
        // Module identity
        this.id = context.manifest.name;
        this.version = context.manifest.version;
        this.manifest = context.manifest;
        
        // Configuration (merged from manifest defaults and user config)
        this.config = this._mergeConfig(context);
        
        // Core services
        this.eventBus = context.eventBus;
        this.logger = context.logger.child({ module: this.id });
        this.scheduler = context.scheduler;
        this.performanceMonitor = context.performanceMonitor;
        
        // Store context reference for dynamic service access
        this._context = context;
        
        // Create dynamic getter for database service
        Object.defineProperty(this, 'db', {
            get: () => this._context.db,
            enumerable: true,
            configurable: true
        });
        
        // Module registry for direct access
        this.modules = context.modules;
        
        // Room management
        this.allowedRooms = new Set(this.manifest.rooms || []);
        this.roomConnections = context.roomConnections;
        
        // API reference
        this.api = context.api;
        
        // State management
        this.state = new Map();
        this._initialized = false;
        this._started = false;
        
        // Timer tracking for automatic cleanup
        this._timeouts = new Map(); // Map of timeout IDs to descriptions
        this._intervals = new Map(); // Map of interval IDs to descriptions
        this._isShuttingDown = false;
        
        // Performance tracking
        this._metrics = {
            eventCount: 0,
            errorCount: 0,
            startTime: null
        };
        
        // Error handling and cascade protection
        this._retryCount = new Map();
        this._maxRetries = 3;
        this._retryDelay = 1000; // Base delay in ms
        this._maxRetryDelay = 30000; // Max delay cap (30 seconds)
        this._retryTimeWindow = 60000; // Reset retry counts after 1 minute
        this._circuitBreaker = {
            isOpen: false,
            failureCount: 0,
            lastFailureTime: null,
            threshold: 5, // Open circuit after 5 failures
            timeout: 60000 // 1 minute timeout
        };
        this._operationLimits = new Map(); // Track operation frequency
        this._emergencyMode = false;
        
        // Bind cleanup for emergency shutdown
        this._boundCleanup = this._emergencyCleanup.bind(this);
        process.on('SIGINT', this._boundCleanup);
        process.on('SIGTERM', this._boundCleanup);
    }
    
    // ===== Lifecycle Methods =====
    
    async init() {
        // Override in subclass for initialization
        this._initialized = true;
    }
    
    async start() {
        // Override in subclass for startup
        this._started = true;
        this._metrics.startTime = Date.now();
    }
    
    async stop() {
        // Override in subclass for shutdown
        this._started = false;
        this._isShuttingDown = true;
        
        // Cleanup scheduled tasks
        this.scheduler.removeModuleTasks(this.id);
        
        // Remove event listeners
        this.eventBus.removeModuleListeners(this.id);
        
        // Clean up all tracked timers
        this._cleanupTimers();
    }
    
    async destroy() {
        // Override in subclass for cleanup
        await this.stop();
        this.state.clear();
        this._initialized = false;
        
        // Cleanup error handling state
        this._retryCount.clear();
        this._operationLimits.clear();
        
        // Remove process listeners
        process.removeListener('SIGINT', this._boundCleanup);
        process.removeListener('SIGTERM', this._boundCleanup);
        this._resetCircuitBreaker();
    }
    
    // ===== Configuration =====
    
    _mergeConfig(context) {
        const defaultConfig = this.manifest.config || {};
        const userConfig = context.userConfig || {};
        const envConfig = this._loadEnvConfig();
        
        // Priority: env > user > default
        return {
            ...defaultConfig,
            ...userConfig,
            ...envConfig
        };
    }
    
    _loadEnvConfig() {
        const prefix = `MODULE_${this.id.toUpperCase()}_`;
        const config = {};
        
        for (const [key, value] of Object.entries(process.env)) {
            if (key.startsWith(prefix)) {
                const configKey = key.slice(prefix.length).toLowerCase();
                config[configKey] = this._parseEnvValue(value);
            }
        }
        
        return config;
    }
    
    _parseEnvValue(value) {
        // Try to parse as JSON first
        try {
            return JSON.parse(value);
        } catch {
            // Return as string if not JSON
            return value;
        }
    }
    
    // ===== Room Management =====
    
    shouldHandleRoom(roomId) {
        // Empty array means all rooms
        if (this.allowedRooms.size === 0) return true;
        return this.allowedRooms.has(roomId);
    }
    
    getRoomConnection(roomId) {
        return this.roomConnections.get(roomId);
    }
    
    // ===== Event Handling =====
    
    subscribe(event, handler) {
        // Wrap handler for room filtering and error handling
        const wrappedHandler = async (data) => {
            try {
                // Auto-filter by room if data contains room field
                if (data?.room && !this.shouldHandleRoom(data.room)) {
                    return;
                }
                
                // Track metrics
                this._metrics.eventCount++;
                
                // Call actual handler with performance tracking
                const startTime = process.hrtime.bigint();
                await handler.call(this, data);
                const duration = Number(process.hrtime.bigint() - startTime) / 1e6; // ms
                
                // Report performance
                this.performanceMonitor.recordEvent(this.id, event, duration);
                
            } catch (error) {
                this._handleError(error, event, data);
            }
        };
        
        // Register with event bus
        this.eventBus.subscribe(this.id, event, wrappedHandler);
    }
    
    emit(event, data) {
        this.eventBus.emit(event, { ...data, _source: this.id });
    }
    
    publish(event, data) {
        // Alias for emit
        this.emit(event, data);
    }
    
    // ===== API Routes =====
    
    registerApiRoutes(routes) {
        if (!this.api) return;
        
        const wrappedRoutes = {};
        
        // Wrap each route handler with error handling
        for (const [route, handler] of Object.entries(routes)) {
            wrappedRoutes[route] = async (req, res, next) => {
                try {
                    const startTime = process.hrtime.bigint();
                    await handler.call(this, req, res, next);
                    const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
                    
                    this.performanceMonitor.recordApiCall(this.id, route, duration);
                } catch (error) {
                    this._handleError(error, 'api', { route, req });
                    next(error);
                }
            };
        }
        
        this.api.registerModuleRoutes(this.id, wrappedRoutes);
    }
    
    registerStaticAssets(assets) {
        if (!this.api) return;
        this.api.registerModuleStatic(this.id, assets);
    }
    
    // ===== Scheduling =====
    
    scheduleTask(name, cronPattern, handler) {
        const taskId = `${this.id}:${name}`;
        
        const wrappedHandler = async () => {
            try {
                const startTime = process.hrtime.bigint();
                await handler.call(this);
                const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
                
                this.performanceMonitor.recordTask(this.id, name, duration);
            } catch (error) {
                this._handleError(error, 'scheduled-task', { task: name });
            }
        };
        
        this.scheduler.schedule(taskId, cronPattern, wrappedHandler, {
            module: this.id,
            immediate: false
        });
    }
    
    scheduleInterval(name, intervalMs, handler) {
        const taskId = `${this.id}:${name}`;
        
        const wrappedHandler = async () => {
            try {
                await handler.call(this);
            } catch (error) {
                this._handleError(error, 'interval', { task: name });
            }
        };
        
        this.scheduler.interval(taskId, intervalMs, wrappedHandler, {
            module: this.id
        });
    }
    
    scheduleTimeout(name, delayMs, handler) {
        const taskId = `${this.id}:${name}`;
        
        const wrappedHandler = async () => {
            try {
                await handler.call(this);
            } catch (error) {
                this._handleError(error, 'timeout', { task: name });
            }
        };
        
        return this.scheduler.timeout(taskId, delayMs, wrappedHandler, {
            module: this.id
        });
    }
    
    // ===== Database Helpers =====
    
    async dbRun(query, params = []) {
        const startTime = process.hrtime.bigint();
        try {
            const result = await this.db.run(query, params);
            const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
            this.performanceMonitor.recordQuery(this.id, 'run', duration);
            return result;
        } catch (error) {
            this._handleError(error, 'database', { query, params });
            throw error;
        }
    }
    
    async dbGet(query, params = []) {
        const startTime = process.hrtime.bigint();
        try {
            const result = await this.db.get(query, params);
            const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
            this.performanceMonitor.recordQuery(this.id, 'get', duration);
            return result;
        } catch (error) {
            this._handleError(error, 'database', { query, params });
            throw error;
        }
    }
    
    async dbAll(query, params = []) {
        const startTime = process.hrtime.bigint();
        try {
            const result = await this.db.all(query, params);
            const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
            this.performanceMonitor.recordQuery(this.id, 'all', duration);
            return result;
        } catch (error) {
            this._handleError(error, 'database', { query, params });
            throw error;
        }
    }
    
    // ===== Chat Helpers =====
    
    sendMessage(room, message) {
        if (!this.shouldHandleRoom(room)) {
            this.logger.warn(`Attempted to send message to unauthorized room: ${room}`);
            return;
        }
        
        this.emit('bot:send', { room, message });
    }
    
    sendPrivateMessage(room, username, message) {
        if (!this.shouldHandleRoom(room)) return;
        
        this.emit('bot:pm', { room, username, message });
    }
    
    // ===== Error Handling =====
    
    async _handleError(error, context, data = {}) {
        this._metrics.errorCount++;
        
        // Check if we're in emergency mode
        if (this._emergencyMode) {
            this.logger.warn('Module in emergency mode, suppressing error handling');
            return;
        }
        
        // Update circuit breaker
        this._updateCircuitBreaker(error);
        
        const errorInfo = {
            module: this.id,
            context,
            error: error.message,
            stack: error.stack,
            data,
            circuitBreakerOpen: this._circuitBreaker.isOpen
        };
        
        this.logger.error('Module error:', errorInfo);
        
        // Don't emit error events if circuit breaker is open to prevent cascade
        if (!this._circuitBreaker.isOpen) {
            try {
                this.emit('module:error', errorInfo);
            } catch (emitError) {
                this.logger.error('Failed to emit module error event:', emitError);
                this._openCircuitBreaker();
            }
        }
        
        // Retry logic for recoverable errors (if circuit breaker allows)
        if (this._isRecoverableError(error) && !this._circuitBreaker.isOpen) {
            await this._attemptRetry(error, context, data);
        } else if (this._circuitBreaker.isOpen) {
            this.logger.error('Circuit breaker open, skipping retry attempt');
        }
    }
    
    _updateCircuitBreaker(error) {
        const now = Date.now();
        
        // Check if circuit breaker should be reset
        if (this._circuitBreaker.isOpen && 
            this._circuitBreaker.lastFailureTime && 
            (now - this._circuitBreaker.lastFailureTime) > this._circuitBreaker.timeout) {
            this._resetCircuitBreaker();
        }
        
        // Increment failure count
        this._circuitBreaker.failureCount++;
        this._circuitBreaker.lastFailureTime = now;
        
        // Open circuit breaker if threshold reached
        if (this._circuitBreaker.failureCount >= this._circuitBreaker.threshold) {
            this._openCircuitBreaker();
        }
    }
    
    _openCircuitBreaker() {
        this._circuitBreaker.isOpen = true;
        this.logger.error(`Circuit breaker opened for module ${this.id} after ${this._circuitBreaker.failureCount} failures`);
        
        // Enter emergency mode if too many failures
        if (this._circuitBreaker.failureCount > this._circuitBreaker.threshold * 2) {
            this._emergencyMode = true;
            this.logger.error(`Module ${this.id} entering emergency mode`);
        }
    }
    
    _resetCircuitBreaker() {
        this._circuitBreaker.isOpen = false;
        this._circuitBreaker.failureCount = 0;
        this._circuitBreaker.lastFailureTime = null;
        this._emergencyMode = false;
        this.logger.info(`Circuit breaker reset for module ${this.id}`);
    }
    
    async _attemptRetry(error, context, data) {
        const retryKey = `${context}:${JSON.stringify(data)}`;
        const now = Date.now();
        
        // Get or create retry tracking
        let retryInfo = this._retryCount.get(retryKey);
        if (!retryInfo) {
            retryInfo = { count: 0, firstAttempt: now };
            this._retryCount.set(retryKey, retryInfo);
        }
        
        // Check if retry window has expired
        if (now - retryInfo.firstAttempt > this._retryTimeWindow) {
            // Reset retry count after time window
            retryInfo.count = 0;
            retryInfo.firstAttempt = now;
        }
        
        // Check operation limits
        if (!this._checkOperationLimit(context)) {
            this.logger.warn(`Operation limit exceeded for ${context}, skipping retry`);
            return;
        }
        
        if (retryInfo.count < this._maxRetries) {
            // Calculate delay with exponential backoff and cap
            const delay = Math.min(
                this._retryDelay * Math.pow(2, retryInfo.count),
                this._maxRetryDelay
            );
            
            retryInfo.count++;
            
            this.logger.info(`Retrying after ${delay}ms (attempt ${retryInfo.count}/${this._maxRetries})`);
            
            // Track operation for rate limiting
            this._trackOperation(context);
            
            setTimeout(() => {
                if (!this._circuitBreaker.isOpen && !this._emergencyMode) {
                    // Emit retry event for the module to handle
                    this.emit('retry', { context, data, attempt: retryInfo.count });
                }
            }, delay);
        } else {
            this.logger.error(`Max retries reached for ${context}`);
            this._retryCount.delete(retryKey);
        }
    }
    
    _checkOperationLimit(context) {
        const now = Date.now();
        const limit = this._operationLimits.get(context) || [];
        
        // Remove old entries (older than 1 minute)
        const recent = limit.filter(timestamp => now - timestamp < 60000);
        
        // Check if we're exceeding 3 operations per minute
        if (recent.length >= 3) {
            return false;
        }
        
        this._operationLimits.set(context, recent);
        return true;
    }
    
    _trackOperation(context) {
        const now = Date.now();
        const limit = this._operationLimits.get(context) || [];
        limit.push(now);
        this._operationLimits.set(context, limit);
    }
    
    _isRecoverableError(error) {
        // Define recoverable error types
        const recoverableMessages = [
            'SQLITE_BUSY',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'socket hang up'
        ];
        
        return recoverableMessages.some(msg => 
            error.message?.includes(msg) || error.code === msg
        );
    }
    
    // ===== State Persistence =====
    
    async saveState(key, value) {
        this.state.set(key, value);
        
        // Persist to disk
        const statePath = path.join('data', 'module-state', `${this.id}.json`);
        try {
            const stateObj = Object.fromEntries(this.state);
            await fs.writeFile(statePath, JSON.stringify(stateObj, null, 2));
        } catch (error) {
            this.logger.error('Failed to save state:', error);
        }
    }
    
    async loadState() {
        const statePath = path.join('data', 'module-state', `${this.id}.json`);
        try {
            const data = await fs.readFile(statePath, 'utf8');
            const stateObj = JSON.parse(data);
            this.state = new Map(Object.entries(stateObj));
        } catch (error) {
            // State file doesn't exist or is invalid
            this.state = new Map();
        }
    }
    
    // ===== Module Access =====
    
    getModule(moduleId) {
        const module = this.modules.get(moduleId);
        if (!module) {
            throw new Error(`Module ${moduleId} not found or not loaded`);
        }
        return module.instance;
    }
    
    requireModule(moduleId) {
        // Check if this module has declared the dependency
        if (!this.manifest.requires?.includes(moduleId)) {
            this.logger.warn(`Module ${this.id} accessing undeclared dependency: ${moduleId}`);
        }
        return this.getModule(moduleId);
    }
    
    // ===== Metrics =====
    
    getMetrics() {
        return {
            ...this._metrics,
            uptime: this._started ? Date.now() - this._metrics.startTime : 0,
            memory: process.memoryUsage.rss ? process.memoryUsage() : null,
            circuitBreaker: {
                isOpen: this._circuitBreaker.isOpen,
                failureCount: this._circuitBreaker.failureCount,
                lastFailureTime: this._circuitBreaker.lastFailureTime
            },
            emergencyMode: this._emergencyMode,
            activeRetries: this._retryCount.size,
            operationLimits: this._operationLimits.size
        };
    }
    
    // Get circuit breaker status
    getCircuitBreakerStatus() {
        return {
            isOpen: this._circuitBreaker.isOpen,
            failureCount: this._circuitBreaker.failureCount,
            threshold: this._circuitBreaker.threshold,
            lastFailureTime: this._circuitBreaker.lastFailureTime,
            timeout: this._circuitBreaker.timeout,
            emergencyMode: this._emergencyMode
        };
    }
    
    // Manual circuit breaker reset (for admin commands)
    resetCircuitBreaker() {
        this._resetCircuitBreaker();
        this.logger.info(`Circuit breaker manually reset for module ${this.id}`);
    }
    
    // ===== Timer Management =====
    
    /**
     * Create and track a timeout with automatic cleanup
     */
    createTimeout(callback, delay, description = 'module-timeout') {
        const timeoutId = setTimeout(() => {
            this._timeouts.delete(timeoutId);
            if (!this._isShuttingDown) {
                try {
                    callback();
                } catch (error) {
                    this._handleError(error, 'timeout-callback', { description });
                }
            }
        }, delay);
        
        this._timeouts.set(timeoutId, {
            description,
            createdAt: Date.now(),
            delay
        });
        
        return timeoutId;
    }
    
    /**
     * Create and track an interval with automatic cleanup
     */
    createInterval(callback, interval, description = 'module-interval') {
        const intervalId = setInterval(() => {
            if (!this._isShuttingDown) {
                try {
                    callback();
                } catch (error) {
                    this._handleError(error, 'interval-callback', { description });
                }
            }
        }, interval);
        
        this._intervals.set(intervalId, {
            description,
            createdAt: Date.now(),
            interval
        });
        
        return intervalId;
    }
    
    /**
     * Clear a specific timeout
     */
    clearTimeout(timeoutId) {
        if (this._timeouts.has(timeoutId)) {
            clearTimeout(timeoutId);
            this._timeouts.delete(timeoutId);
            return true;
        }
        return false;
    }
    
    /**
     * Clear a specific interval
     */
    clearInterval(intervalId) {
        if (this._intervals.has(intervalId)) {
            clearInterval(intervalId);
            this._intervals.delete(intervalId);
            return true;
        }
        return false;
    }
    
    /**
     * Clean up all tracked timers
     */
    _cleanupTimers() {
        this.logger.debug(`[${this.id}] Cleaning up ${this._timeouts.size} timeouts and ${this._intervals.size} intervals`);
        
        // Clear all timeouts
        for (const [timeoutId, info] of this._timeouts) {
            clearTimeout(timeoutId);
            this.logger.debug(`[${this.id}] Cleared timeout: ${info.description}`);
        }
        this._timeouts.clear();
        
        // Clear all intervals
        for (const [intervalId, info] of this._intervals) {
            clearInterval(intervalId);
            this.logger.debug(`[${this.id}] Cleared interval: ${info.description}`);
        }
        this._intervals.clear();
    }
    
    /**
     * Emergency cleanup for process shutdown
     */
    _emergencyCleanup() {
        if (this._isShuttingDown) return; // Prevent duplicate cleanup
        
        this.logger.warn(`[${this.id}] Emergency cleanup initiated`);
        this._isShuttingDown = true;
        
        try {
            this._cleanupTimers();
            this.logger.info(`[${this.id}] Emergency cleanup completed`);
        } catch (error) {
            this.logger.error(`[${this.id}] Error during emergency cleanup:`, error);
        }
    }
    
    /**
     * Get timer statistics for monitoring
     */
    getTimerStats() {
        return {
            activeTimeouts: this._timeouts.size,
            activeIntervals: this._intervals.size,
            isShuttingDown: this._isShuttingDown,
            timeouts: Array.from(this._timeouts.entries()).map(([id, info]) => ({
                id,
                description: info.description,
                createdAt: info.createdAt,
                age: Date.now() - info.createdAt,
                delay: info.delay
            })),
            intervals: Array.from(this._intervals.entries()).map(([id, info]) => ({
                id,
                description: info.description,
                createdAt: info.createdAt,
                age: Date.now() - info.createdAt,
                interval: info.interval
            }))
        };
    }
    
    /**
     * Detect timer leaks in this module
     */
    detectTimerLeaks() {
        const leaks = [];
        const now = Date.now();
        const maxAge = 60 * 60 * 1000; // 1 hour
        
        // Check for long-running timeouts
        for (const [id, info] of this._timeouts) {
            const age = now - info.createdAt;
            if (age > maxAge) {
                leaks.push({
                    type: 'long_running_timeout',
                    id,
                    description: info.description,
                    age,
                    delay: info.delay
                });
            }
        }
        
        // Check for excessive timer counts
        if (this._timeouts.size > 50) {
            leaks.push({
                type: 'excessive_timeouts',
                count: this._timeouts.size
            });
        }
        
        if (this._intervals.size > 10) {
            leaks.push({
                type: 'excessive_intervals',
                count: this._intervals.size
            });
        }
        
        // Check for timers during shutdown
        if (this._isShuttingDown && (this._timeouts.size > 0 || this._intervals.size > 0)) {
            leaks.push({
                type: 'timers_during_shutdown',
                timeouts: this._timeouts.size,
                intervals: this._intervals.size
            });
        }
        
        return leaks;
    }
}

export default BaseModule;