# Modularity Refactor Plan - Complete Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Module Structure](#module-structure)
5. [Implementation Details](#implementation-details)
6. [Module Types](#module-types)
7. [Event System](#event-system)
8. [Scheduling System](#scheduling-system)
9. [API Integration](#api-integration)
10. [Configuration Management](#configuration-management)
11. [Error Handling](#error-handling)
12. [Performance Monitoring](#performance-monitoring)
13. [Migration Guide](#migration-guide)
14. [Code Examples](#code-examples)

## Overview

This document provides a complete implementation guide for refactoring the Dazza bot into a fully modular architecture. Every detail necessary for implementation is included.

### Goals
- **Reduce file sizes**: No file should exceed 500 lines
- **Enable hot-reloading**: Commands can be added/modified without restart
- **User control**: Modules can be enabled/disabled via configuration
- **Maintainability**: Clear separation of concerns
- **Performance monitoring**: Track module resource usage
- **Unified scheduling**: Consolidate all scheduled tasks

## Architecture

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                        Main Process                          │
├─────────────────────────────────────────────────────────────┤
│  Core System                                                 │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ ModuleLoader│ │ EventBus     │ │ UnifiedScheduler     │ │
│  └─────────────┘ └──────────────┘ └──────────────────────┘ │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │   Database  │ │ ConfigManager│ │ PerformanceMonitor   │ │
│  └─────────────┘ └──────────────┘ └──────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Module Layer                                                │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌────────────┐  │
│  │  Economy  │ │  Greeting │ │   Heist   │ │  Gallery   │  │
│  └───────────┘ └───────────┘ └───────────┘ └────────────┘  │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌────────────┐  │
│  │    API    │ │  Commands │ │   Stats   │ │   Media    │  │
│  └───────────┘ └───────────┘ └───────────┘ └────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Room Connections                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │ fatpizza │ │ testroom │ │  room3   │                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

### Directory Structure
```
src/
├── core/                           # Core system components
│   ├── BaseModule.js              # Base class for all modules
│   ├── ModuleLoader.js            # Module discovery and loading
│   ├── ModuleRegistry.js          # Central module registry
│   ├── EventBus.js               # Central event system with room filtering
│   ├── UnifiedScheduler.js       # Consolidated scheduling system
│   ├── ConfigManager.js          # Configuration management
│   ├── PerformanceMonitor.js     # Module performance tracking
│   ├── ErrorHandler.js           # Global error handling
│   └── ModuleContext.js          # Context builder for modules
│
├── modules/                       # All feature modules
│   ├── _template/                # Template for new modules
│   │   ├── index.js
│   │   ├── module.json
│   │   ├── commands/
│   │   ├── static/
│   │   └── README.md
│   │
│   ├── core-database/            # Database module (required)
│   │   ├── index.js
│   │   ├── module.json
│   │   ├── migrations/
│   │   └── services/
│   │       ├── MessageService.js
│   │       ├── UserService.js
│   │       └── EconomyService.js
│   │
│   ├── core-api/                 # API server module (required)
│   │   ├── index.js
│   │   ├── module.json
│   │   ├── middleware/
│   │   ├── static/
│   │   │   └── docs/
│   │   └── services/
│   │       └── RouteManager.js
│   │
│   ├── core-connection/          # Connection management (required)
│   │   ├── index.js
│   │   ├── module.json
│   │   └── services/
│   │       ├── ConnectionManager.js
│   │       └── RoomContext.js
│   │
│   ├── command-handler/          # Command system
│   │   ├── index.js
│   │   ├── module.json
│   │   ├── services/
│   │   │   ├── CommandRegistry.js
│   │   │   ├── CommandLoader.js
│   │   │   └── HotReloader.js
│   │   └── commands/             # Global commands
│   │       ├── help.js
│   │       └── reload.js
│   │
│   ├── economy/                  # Economy system
│   │   ├── index.js
│   │   ├── module.json
│   │   ├── commands/
│   │   │   ├── balance.js
│   │   │   ├── transfer.js
│   │   │   └── leaderboard.js
│   │   ├── api/
│   │   │   └── routes.js
│   │   └── services/
│   │       └── TransactionManager.js
│   │
│   ├── heist/                    # Heist game system
│   │   ├── index.js
│   │   ├── module.json
│   │   ├── commands/
│   │   │   ├── heist.js
│   │   │   └── forcejoin.js
│   │   ├── static/
│   │   │   └── heist-results.html
│   │   └── services/
│   │       ├── HeistGame.js
│   │       └── HeistScheduler.js
│   │
│   └── ... (other modules)
│
├── utils/                        # Shared utilities
│   ├── Logger.js
│   ├── Validators.js
│   └── Formatters.js
│
├── config/                       # Configuration
│   ├── default.yaml             # Default configuration
│   └── modules/                 # Module-specific configs
│       ├── economy.yaml
│       └── heist.yaml
│
├── data/                        # Runtime data
│   ├── cytube_stats.db         # Main database
│   ├── module-state/           # Module state persistence
│   └── logs/                   # Log files
│
└── index.js                    # Application entry point
```

## Core Components

### 1. BaseModule

The foundation for all modules:

```javascript
// core/BaseModule.js
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
        this.db = context.db;
        this.logger = context.logger.child({ module: this.id });
        this.scheduler = context.scheduler;
        this.performanceMonitor = context.performanceMonitor;
        
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

module.exports = BaseModule;
```

### 2. ModuleLoader

Handles module discovery and loading:

```javascript
// core/ModuleLoader.js
const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

class ModuleLoader extends EventEmitter {
    constructor(context) {
        super();
        this.context = context;
        this.modulesPath = path.join(__dirname, '..', 'modules');
        this.loadedModules = new Map();
        this.failedModules = new Map();
    }
    
    async discoverModules() {
        this.emit('discovery:start');
        const discovered = [];
        
        try {
            const entries = await fs.readdir(this.modulesPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory() && !entry.name.startsWith('_')) {
                    const modulePath = path.join(this.modulesPath, entry.name);
                    
                    try {
                        const moduleInfo = await this.loadModuleInfo(modulePath);
                        if (moduleInfo) {
                            discovered.push(moduleInfo);
                            this.emit('module:discovered', moduleInfo);
                        }
                    } catch (error) {
                        this.failedModules.set(entry.name, error);
                        this.emit('module:discovery-failed', { 
                            name: entry.name, 
                            error: error.message 
                        });
                    }
                }
            }
            
            this.emit('discovery:complete', { count: discovered.length });
            return discovered;
        } catch (error) {
            this.emit('discovery:error', error);
            throw error;
        }
    }
    
    async loadModuleInfo(modulePath) {
        const manifestPath = path.join(modulePath, 'module.json');
        const indexPath = path.join(modulePath, 'index.js');
        
        // Check if required files exist
        const [manifestExists, indexExists] = await Promise.all([
            this.fileExists(manifestPath),
            this.fileExists(indexPath)
        ]);
        
        if (!manifestExists || !indexExists) {
            return null;
        }
        
        // Load and validate manifest
        const manifestContent = await fs.readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(manifestContent);
        
        // Validate manifest
        this.validateManifest(manifest);
        
        return {
            path: modulePath,
            manifestPath,
            indexPath,
            manifest,
            name: manifest.name,
            enabled: this.isModuleEnabled(manifest)
        };
    }
    
    validateManifest(manifest) {
        const required = ['name', 'version', 'description'];
        
        for (const field of required) {
            if (!manifest[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        // Validate rooms array if present
        if (manifest.rooms && !Array.isArray(manifest.rooms)) {
            throw new Error('rooms must be an array');
        }
        
        // Validate requires array if present
        if (manifest.requires && !Array.isArray(manifest.requires)) {
            throw new Error('requires must be an array');
        }
        
        // Validate subscribes/emits if present
        if (manifest.subscribes && !Array.isArray(manifest.subscribes)) {
            throw new Error('subscribes must be an array');
        }
        
        if (manifest.emits && !Array.isArray(manifest.emits)) {
            throw new Error('emits must be an array');
        }
    }
    
    isModuleEnabled(manifest) {
        // Check if explicitly disabled in manifest
        if (manifest.enabled === false) {
            return false;
        }
        
        // Check global config override
        const globalConfig = this.context.config.modules?.[manifest.name];
        if (globalConfig?.enabled === false) {
            return false;
        }
        
        // Check environment variable override
        const envKey = `MODULE_${manifest.name.toUpperCase()}_ENABLED`;
        if (process.env[envKey] === 'false') {
            return false;
        }
        
        return true;
    }
    
    async loadModule(moduleInfo) {
        if (!moduleInfo.enabled) {
            this.emit('module:skipped', { 
                name: moduleInfo.name, 
                reason: 'disabled' 
            });
            return null;
        }
        
        this.emit('module:loading', { name: moduleInfo.name });
        
        try {
            // Clear require cache for hot reloading
            delete require.cache[require.resolve(moduleInfo.indexPath)];
            
            // Load module class
            const ModuleClass = require(moduleInfo.indexPath);
            
            // Create module context
            const moduleContext = this.createModuleContext(moduleInfo);
            
            // Instantiate module
            const instance = new ModuleClass(moduleContext);
            
            // Store loaded module
            this.loadedModules.set(moduleInfo.name, {
                info: moduleInfo,
                instance,
                class: ModuleClass
            });
            
            this.emit('module:loaded', { 
                name: moduleInfo.name,
                version: moduleInfo.manifest.version 
            });
            
            return instance;
        } catch (error) {
            this.failedModules.set(moduleInfo.name, error);
            this.emit('module:load-failed', { 
                name: moduleInfo.name, 
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
    
    createModuleContext(moduleInfo) {
        // Get module-specific configuration
        const moduleConfig = {
            ...moduleInfo.manifest.config,
            ...this.context.config.modules?.[moduleInfo.name]
        };
        
        return {
            manifest: moduleInfo.manifest,
            userConfig: moduleConfig,
            eventBus: this.context.eventBus,
            db: this.context.db,
            logger: this.context.logger,
            scheduler: this.context.scheduler,
            performanceMonitor: this.context.performanceMonitor,
            modules: this.context.moduleRegistry,
            roomConnections: this.context.roomConnections,
            api: this.context.api
        };
    }
    
    async reloadModule(moduleName) {
        const loaded = this.loadedModules.get(moduleName);
        if (!loaded) {
            throw new Error(`Module ${moduleName} is not loaded`);
        }
        
        this.emit('module:reloading', { name: moduleName });
        
        try {
            // Stop the existing module
            await loaded.instance.stop();
            await loaded.instance.destroy();
            
            // Reload module info
            const moduleInfo = await this.loadModuleInfo(loaded.info.path);
            
            // Load new instance
            const newInstance = await this.loadModule(moduleInfo);
            
            if (newInstance) {
                // Initialize and start new instance
                await newInstance.init();
                await newInstance.start();
                
                this.emit('module:reloaded', { name: moduleName });
                return newInstance;
            }
        } catch (error) {
            this.emit('module:reload-failed', { 
                name: moduleName, 
                error: error.message 
            });
            throw error;
        }
    }
    
    getLoadedModules() {
        return Array.from(this.loadedModules.entries()).map(([name, data]) => ({
            name,
            version: data.info.manifest.version,
            enabled: true,
            instance: data.instance
        }));
    }
    
    getFailedModules() {
        return Array.from(this.failedModules.entries()).map(([name, error]) => ({
            name,
            error: error.message,
            stack: error.stack
        }));
    }
    
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}

module.exports = ModuleLoader;
```

### 3. EventBus

Central event system with automatic room filtering:

```javascript
// core/EventBus.js
const EventEmitter = require('events');

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

module.exports = EventBus;
```

### 4. UnifiedScheduler

Consolidated scheduling system for all timed events:

```javascript
// core/UnifiedScheduler.js
const EventEmitter = require('events');
const cron = require('node-cron');

class UnifiedScheduler extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            timezone: 'Australia/Sydney',
            maxConcurrent: 10,
            ...config
        };
        
        // Task tracking
        this.tasks = new Map(); // taskId -> task object
        this.intervals = new Map(); // taskId -> interval
        this.timeouts = new Map(); // taskId -> timeout
        this.cronJobs = new Map(); // taskId -> cron job
        
        // Module tracking
        this.moduleTasks = new Map(); // moduleId -> Set of taskIds
        
        // Execution tracking
        this.running = new Set();
        this.history = [];
        this.maxHistory = 1000;
        
        // Statistics
        this.stats = {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            taskStats: new Map()
        };
    }
    
    // ===== Task Scheduling =====
    
    schedule(taskId, cronPattern, handler, options = {}) {
        if (this.tasks.has(taskId)) {
            throw new Error(`Task ${taskId} already exists`);
        }
        
        const task = {
            id: taskId,
            type: 'cron',
            pattern: cronPattern,
            handler,
            options,
            created: Date.now(),
            lastRun: null,
            nextRun: null,
            enabled: true
        };
        
        // Validate cron pattern
        if (!cron.validate(cronPattern)) {
            throw new Error(`Invalid cron pattern: ${cronPattern}`);
        }
        
        // Create cron job
        const job = cron.schedule(cronPattern, 
            () => this.executeTask(task),
            {
                scheduled: false,
                timezone: this.config.timezone
            }
        );
        
        // Store references
        this.tasks.set(taskId, task);
        this.cronJobs.set(taskId, job);
        this.trackModuleTask(taskId, options.module);
        
        // Start if not explicitly disabled
        if (options.start !== false) {
            job.start();
            task.nextRun = this.getNextRun(cronPattern);
        }
        
        this.emit('task:scheduled', { taskId, type: 'cron', pattern: cronPattern });
        
        return taskId;
    }
    
    interval(taskId, intervalMs, handler, options = {}) {
        if (this.tasks.has(taskId)) {
            throw new Error(`Task ${taskId} already exists`);
        }
        
        const task = {
            id: taskId,
            type: 'interval',
            interval: intervalMs,
            handler,
            options,
            created: Date.now(),
            lastRun: null,
            nextRun: Date.now() + intervalMs,
            enabled: true
        };
        
        // Create interval
        const interval = setInterval(
            () => this.executeTask(task),
            intervalMs
        );
        
        // Store references
        this.tasks.set(taskId, task);
        this.intervals.set(taskId, interval);
        this.trackModuleTask(taskId, options.module);
        
        // Execute immediately if requested
        if (options.immediate) {
            setImmediate(() => this.executeTask(task));
        }
        
        this.emit('task:scheduled', { taskId, type: 'interval', interval: intervalMs });
        
        return taskId;
    }
    
    timeout(taskId, delayMs, handler, options = {}) {
        if (this.tasks.has(taskId)) {
            throw new Error(`Task ${taskId} already exists`);
        }
        
        const task = {
            id: taskId,
            type: 'timeout',
            delay: delayMs,
            handler,
            options,
            created: Date.now(),
            executeAt: Date.now() + delayMs,
            enabled: true
        };
        
        // Create timeout
        const timeout = setTimeout(
            () => {
                this.executeTask(task);
                this.removeTask(taskId);
            },
            delayMs
        );
        
        // Store references
        this.tasks.set(taskId, task);
        this.timeouts.set(taskId, timeout);
        this.trackModuleTask(taskId, options.module);
        
        this.emit('task:scheduled', { taskId, type: 'timeout', delay: delayMs });
        
        return taskId;
    }
    
    // ===== Task Execution =====
    
    async executeTask(task) {
        if (!task.enabled) return;
        
        // Check concurrency limit
        if (this.running.size >= this.config.maxConcurrent) {
            this.emit('task:queued', { taskId: task.id });
            // Retry after a short delay
            setTimeout(() => this.executeTask(task), 1000);
            return;
        }
        
        const startTime = Date.now();
        this.running.add(task.id);
        
        this.emit('task:start', { taskId: task.id });
        
        try {
            // Execute handler
            const result = await task.handler();
            
            // Update task info
            task.lastRun = startTime;
            if (task.type === 'cron') {
                task.nextRun = this.getNextRun(task.pattern);
            } else if (task.type === 'interval') {
                task.nextRun = Date.now() + task.interval;
            }
            
            // Track execution
            const duration = Date.now() - startTime;
            this.trackExecution(task, true, duration, result);
            
            this.emit('task:complete', { 
                taskId: task.id, 
                duration, 
                result 
            });
            
        } catch (error) {
            // Track failure
            const duration = Date.now() - startTime;
            this.trackExecution(task, false, duration, error);
            
            this.emit('task:error', { 
                taskId: task.id, 
                duration,
                error: error.message,
                stack: error.stack
            });
            
            // Retry logic could go here
        } finally {
            this.running.delete(task.id);
        }
    }
    
    // ===== Task Management =====
    
    removeTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) return false;
        
        // Clean up based on task type
        if (task.type === 'cron') {
            const job = this.cronJobs.get(taskId);
            if (job) {
                job.stop();
                this.cronJobs.delete(taskId);
            }
        } else if (task.type === 'interval') {
            const interval = this.intervals.get(taskId);
            if (interval) {
                clearInterval(interval);
                this.intervals.delete(taskId);
            }
        } else if (task.type === 'timeout') {
            const timeout = this.timeouts.get(taskId);
            if (timeout) {
                clearTimeout(timeout);
                this.timeouts.delete(taskId);
            }
        }
        
        // Remove from tracking
        this.tasks.delete(taskId);
        this.untrackModuleTask(taskId);
        
        this.emit('task:removed', { taskId });
        
        return true;
    }
    
    removeModuleTasks(moduleId) {
        const taskIds = this.moduleTasks.get(moduleId);
        if (!taskIds) return;
        
        for (const taskId of taskIds) {
            this.removeTask(taskId);
        }
        
        this.moduleTasks.delete(moduleId);
    }
    
    pauseTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) return false;
        
        task.enabled = false;
        
        if (task.type === 'cron') {
            const job = this.cronJobs.get(taskId);
            if (job) job.stop();
        }
        
        this.emit('task:paused', { taskId });
        return true;
    }
    
    resumeTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) return false;
        
        task.enabled = true;
        
        if (task.type === 'cron') {
            const job = this.cronJobs.get(taskId);
            if (job) {
                job.start();
                task.nextRun = this.getNextRun(task.pattern);
            }
        }
        
        this.emit('task:resumed', { taskId });
        return true;
    }
    
    // ===== Tracking =====
    
    trackModuleTask(taskId, moduleId) {
        if (!moduleId) return;
        
        if (!this.moduleTasks.has(moduleId)) {
            this.moduleTasks.set(moduleId, new Set());
        }
        
        this.moduleTasks.get(moduleId).add(taskId);
    }
    
    untrackModuleTask(taskId) {
        for (const [moduleId, tasks] of this.moduleTasks.entries()) {
            if (tasks.has(taskId)) {
                tasks.delete(taskId);
                if (tasks.size === 0) {
                    this.moduleTasks.delete(moduleId);
                }
                break;
            }
        }
    }
    
    trackExecution(task, success, duration, result) {
        // Update statistics
        this.stats.totalExecutions++;
        if (success) {
            this.stats.successfulExecutions++;
        } else {
            this.stats.failedExecutions++;
        }
        
        // Track per-task stats
        if (!this.stats.taskStats.has(task.id)) {
            this.stats.taskStats.set(task.id, {
                executions: 0,
                successes: 0,
                failures: 0,
                totalDuration: 0,
                avgDuration: 0,
                lastDuration: 0
            });
        }
        
        const taskStats = this.stats.taskStats.get(task.id);
        taskStats.executions++;
        if (success) taskStats.successes++;
        else taskStats.failures++;
        taskStats.totalDuration += duration;
        taskStats.avgDuration = taskStats.totalDuration / taskStats.executions;
        taskStats.lastDuration = duration;
        
        // Add to history
        this.history.push({
            taskId: task.id,
            timestamp: Date.now(),
            success,
            duration,
            result: success ? result : result?.message
        });
        
        // Trim history
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }
    
    // ===== Utilities =====
    
    getNextRun(cronPattern) {
        const interval = cron.schedule(cronPattern, () => {}, { 
            scheduled: false,
            timezone: this.config.timezone
        });
        
        const next = interval.nextDates(1);
        interval.stop();
        
        return next[0]?.toDate().getTime() || null;
    }
    
    getTask(taskId) {
        return this.tasks.get(taskId);
    }
    
    getTasks(filter = {}) {
        let tasks = Array.from(this.tasks.values());
        
        if (filter.module) {
            const moduleTaskIds = this.moduleTasks.get(filter.module);
            if (moduleTaskIds) {
                tasks = tasks.filter(t => moduleTaskIds.has(t.id));
            } else {
                tasks = [];
            }
        }
        
        if (filter.type) {
            tasks = tasks.filter(t => t.type === filter.type);
        }
        
        if (filter.enabled !== undefined) {
            tasks = tasks.filter(t => t.enabled === filter.enabled);
        }
        
        return tasks;
    }
    
    getStats() {
        return {
            ...this.stats,
            taskStats: Object.fromEntries(this.stats.taskStats),
            runningTasks: Array.from(this.running),
            totalTasks: this.tasks.size,
            enabledTasks: Array.from(this.tasks.values()).filter(t => t.enabled).length
        };
    }
    
    getHistory(taskId = null, limit = 100) {
        let history = this.history;
        
        if (taskId) {
            history = history.filter(entry => entry.taskId === taskId);
        }
        
        return history.slice(-limit);
    }
}

module.exports = UnifiedScheduler;
```

### 5. ModuleRegistry

Central registry for managing loaded modules:

```javascript
// core/ModuleRegistry.js
const EventEmitter = require('events');

class ModuleRegistry extends EventEmitter {
    constructor() {
        super();
        
        this.modules = new Map(); // moduleId -> { instance, manifest, status }
        this.dependencies = new Map(); // moduleId -> Set of required moduleIds
        this.dependents = new Map(); // moduleId -> Set of dependent moduleIds
        
        // Module states
        this.STATES = {
            REGISTERED: 'registered',
            INITIALIZING: 'initializing',
            INITIALIZED: 'initialized',
            STARTING: 'starting',
            STARTED: 'started',
            STOPPING: 'stopping',
            STOPPED: 'stopped',
            ERROR: 'error'
        };
    }
    
    // ===== Registration =====
    
    register(moduleId, instance, manifest) {
        if (this.modules.has(moduleId)) {
            throw new Error(`Module ${moduleId} is already registered`);
        }
        
        // Store module
        this.modules.set(moduleId, {
            instance,
            manifest,
            status: this.STATES.REGISTERED,
            error: null
        });
        
        // Track dependencies
        if (manifest.requires && manifest.requires.length > 0) {
            this.dependencies.set(moduleId, new Set(manifest.requires));
            
            // Update dependents
            for (const depId of manifest.requires) {
                if (!this.dependents.has(depId)) {
                    this.dependents.set(depId, new Set());
                }
                this.dependents.get(depId).add(moduleId);
            }
        }
        
        this.emit('module:registered', { moduleId, manifest });
    }
    
    unregister(moduleId) {
        const module = this.modules.get(moduleId);
        if (!module) return false;
        
        // Check if other modules depend on this one
        const dependents = this.dependents.get(moduleId);
        if (dependents && dependents.size > 0) {
            throw new Error(`Cannot unregister ${moduleId}: required by ${Array.from(dependents).join(', ')}`);
        }
        
        // Remove from dependencies
        const deps = this.dependencies.get(moduleId);
        if (deps) {
            for (const depId of deps) {
                const depDependents = this.dependents.get(depId);
                if (depDependents) {
                    depDependents.delete(moduleId);
                }
            }
        }
        
        // Remove module
        this.modules.delete(moduleId);
        this.dependencies.delete(moduleId);
        this.dependents.delete(moduleId);
        
        this.emit('module:unregistered', { moduleId });
        return true;
    }
    
    // ===== Dependency Resolution =====
    
    resolveDependencies() {
        const resolved = [];
        const seen = new Set();
        
        const visit = (moduleId) => {
            if (seen.has(moduleId)) return;
            seen.add(moduleId);
            
            const deps = this.dependencies.get(moduleId);
            if (deps) {
                for (const depId of deps) {
                    if (!this.modules.has(depId)) {
                        throw new Error(`Module ${moduleId} requires ${depId}, which is not registered`);
                    }
                    visit(depId);
                }
            }
            
            resolved.push(moduleId);
        };
        
        // Visit all modules
        for (const moduleId of this.modules.keys()) {
            visit(moduleId);
        }
        
        return resolved;
    }
    
    // ===== Lifecycle Management =====
    
    async initializeModules() {
        const order = this.resolveDependencies();
        
        for (const moduleId of order) {
            await this.initializeModule(moduleId);
        }
    }
    
    async initializeModule(moduleId) {
        const module = this.modules.get(moduleId);
        if (!module) {
            throw new Error(`Module ${moduleId} not found`);
        }
        
        if (module.status !== this.STATES.REGISTERED) {
            return; // Already initialized
        }
        
        this.updateStatus(moduleId, this.STATES.INITIALIZING);
        
        try {
            await module.instance.init();
            this.updateStatus(moduleId, this.STATES.INITIALIZED);
            this.emit('module:initialized', { moduleId });
        } catch (error) {
            this.updateStatus(moduleId, this.STATES.ERROR, error);
            this.emit('module:error', { moduleId, error: error.message });
            throw error;
        }
    }
    
    async startModules() {
        const order = this.resolveDependencies();
        
        for (const moduleId of order) {
            await this.startModule(moduleId);
        }
    }
    
    async startModule(moduleId) {
        const module = this.modules.get(moduleId);
        if (!module) {
            throw new Error(`Module ${moduleId} not found`);
        }
        
        if (module.status !== this.STATES.INITIALIZED) {
            return; // Not ready to start
        }
        
        this.updateStatus(moduleId, this.STATES.STARTING);
        
        try {
            await module.instance.start();
            this.updateStatus(moduleId, this.STATES.STARTED);
            this.emit('module:started', { moduleId });
        } catch (error) {
            this.updateStatus(moduleId, this.STATES.ERROR, error);
            this.emit('module:error', { moduleId, error: error.message });
            throw error;
        }
    }
    
    async stopModules() {
        // Stop in reverse order
        const order = this.resolveDependencies().reverse();
        
        for (const moduleId of order) {
            await this.stopModule(moduleId);
        }
    }
    
    async stopModule(moduleId) {
        const module = this.modules.get(moduleId);
        if (!module) {
            throw new Error(`Module ${moduleId} not found`);
        }
        
        if (module.status !== this.STATES.STARTED) {
            return; // Not running
        }
        
        this.updateStatus(moduleId, this.STATES.STOPPING);
        
        try {
            await module.instance.stop();
            this.updateStatus(moduleId, this.STATES.STOPPED);
            this.emit('module:stopped', { moduleId });
        } catch (error) {
            this.updateStatus(moduleId, this.STATES.ERROR, error);
            this.emit('module:error', { moduleId, error: error.message });
            throw error;
        }
    }
    
    // ===== Status Management =====
    
    updateStatus(moduleId, status, error = null) {
        const module = this.modules.get(moduleId);
        if (!module) return;
        
        module.status = status;
        module.error = error;
        
        this.emit('module:status-changed', { 
            moduleId, 
            status,
            error: error?.message 
        });
    }
    
    getStatus(moduleId) {
        const module = this.modules.get(moduleId);
        return module ? module.status : null;
    }
    
    // ===== Module Access =====
    
    get(moduleId) {
        return this.modules.get(moduleId);
    }
    
    getInstance(moduleId) {
        return this.modules.get(moduleId)?.instance;
    }
    
    getAll() {
        return Array.from(this.modules.entries()).map(([id, module]) => ({
            id,
            manifest: module.manifest,
            status: module.status,
            error: module.error?.message
        }));
    }
    
    has(moduleId) {
        return this.modules.has(moduleId);
    }
    
    // ===== Dependency Queries =====
    
    getDependencies(moduleId) {
        return Array.from(this.dependencies.get(moduleId) || []);
    }
    
    getDependents(moduleId) {
        return Array.from(this.dependents.get(moduleId) || []);
    }
    
    canUnload(moduleId) {
        const dependents = this.dependents.get(moduleId);
        return !dependents || dependents.size === 0;
    }
    
    // ===== Module Discovery =====
    
    findModulesByCapability(capability) {
        const modules = [];
        
        for (const [id, module] of this.modules.entries()) {
            const provides = module.manifest.provides || [];
            if (provides.includes(capability)) {
                modules.push(id);
            }
        }
        
        return modules;
    }
    
    getModulesByStatus(status) {
        const modules = [];
        
        for (const [id, module] of this.modules.entries()) {
            if (module.status === status) {
                modules.push(id);
            }
        }
        
        return modules;
    }
}

module.exports = ModuleRegistry;
```

### 6. PerformanceMonitor

Tracks module performance metrics:

```javascript
// core/PerformanceMonitor.js
const EventEmitter = require('events');

class PerformanceMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            sampleInterval: 60000, // 1 minute
            maxSamples: 1440, // 24 hours at 1 minute intervals
            memoryWarningThreshold: 100 * 1024 * 1024, // 100MB
            cpuWarningThreshold: 80, // 80%
            ...config
        };
        
        // Metrics storage
        this.metrics = {
            modules: new Map(), // moduleId -> metrics
            system: {
                samples: [],
                current: {}
            }
        };
        
        // Start monitoring
        this.startMonitoring();
    }
    
    // ===== Module Metrics =====
    
    initModuleMetrics(moduleId) {
        if (!this.metrics.modules.has(moduleId)) {
            this.metrics.modules.set(moduleId, {
                events: {
                    count: 0,
                    totalDuration: 0,
                    avgDuration: 0,
                    maxDuration: 0,
                    byEvent: new Map()
                },
                api: {
                    count: 0,
                    totalDuration: 0,
                    avgDuration: 0,
                    maxDuration: 0,
                    byRoute: new Map()
                },
                database: {
                    count: 0,
                    totalDuration: 0,
                    avgDuration: 0,
                    maxDuration: 0,
                    byQuery: new Map()
                },
                tasks: {
                    count: 0,
                    totalDuration: 0,
                    avgDuration: 0,
                    maxDuration: 0,
                    byTask: new Map()
                },
                errors: {
                    count: 0,
                    byType: new Map()
                },
                memory: {
                    current: 0,
                    peak: 0,
                    samples: []
                }
            });
        }
    }
    
    recordEvent(moduleId, event, duration) {
        this.initModuleMetrics(moduleId);
        const metrics = this.metrics.modules.get(moduleId).events;
        
        metrics.count++;
        metrics.totalDuration += duration;
        metrics.avgDuration = metrics.totalDuration / metrics.count;
        metrics.maxDuration = Math.max(metrics.maxDuration, duration);
        
        // Track by event
        if (!metrics.byEvent.has(event)) {
            metrics.byEvent.set(event, {
                count: 0,
                totalDuration: 0,
                avgDuration: 0,
                maxDuration: 0
            });
        }
        
        const eventMetrics = metrics.byEvent.get(event);
        eventMetrics.count++;
        eventMetrics.totalDuration += duration;
        eventMetrics.avgDuration = eventMetrics.totalDuration / eventMetrics.count;
        eventMetrics.maxDuration = Math.max(eventMetrics.maxDuration, duration);
        
        // Check for slow events
        if (duration > 1000) { // 1 second
            this.emit('performance:slow-event', {
                moduleId,
                event,
                duration
            });
        }
    }
    
    recordApiCall(moduleId, route, duration) {
        this.initModuleMetrics(moduleId);
        const metrics = this.metrics.modules.get(moduleId).api;
        
        metrics.count++;
        metrics.totalDuration += duration;
        metrics.avgDuration = metrics.totalDuration / metrics.count;
        metrics.maxDuration = Math.max(metrics.maxDuration, duration);
        
        // Track by route
        if (!metrics.byRoute.has(route)) {
            metrics.byRoute.set(route, {
                count: 0,
                totalDuration: 0,
                avgDuration: 0,
                maxDuration: 0
            });
        }
        
        const routeMetrics = metrics.byRoute.get(route);
        routeMetrics.count++;
        routeMetrics.totalDuration += duration;
        routeMetrics.avgDuration = routeMetrics.totalDuration / routeMetrics.count;
        routeMetrics.maxDuration = Math.max(routeMetrics.maxDuration, duration);
        
        // Check for slow API calls
        if (duration > 3000) { // 3 seconds
            this.emit('performance:slow-api', {
                moduleId,
                route,
                duration
            });
        }
    }
    
    recordQuery(moduleId, queryType, duration) {
        this.initModuleMetrics(moduleId);
        const metrics = this.metrics.modules.get(moduleId).database;
        
        metrics.count++;
        metrics.totalDuration += duration;
        metrics.avgDuration = metrics.totalDuration / metrics.count;
        metrics.maxDuration = Math.max(metrics.maxDuration, duration);
        
        // Track by query type
        if (!metrics.byQuery.has(queryType)) {
            metrics.byQuery.set(queryType, {
                count: 0,
                totalDuration: 0,
                avgDuration: 0,
                maxDuration: 0
            });
        }
        
        const queryMetrics = metrics.byQuery.get(queryType);
        queryMetrics.count++;
        queryMetrics.totalDuration += duration;
        queryMetrics.avgDuration = queryMetrics.totalDuration / queryMetrics.count;
        queryMetrics.maxDuration = Math.max(queryMetrics.maxDuration, duration);
        
        // Check for slow queries
        if (duration > 500) { // 500ms
            this.emit('performance:slow-query', {
                moduleId,
                queryType,
                duration
            });
        }
    }
    
    recordTask(moduleId, taskName, duration) {
        this.initModuleMetrics(moduleId);
        const metrics = this.metrics.modules.get(moduleId).tasks;
        
        metrics.count++;
        metrics.totalDuration += duration;
        metrics.avgDuration = metrics.totalDuration / metrics.count;
        metrics.maxDuration = Math.max(metrics.maxDuration, duration);
        
        // Track by task
        if (!metrics.byTask.has(taskName)) {
            metrics.byTask.set(taskName, {
                count: 0,
                totalDuration: 0,
                avgDuration: 0,
                maxDuration: 0
            });
        }
        
        const taskMetrics = metrics.byTask.get(taskName);
        taskMetrics.count++;
        taskMetrics.totalDuration += duration;
        taskMetrics.avgDuration = taskMetrics.totalDuration / taskMetrics.count;
        taskMetrics.maxDuration = Math.max(taskMetrics.maxDuration, duration);
    }
    
    recordError(moduleId, errorType) {
        this.initModuleMetrics(moduleId);
        const metrics = this.metrics.modules.get(moduleId).errors;
        
        metrics.count++;
        
        const count = metrics.byType.get(errorType) || 0;
        metrics.byType.set(errorType, count + 1);
    }
    
    // ===== System Monitoring =====
    
    startMonitoring() {
        this.monitoringInterval = setInterval(() => {
            this.collectSystemMetrics();
        }, this.config.sampleInterval);
        
        // Initial collection
        this.collectSystemMetrics();
    }
    
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }
    
    collectSystemMetrics() {
        const usage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        const sample = {
            timestamp: Date.now(),
            memory: {
                rss: usage.rss,
                heapTotal: usage.heapTotal,
                heapUsed: usage.heapUsed,
                external: usage.external,
                arrayBuffers: usage.arrayBuffers
            },
            cpu: {
                user: cpuUsage.user,
                system: cpuUsage.system
            }
        };
        
        // Store sample
        this.metrics.system.samples.push(sample);
        if (this.metrics.system.samples.length > this.config.maxSamples) {
            this.metrics.system.samples.shift();
        }
        
        // Update current
        this.metrics.system.current = sample;
        
        // Check thresholds
        if (usage.heapUsed > this.config.memoryWarningThreshold) {
            this.emit('performance:memory-warning', {
                used: usage.heapUsed,
                threshold: this.config.memoryWarningThreshold
            });
        }
        
        // Calculate module memory (approximate)
        this.updateModuleMemory();
    }
    
    updateModuleMemory() {
        // This is a simplified approach - in reality, you'd need more sophisticated tracking
        const totalModules = this.metrics.modules.size;
        if (totalModules === 0) return;
        
        const heapUsed = process.memoryUsage().heapUsed;
        const baseMemory = 50 * 1024 * 1024; // Assume 50MB base
        const moduleMemory = (heapUsed - baseMemory) / totalModules;
        
        for (const [moduleId, metrics] of this.metrics.modules.entries()) {
            metrics.memory.current = moduleMemory;
            metrics.memory.peak = Math.max(metrics.memory.peak, moduleMemory);
            
            metrics.memory.samples.push({
                timestamp: Date.now(),
                value: moduleMemory
            });
            
            if (metrics.memory.samples.length > 60) { // Keep last hour
                metrics.memory.samples.shift();
            }
        }
    }
    
    // ===== Reporting =====
    
    getModuleReport(moduleId) {
        const metrics = this.metrics.modules.get(moduleId);
        if (!metrics) return null;
        
        return {
            events: {
                ...metrics.events,
                byEvent: Object.fromEntries(metrics.events.byEvent)
            },
            api: {
                ...metrics.api,
                byRoute: Object.fromEntries(metrics.api.byRoute)
            },
            database: {
                ...metrics.database,
                byQuery: Object.fromEntries(metrics.database.byQuery)
            },
            tasks: {
                ...metrics.tasks,
                byTask: Object.fromEntries(metrics.tasks.byTask)
            },
            errors: {
                ...metrics.errors,
                byType: Object.fromEntries(metrics.errors.byType)
            },
            memory: metrics.memory
        };
    }
    
    getSystemReport() {
        const current = this.metrics.system.current;
        const samples = this.metrics.system.samples;
        
        // Calculate averages
        let avgMemory = 0;
        let peakMemory = 0;
        
        if (samples.length > 0) {
            const totalMemory = samples.reduce((sum, s) => sum + s.memory.heapUsed, 0);
            avgMemory = totalMemory / samples.length;
            peakMemory = Math.max(...samples.map(s => s.memory.heapUsed));
        }
        
        return {
            current,
            average: {
                memory: avgMemory
            },
            peak: {
                memory: peakMemory
            },
            samples: samples.slice(-60) // Last hour
        };
    }
    
    getSummary() {
        const moduleReports = {};
        
        for (const [moduleId] of this.metrics.modules.entries()) {
            moduleReports[moduleId] = this.getModuleReport(moduleId);
        }
        
        return {
            system: this.getSystemReport(),
            modules: moduleReports
        };
    }
    
    reset(moduleId = null) {
        if (moduleId) {
            this.metrics.modules.delete(moduleId);
        } else {
            this.metrics.modules.clear();
            this.metrics.system.samples = [];
        }
    }
}

module.exports = PerformanceMonitor;
```

## Module Structure

### Module Manifest (module.json)

Every module must include a `module.json` file:

```json
{
  "name": "economy",
  "version": "1.0.0",
  "description": "Virtual economy system with balance tracking and transactions",
  "author": "dazza",
  "enabled": true,
  "rooms": [],  // Empty = all rooms, or ["fatpizza", "testroom"]
  "requires": ["core-database"],
  "provides": ["economy", "transactions"],
  "subscribes": [
    "user:join",
    "heist:payout",
    "fishing:catch",
    "gambling:win",
    "gambling:loss"
  ],
  "emits": [
    "economy:balance-changed",
    "economy:transaction",
    "economy:daily-bonus"
  ],
  "config": {
    "startingBalance": 100,
    "dailyBonus": 50,
    "maxBalance": 1000000,
    "transferFee": 0.02,
    "commands": {
      "balance": {
        "aliases": ["bal", "money", "$"],
        "cooldown": 3000
      },
      "transfer": {
        "aliases": ["send", "give"],
        "cooldown": 10000,
        "minAmount": 1,
        "maxAmount": 10000
      }
    }
  },
  "api": {
    "routes": true,
    "rateLimit": {
      "windowMs": 60000,
      "max": 100
    }
  },
  "database": {
    "tables": ["user_economy", "transactions"],
    "migrations": true
  }
}
```

### Module Entry Point (index.js)

```javascript
// modules/economy/index.js
const BaseModule = require('../../core/BaseModule');
const TransactionManager = require('./services/TransactionManager');
const EconomyAPI = require('./api/routes');

class EconomyModule extends BaseModule {
    async init() {
        // Initialize services
        this.transactionManager = new TransactionManager(this.db);
        
        // Load state
        await this.loadState();
        
        // Subscribe to events
        this.subscribe('user:join', this.handleUserJoin.bind(this));
        this.subscribe('heist:payout', this.handleHeistPayout.bind(this));
        this.subscribe('fishing:catch', this.handleFishingCatch.bind(this));
        this.subscribe('gambling:win', this.handleGamblingWin.bind(this));
        this.subscribe('gambling:loss', this.handleGamblingLoss.bind(this));
        
        // Register API routes
        this.registerApiRoutes(EconomyAPI.getRoutes(this));
        
        // Schedule daily bonus
        this.scheduleTask('daily-bonus', '0 0 * * *', this.processDailyBonus.bind(this));
        
        // Register commands
        await this.registerCommands();
        
        this.logger.info('Economy module initialized');
    }
    
    async start() {
        // Perform startup tasks
        await this.validateDatabase();
        
        // Start monitoring
        this.startBalanceMonitoring();
        
        this.logger.info('Economy module started');
    }
    
    async stop() {
        // Stop monitoring
        this.stopBalanceMonitoring();
        
        // Save state
        await this.saveState('lastStop', Date.now());
        
        this.logger.info('Economy module stopped');
    }
    
    // ===== Event Handlers =====
    
    async handleUserJoin({ username, room }) {
        // Check if user exists in economy
        const exists = await this.userExists(username);
        
        if (!exists) {
            // Create new user with starting balance
            await this.createUser(username, this.config.startingBalance);
            
            this.sendMessage(room, `Welcome ${username}! You've been given $${this.config.startingBalance} to get started!`);
            
            this.emit('economy:new-user', {
                username,
                balance: this.config.startingBalance,
                room
            });
        }
    }
    
    async handleHeistPayout({ username, amount, room }) {
        const result = await this.transactionManager.credit(username, amount, 'heist_payout');
        
        if (result.success) {
            this.emit('economy:balance-changed', {
                username,
                oldBalance: result.oldBalance,
                newBalance: result.newBalance,
                change: amount,
                reason: 'heist_payout',
                room
            });
        }
    }
    
    // ===== Public API =====
    
    async getBalance(username) {
        const user = await this.dbGet(
            'SELECT balance FROM user_economy WHERE username = ?',
            [username.toLowerCase()]
        );
        
        return user?.balance || 0;
    }
    
    async transfer(fromUser, toUser, amount) {
        // Validate amount
        if (amount < this.config.commands.transfer.minAmount) {
            throw new Error(`Minimum transfer amount is $${this.config.commands.transfer.minAmount}`);
        }
        
        if (amount > this.config.commands.transfer.maxAmount) {
            throw new Error(`Maximum transfer amount is $${this.config.commands.transfer.maxAmount}`);
        }
        
        // Calculate fee
        const fee = Math.floor(amount * this.config.transferFee);
        const netAmount = amount - fee;
        
        // Perform transfer
        return await this.transactionManager.transfer(fromUser, toUser, amount, fee);
    }
    
    // ===== Command Registration =====
    
    async registerCommands() {
        // Commands are loaded by the command-handler module
        // But we can provide command metadata
        const commandHandler = this.getModule('command-handler');
        
        commandHandler.registerModuleCommands(this.id, {
            balance: {
                handler: this.cmdBalance.bind(this),
                ...this.config.commands.balance
            },
            transfer: {
                handler: this.cmdTransfer.bind(this),
                ...this.config.commands.transfer
            }
        });
    }
    
    async cmdBalance(context) {
        const { username, room, args } = context;
        const target = args[0] || username;
        
        const balance = await this.getBalance(target);
        
        if (target === username) {
            this.sendMessage(room, `${username}, your balance is: $${balance}`);
        } else {
            this.sendMessage(room, `${target}'s balance is: $${balance}`);
        }
    }
    
    async cmdTransfer(context) {
        const { username, room, args } = context;
        
        if (args.length < 2) {
            this.sendMessage(room, `Usage: !transfer <user> <amount>`);
            return;
        }
        
        const [toUser, amountStr] = args;
        const amount = parseInt(amountStr);
        
        if (isNaN(amount) || amount <= 0) {
            this.sendMessage(room, `Invalid amount: ${amountStr}`);
            return;
        }
        
        try {
            const result = await this.transfer(username, toUser, amount);
            
            this.sendMessage(room, 
                `${username} sent $${amount} to ${toUser} ` +
                `(fee: $${result.fee}, received: $${result.netAmount})`
            );
            
        } catch (error) {
            this.sendMessage(room, `Transfer failed: ${error.message}`);
        }
    }
    
    // ===== Database Helpers =====
    
    async userExists(username) {
        const user = await this.dbGet(
            'SELECT 1 FROM user_economy WHERE username = ?',
            [username.toLowerCase()]
        );
        
        return !!user;
    }
    
    async createUser(username, balance = 0) {
        await this.dbRun(
            'INSERT INTO user_economy (username, balance, created_at) VALUES (?, ?, ?)',
            [username.toLowerCase(), balance, Date.now()]
        );
    }
    
    // ===== Scheduled Tasks =====
    
    async processDailyBonus() {
        // Get all active users from last 24 hours
        const activeUsers = await this.dbAll(`
            SELECT DISTINCT username 
            FROM messages 
            WHERE timestamp > ?
        `, [Date.now() - 86400000]);
        
        let bonusCount = 0;
        
        for (const user of activeUsers) {
            const result = await this.transactionManager.credit(
                user.username,
                this.config.dailyBonus,
                'daily_bonus'
            );
            
            if (result.success) {
                bonusCount++;
                
                this.emit('economy:daily-bonus', {
                    username: user.username,
                    amount: this.config.dailyBonus,
                    newBalance: result.newBalance
                });
            }
        }
        
        this.logger.info(`Processed daily bonus for ${bonusCount} users`);
        
        return bonusCount;
    }
    
    // ===== Balance Monitoring =====
    
    startBalanceMonitoring() {
        this.scheduleInterval('balance-check', 300000, async () => {
            // Check for suspicious balances
            const suspicious = await this.dbAll(`
                SELECT username, balance 
                FROM user_economy 
                WHERE balance > ? OR balance < 0
            `, [this.config.maxBalance]);
            
            for (const user of suspicious) {
                this.logger.warn(`Suspicious balance detected`, {
                    username: user.username,
                    balance: user.balance
                });
                
                this.emit('economy:suspicious-balance', user);
            }
        });
    }
    
    stopBalanceMonitoring() {
        // Handled by scheduler when module stops
    }
    
    // ===== Database Validation =====
    
    async validateDatabase() {
        // Ensure tables exist
        await this.dbRun(`
            CREATE TABLE IF NOT EXISTS user_economy (
                username TEXT PRIMARY KEY,
                balance INTEGER DEFAULT 0,
                created_at INTEGER,
                updated_at INTEGER
            )
        `);
        
        await this.dbRun(`
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_user TEXT,
                to_user TEXT,
                amount INTEGER,
                fee INTEGER DEFAULT 0,
                type TEXT,
                timestamp INTEGER,
                metadata TEXT
            )
        `);
        
        // Create indexes
        await this.dbRun(`
            CREATE INDEX IF NOT EXISTS idx_transactions_from 
            ON transactions(from_user)
        `);
        
        await this.dbRun(`
            CREATE INDEX IF NOT EXISTS idx_transactions_to 
            ON transactions(to_user)
        `);
    }
}

module.exports = EconomyModule;
```

## Module Types

### 1. Core Modules

Required modules that provide essential functionality:

#### core-database
- Provides database connection and query methods
- Manages connection pooling and transactions
- Handles migrations and schema management

#### core-api
- HTTP/WebSocket server for external access
- Route registration and middleware
- Static file serving

#### core-connection
- CyTube connection management
- Room context handling
- Message sending/receiving

### 2. Feature Modules

Optional modules that add bot functionality:

#### command-handler
- Command parsing and execution
- Hot-reloading support
- Permission checking
- Cooldown management

#### economy
- Virtual currency system
- Transaction management
- Balance tracking

#### greeting
- User join/leave messages
- Customizable greetings
- Cooldown management

#### heist
- Multiplayer heist game
- Scheduled game starts
- Payout calculation

### 3. Service Modules

Background services and utilities:

#### stats-collector
- Message statistics
- User activity tracking
- Channel analytics

#### image-health-checker
- Validates user gallery images
- Removes dead links
- Scheduled health checks

#### media-tracker
- Tracks played media
- Maintains history
- Provides statistics

## Command System

### Command Structure

Commands can be defined at multiple levels:

1. **Global Commands** - In `command-handler/commands/`
2. **Module Commands** - In `<module>/commands/`
3. **Dynamic Commands** - Registered programmatically

### Command File Format

```javascript
// modules/economy/commands/balance.js
module.exports = {
    name: 'balance',
    aliases: ['bal', 'money', '$'],
    description: 'Check your balance',
    usage: '!balance [username]',
    cooldown: 3000,
    permissions: [],
    
    async execute(context) {
        const { bot, message, args, module } = context;
        const { username, room } = message;
        
        const target = args[0] || username;
        const balance = await module.getBalance(target);
        
        bot.sendMessage(room, `${target}'s balance: $${balance}`);
    }
};
```

### Hot-Reloading Commands

The command-handler module monitors the filesystem:

```javascript
// modules/command-handler/services/HotReloader.js
class HotReloader {
    constructor(commandHandler) {
        this.commandHandler = commandHandler;
        this.watchers = new Map();
    }
    
    watchModule(moduleId, commandsPath) {
        const watcher = chokidar.watch(commandsPath, {
            persistent: true,
            ignoreInitial: true
        });
        
        watcher.on('change', (filePath) => {
            this.reloadCommand(moduleId, filePath);
        });
        
        watcher.on('add', (filePath) => {
            this.loadCommand(moduleId, filePath);
        });
        
        watcher.on('unlink', (filePath) => {
            this.unloadCommand(moduleId, filePath);
        });
        
        this.watchers.set(moduleId, watcher);
    }
    
    async reloadCommand(moduleId, filePath) {
        // Clear require cache
        delete require.cache[require.resolve(filePath)];
        
        try {
            // Load new version
            const command = require(filePath);
            
            // Update command registry
            this.commandHandler.updateCommand(moduleId, command);
            
            // Notify
            this.commandHandler.emit('command:reloaded', {
                module: moduleId,
                command: command.name,
                file: filePath
            });
            
        } catch (error) {
            this.commandHandler.emit('command:reload-error', {
                module: moduleId,
                file: filePath,
                error: error.message
            });
        }
    }
}
```

## Configuration Management

### Configuration Hierarchy

1. **Module Defaults** - In `module.json`
2. **Global Config** - In `config/config.yaml`
3. **Environment Variables** - `MODULE_<NAME>_<KEY>`
4. **Runtime Updates** - Via API or commands

### Global Configuration

```yaml
# config/config.yaml
app:
  name: "Dazza Bot"
  environment: "production"
  
modules:
  economy:
    enabled: true
    startingBalance: 150
    dailyBonus: 75
    
  heist:
    enabled: true
    rooms: ["fatpizza"]
    minPlayers: 2
    maxPlayers: 10
    
  greeting:
    enabled: false  # Disabled globally

database:
  path: "./data/cytube_stats.db"
  
api:
  port: 3001
  cors:
    origin: "*"
    
logging:
  level: "info"
  file: "./logs/bot.log"
```

### Environment Variables

```bash
# Override module config
MODULE_ECONOMY_ENABLED=true
MODULE_ECONOMY_STARTINGBALANCE=200

# Override specific settings
MODULE_HEIST_ROOMS=["room1","room2"]
```

## Error Handling

### Module Error Recovery

```javascript
// core/ErrorHandler.js
class ErrorHandler {
    constructor(moduleRegistry, eventBus) {
        this.moduleRegistry = moduleRegistry;
        this.eventBus = eventBus;
        this.errorCounts = new Map();
        this.restartAttempts = new Map();
    }
    
    async handleModuleError(moduleId, error) {
        // Track error count
        const count = (this.errorCounts.get(moduleId) || 0) + 1;
        this.errorCounts.set(moduleId, count);
        
        // Log error
        console.error(`Module ${moduleId} error:`, error);
        
        // Determine action based on error type and count
        if (this.isRecoverable(error) && count < 5) {
            await this.recoverModule(moduleId);
        } else if (count >= 5) {
            await this.disableModule(moduleId);
        }
    }
    
    async recoverModule(moduleId) {
        const attempts = (this.restartAttempts.get(moduleId) || 0) + 1;
        this.restartAttempts.set(moduleId, attempts);
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempts - 1), 30000);
        
        setTimeout(async () => {
            try {
                // Stop module
                await this.moduleRegistry.stopModule(moduleId);
                
                // Restart module
                await this.moduleRegistry.startModule(moduleId);
                
                // Reset error count on success
                this.errorCounts.delete(moduleId);
                this.restartAttempts.delete(moduleId);
                
                this.eventBus.emit('module:recovered', { moduleId });
                
            } catch (error) {
                // Recovery failed
                await this.handleModuleError(moduleId, error);
            }
        }, delay);
    }
    
    async disableModule(moduleId) {
        try {
            await this.moduleRegistry.stopModule(moduleId);
            
            this.eventBus.emit('module:disabled', {
                moduleId,
                reason: 'too_many_errors',
                errorCount: this.errorCounts.get(moduleId)
            });
            
        } catch (error) {
            console.error(`Failed to disable module ${moduleId}:`, error);
        }
    }
    
    isRecoverable(error) {
        const recoverableTypes = [
            'SQLITE_BUSY',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'ENOTFOUND'
        ];
        
        return recoverableTypes.some(type => 
            error.code === type || error.message?.includes(type)
        );
    }
}
```

## API Integration

### Module API Routes

Modules can expose API endpoints:

```javascript
// modules/gallery/api/routes.js
module.exports = {
    getRoutes(module) {
        return {
            'GET /gallery/:username': async (req, res) => {
                const { username } = req.params;
                const images = await module.getUserGallery(username);
                
                res.json({
                    success: true,
                    username,
                    images,
                    count: images.length
                });
            },
            
            'POST /gallery/:username/images': async (req, res) => {
                const { username } = req.params;
                const { url } = req.body;
                
                if (!url) {
                    return res.status(400).json({
                        success: false,
                        error: 'URL required'
                    });
                }
                
                const result = await module.addImage(username, url);
                
                res.json(result);
            },
            
            'DELETE /gallery/:username/images/:id': async (req, res) => {
                const { username, id } = req.params;
                
                const result = await module.removeImage(username, id);
                
                res.json(result);
            }
        };
    }
};
```

### Static Asset Serving

```javascript
// modules/help/index.js
class HelpModule extends BaseModule {
    async init() {
        // Register static assets
        this.registerStaticAssets({
            '/help': path.join(__dirname, 'static/index.html'),
            '/help/': path.join(__dirname, 'static/'),
            '/help/assets': path.join(__dirname, 'static/assets')
        });
    }
}
```

## Performance Monitoring

### Module Metrics

Each module's performance is tracked:

```javascript
// Automatic tracking in BaseModule
this.subscribe('chat:message', async (data) => {
    const start = process.hrtime.bigint();
    
    try {
        await this.handleMessage(data);
    } finally {
        const duration = Number(process.hrtime.bigint() - start) / 1e6;
        this.performanceMonitor.recordEvent(this.id, 'chat:message', duration);
    }
});
```

### Performance Reports

```javascript
// Get module performance
const report = performanceMonitor.getModuleReport('economy');
console.log(report);
// {
//   events: {
//     count: 1523,
//     avgDuration: 2.3,
//     maxDuration: 145.2,
//     byEvent: {
//       'user:join': { count: 45, avgDuration: 5.2 },
//       'heist:payout': { count: 23, avgDuration: 12.3 }
//     }
//   },
//   memory: {
//     current: 15728640,
//     peak: 25165824
//   }
// }
```

## Migration Guide

### Step 1: Prepare Environment

```bash
# Create new directory structure
mkdir -p src/core
mkdir -p src/modules
mkdir -p data/module-state
mkdir -p config/modules

# Install dependencies
npm install node-cron chokidar js-yaml
```

### Step 2: Implement Core Components

1. Copy all core component files from this document
2. Create `src/core/index.js` to export all components
3. Update `package.json` main entry point

### Step 3: Convert Existing Modules

#### Example: Converting Greeting System

**Before:**
```javascript
// In bot.js (mixed with other code)
handleUserJoin(user) {
    if (Date.now() - this.lastGreetingTime < this.greetingCooldown) {
        return;
    }
    
    const greeting = this.personality.getGreeting(user);
    this.sendMessage(greeting);
    this.lastGreetingTime = Date.now();
}
```

**After:**
```javascript
// modules/greeting/index.js
class GreetingModule extends BaseModule {
    async init() {
        this.lastGreetingTime = 0;
        this.cooldown = this.config.cooldown || 300000;
        
        this.subscribe('user:join', this.handleUserJoin.bind(this));
    }
    
    async handleUserJoin({ username, room }) {
        if (Date.now() - this.lastGreetingTime < this.cooldown) {
            return;
        }
        
        const greeting = this.getGreeting(username);
        this.sendMessage(room, greeting);
        this.lastGreetingTime = Date.now();
    }
}
```

### Step 4: Update Main Entry Point

```javascript
// index.js
const { 
    ModuleLoader,
    ModuleRegistry,
    EventBus,
    UnifiedScheduler,
    PerformanceMonitor,
    ConfigManager
} = require('./src/core');

async function main() {
    // Initialize core components
    const eventBus = new EventBus();
    const config = await ConfigManager.load();
    const db = await Database.connect(config.database);
    const scheduler = new UnifiedScheduler();
    const performanceMonitor = new PerformanceMonitor();
    const moduleRegistry = new ModuleRegistry();
    
    // Create context
    const context = {
        eventBus,
        config,
        db,
        scheduler,
        performanceMonitor,
        moduleRegistry,
        logger: createLogger(config.logging),
        roomConnections: new Map()
    };
    
    // Load modules
    const moduleLoader = new ModuleLoader(context);
    const modules = await moduleLoader.discoverModules();
    
    // Load and register each module
    for (const moduleInfo of modules) {
        try {
            const instance = await moduleLoader.loadModule(moduleInfo);
            if (instance) {
                moduleRegistry.register(
                    moduleInfo.name,
                    instance,
                    moduleInfo.manifest
                );
            }
        } catch (error) {
            console.error(`Failed to load module ${moduleInfo.name}:`, error);
        }
    }
    
    // Initialize and start modules
    await moduleRegistry.initializeModules();
    await moduleRegistry.startModules();
    
    // Set up shutdown handlers
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
    async function shutdown() {
        console.log('Shutting down...');
        await moduleRegistry.stopModules();
        await db.close();
        process.exit(0);
    }
}

main().catch(console.error);
```

### Step 5: Test Individual Modules

```javascript
// test/modules/economy.test.js
const EconomyModule = require('../../src/modules/economy');
const { EventBus } = require('../../src/core');

describe('EconomyModule', () => {
    let module;
    let eventBus;
    let mockDb;
    
    beforeEach(() => {
        eventBus = new EventBus();
        mockDb = createMockDb();
        
        const context = {
            manifest: { name: 'economy', config: {} },
            eventBus,
            db: mockDb,
            logger: createMockLogger()
        };
        
        module = new EconomyModule(context);
    });
    
    test('should create new user on join', async () => {
        await module.init();
        
        eventBus.emit('user:join', {
            username: 'testuser',
            room: 'testroom'
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        expect(mockDb.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO user_economy'),
            expect.arrayContaining(['testuser', 100])
        );
    });
});
```

## Benefits Summary

1. **Maintainability**
   - No file exceeds 500 lines
   - Clear separation of concerns
   - Self-contained modules

2. **Flexibility**
   - Enable/disable features easily
   - Room-specific module behavior
   - Hot-reload commands

3. **Performance**
   - Load only needed modules
   - Built-in performance tracking
   - Resource monitoring

4. **Development**
   - Parallel development possible
   - Easy testing of modules
   - Clear module interfaces

5. **Operations**
   - Graceful error recovery
   - Module health monitoring
   - Zero-downtime updates

This modular architecture transforms the codebase into a maintainable, scalable system while preserving all existing functionality.