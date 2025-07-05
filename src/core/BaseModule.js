const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;

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
        
        // Performance tracking
        this._metrics = {
            eventCount: 0,
            errorCount: 0,
            startTime: null
        };
        
        // Error handling
        this._retryCount = new Map();
        this._maxRetries = 3;
        this._retryDelay = 1000; // Base delay in ms
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
        
        // Cleanup scheduled tasks
        this.scheduler.removeModuleTasks(this.id);
        
        // Remove event listeners
        this.eventBus.removeModuleListeners(this.id);
    }
    
    async destroy() {
        // Override in subclass for cleanup
        await this.stop();
        this.state.clear();
        this._initialized = false;
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
        
        const errorInfo = {
            module: this.id,
            context,
            error: error.message,
            stack: error.stack,
            data
        };
        
        this.logger.error('Module error:', errorInfo);
        this.emit('module:error', errorInfo);
        
        // Retry logic for recoverable errors
        if (this._isRecoverableError(error)) {
            const retryKey = `${context}:${JSON.stringify(data)}`;
            const retryCount = this._retryCount.get(retryKey) || 0;
            
            if (retryCount < this._maxRetries) {
                const delay = this._retryDelay * Math.pow(2, retryCount); // Exponential backoff
                this._retryCount.set(retryKey, retryCount + 1);
                
                this.logger.info(`Retrying after ${delay}ms (attempt ${retryCount + 1}/${this._maxRetries})`);
                
                setTimeout(() => {
                    this._retryCount.delete(retryKey);
                    // Emit retry event for the module to handle
                    this.emit('retry', { context, data, attempt: retryCount + 1 });
                }, delay);
            } else {
                this.logger.error(`Max retries reached for ${context}`);
                this._retryCount.delete(retryKey);
            }
        }
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
            memory: process.memoryUsage.rss ? process.memoryUsage() : null
        };
    }
}

export default BaseModule;