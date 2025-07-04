const BaseModule = require('../../core/BaseModule');
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs').promises;
const RouteManager = require('./services/RouteManager');

class CoreApiModule extends BaseModule {
    constructor(context) {
        super(context);
        
        this.app = null;
        this.server = null;
        this.routeManager = null;
        this.moduleRoutes = new Map();
        this.moduleStatics = new Map();
    }
    
    async init() {
        // Create Express app
        this.app = express();
        
        // Create HTTP server
        this.server = http.createServer(this.app);
        
        // Initialize route manager
        this.routeManager = new RouteManager(this);
        
        // Setup middleware
        await this._setupMiddleware();
        
        // Setup core routes
        await this._setupCoreRoutes();
        
        // Make API available to other modules
        this.modules.api = this;
        
        this.logger.info('API module initialized');
    }
    
    async start() {
        const { port, host } = this.config;
        
        // Setup error handling
        this._setupErrorHandling();
        
        // Start server
        await new Promise((resolve, reject) => {
            this.server.listen(port, host, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        this.logger.info(`API server listening on ${host}:${port}`);
        
        // Emit event
        this.emit('api:started', { port, host });
    }
    
    async stop() {
        if (this.server) {
            await new Promise((resolve) => {
                this.server.close(resolve);
            });
        }
        
        this.logger.info('API server stopped');
    }
    
    // ===== Middleware Setup =====
    
    async _setupMiddleware() {
        const { cors: corsConfig, bodyLimit, rateLimit: rateLimitConfig } = this.config;
        
        // Security headers
        this.app.use(helmet({
            contentSecurityPolicy: false, // Disable for API
            crossOriginEmbedderPolicy: false
        }));
        
        // CORS
        this.app.use(cors(corsConfig));
        
        // Compression
        this.app.use(compression());
        
        // Body parsing
        this.app.use(express.json({ limit: bodyLimit }));
        this.app.use(express.urlencoded({ extended: true, limit: bodyLimit }));
        
        // Rate limiting
        const limiter = rateLimit({
            windowMs: rateLimitConfig.windowMs,
            max: rateLimitConfig.max,
            message: 'Too many requests from this IP',
            standardHeaders: true,
            legacyHeaders: false
        });
        this.app.use('/api', limiter);
        
        // Request logging
        this.app.use((req, res, next) => {
            const start = Date.now();
            
            res.on('finish', () => {
                const duration = Date.now() - start;
                this.logger.debug('Request', {
                    method: req.method,
                    url: req.url,
                    status: res.statusCode,
                    duration
                });
                
                // Track performance
                this.performanceMonitor.recordApiCall(
                    'core-api',
                    `${req.method} ${req.path}`,
                    duration
                );
            });
            
            next();
        });
    }
    
    // ===== Core Routes =====
    
    async _setupCoreRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                uptime: process.uptime(),
                timestamp: Date.now()
            });
        });
        
        // Module status
        this.app.get('/api/modules', (req, res) => {
            const modules = Array.from(this.modules.moduleRegistry.modules.entries())
                .map(([id, module]) => ({
                    id,
                    version: module.version,
                    status: module._started ? 'running' : 'stopped',
                    type: module.manifest.type || 'feature',
                    required: module.manifest.required || false
                }));
            
            res.json({ modules });
        });
        
        // Module control
        this.app.post('/api/modules/:moduleId/:action', async (req, res) => {
            const { moduleId, action } = req.params;
            
            try {
                const registry = this.modules.moduleRegistry;
                
                switch (action) {
                    case 'start':
                        await registry.startModule(moduleId);
                        break;
                    case 'stop':
                        await registry.stopModule(moduleId);
                        break;
                    case 'restart':
                        await registry.restartModule(moduleId);
                        break;
                    default:
                        return res.status(400).json({
                            error: 'Invalid action'
                        });
                }
                
                res.json({
                    success: true,
                    module: moduleId,
                    action
                });
                
            } catch (error) {
                res.status(500).json({
                    error: error.message
                });
            }
        });
        
        // Performance metrics
        this.app.get('/api/metrics', (req, res) => {
            const { module } = req.query;
            
            if (module) {
                const report = this.performanceMonitor.getModuleReport(module);
                res.json(report);
            } else {
                const report = this.performanceMonitor.getFullReport();
                res.json(report);
            }
        });
        
        // Configuration
        this.app.get('/api/config/:moduleId?', (req, res) => {
            const { moduleId } = req.params;
            
            if (moduleId) {
                const module = this.modules.moduleRegistry.get(moduleId);
                if (!module) {
                    return res.status(404).json({
                        error: 'Module not found'
                    });
                }
                
                res.json({
                    module: moduleId,
                    config: module.config
                });
            } else {
                // Return global config (sanitized)
                const safeConfig = this._sanitizeConfig(this.modules.config);
                res.json(safeConfig);
            }
        });
        
        // Scheduled tasks
        this.app.get('/api/tasks', (req, res) => {
            const tasks = this.scheduler.getTasks();
            res.json({ tasks });
        });
        
        // Static file serving for core
        this.app.use('/static', express.static(
            path.join(__dirname, 'static'),
            { maxAge: this.config.staticCache }
        ));
    }
    
    // ===== Module Route Registration =====
    
    registerModuleRoutes(moduleId, routes) {
        const router = express.Router();
        
        // Add routes to router
        for (const [routePath, handler] of Object.entries(routes)) {
            const [method, path] = this._parseRoute(routePath);
            router[method](path, handler);
        }
        
        // Mount router
        this.app.use(`/api/${moduleId}`, router);
        
        // Store for tracking
        this.moduleRoutes.set(moduleId, routes);
        
        this.logger.debug(`Registered routes for module: ${moduleId}`, {
            routes: Object.keys(routes)
        });
    }
    
    unregisterModuleRoutes(moduleId) {
        // Note: Express doesn't support route removal
        // Would need to implement a more complex solution
        // For now, just track that routes are removed
        this.moduleRoutes.delete(moduleId);
    }
    
    // ===== Static Asset Registration =====
    
    registerModuleStatic(moduleId, assets) {
        for (const [route, fsPath] of Object.entries(assets)) {
            // Determine if path is directory or file
            fs.stat(fsPath).then(stats => {
                if (stats.isDirectory()) {
                    this.app.use(
                        `/static/${moduleId}${route}`,
                        express.static(fsPath, {
                            maxAge: this.config.staticCache
                        })
                    );
                } else {
                    this.app.get(`/static/${moduleId}${route}`, (req, res) => {
                        res.sendFile(fsPath);
                    });
                }
            }).catch(error => {
                this.logger.error(`Failed to register static asset: ${fsPath}`, error);
            });
        }
        
        this.moduleStatics.set(moduleId, assets);
        
        this.logger.debug(`Registered static assets for module: ${moduleId}`, {
            assets: Object.keys(assets)
        });
    }
    
    // ===== Helper Methods =====
    
    _parseRoute(routeString) {
        const parts = routeString.split(' ');
        if (parts.length === 2) {
            return [parts[0].toLowerCase(), parts[1]];
        }
        // Default to GET
        return ['get', routeString];
    }
    
    _sanitizeConfig(config) {
        // Remove sensitive information
        const sensitive = ['password', 'token', 'secret', 'key'];
        
        const sanitize = (obj) => {
            if (typeof obj !== 'object' || obj === null) {
                return obj;
            }
            
            const result = Array.isArray(obj) ? [] : {};
            
            for (const [key, value] of Object.entries(obj)) {
                if (sensitive.some(s => key.toLowerCase().includes(s))) {
                    result[key] = '[REDACTED]';
                } else if (typeof value === 'object') {
                    result[key] = sanitize(value);
                } else {
                    result[key] = value;
                }
            }
            
            return result;
        };
        
        return sanitize(config);
    }
    
    // ===== Error Handling =====
    
    _setupErrorHandling() {
        // 404 handler
        this.app.use((req, res, next) => {
            res.status(404).json({
                error: 'Not found',
                path: req.path
            });
        });
        
        // Error handler
        this.app.use((err, req, res, next) => {
            this.logger.error('Express error:', {
                error: err.message,
                stack: err.stack,
                url: req.url,
                method: req.method
            });
            
            res.status(err.status || 500).json({
                error: err.message || 'Internal server error'
            });
        });
    }
    
    // ===== Public API Methods =====
    
    getExpressApp() {
        return this.app;
    }
    
    getHttpServer() {
        return this.server;
    }
    
    getActiveRoutes() {
        const routes = [];
        
        // Core routes
        routes.push({
            module: 'core-api',
            routes: [
                'GET /health',
                'GET /api/modules',
                'POST /api/modules/:moduleId/:action',
                'GET /api/metrics',
                'GET /api/config/:moduleId?',
                'GET /api/tasks'
            ]
        });
        
        // Module routes
        for (const [moduleId, moduleRoutes] of this.moduleRoutes) {
            routes.push({
                module: moduleId,
                routes: Object.keys(moduleRoutes).map(r => `/api/${moduleId}${r}`)
            });
        }
        
        return routes;
    }
}

module.exports = CoreApiModule;