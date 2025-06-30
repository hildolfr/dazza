import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import cors from 'cors';
import { EventEmitter } from 'events';
import { createCorsMiddleware } from './middleware/cors.js';
import { createErrorHandler } from './middleware/errorHandler.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import { createHealthRoutes } from './routes/health.js';
import { createGalleryRoutes } from './routes/gallery.js';
import { createStatsRoutes } from './routes/stats.js';
import { setupWebSocketEvents } from './websocket/events.js';
import { UpnpManager } from '../services/upnpManager.js';

export class ApiServer extends EventEmitter {
    constructor(bot, port = 3001) {
        super();
        this.bot = bot;
        this.port = port;
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new SocketIOServer(this.server, {
            cors: {
                origin: this.getAllowedOrigins(),
                methods: ["GET", "POST", "PUT", "DELETE"],
                credentials: true
            }
        });
        
        this.endpoints = new Set();
        this.upnpManager = null;
        this.upnpEnabled = process.env.ENABLE_UPNP !== 'false'; // Default to true
    }

    getAllowedOrigins() {
        const origins = [];
        
        // Always allow GitHub Pages
        origins.push('https://hildolfr.github.io');
        
        // Allow localhost in development
        if (process.env.NODE_ENV !== 'production') {
            origins.push(/^http:\/\/localhost(:\d+)?$/);
        }
        
        // Add any custom origins from environment
        if (process.env.API_CORS_ORIGINS) {
            const customOrigins = process.env.API_CORS_ORIGINS.split(',').map(o => o.trim());
            origins.push(...customOrigins);
        }
        
        return origins;
    }

    async start() {
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        
        return new Promise((resolve, reject) => {
            this.server.listen(this.port, async () => {
                this.bot.logger.info(`API server started on port ${this.port}`);
                console.log(`[API] Server listening on http://localhost:${this.port}`);
                console.log(`[API] Endpoints registered: ${this.endpoints.size}`);
                console.log(`[API] CORS origins:`, this.getAllowedOrigins());
                
                // Try to setup UPnP port forwarding
                if (this.upnpEnabled) {
                    try {
                        this.upnpManager = new UpnpManager(this.bot.logger);
                        const result = await this.upnpManager.setupApiPort(this.port);
                        console.log(`[API] UPnP port forwarding enabled: ${result.external}`);
                    } catch (error) {
                        console.warn('[API] UPnP port forwarding failed:', error.message);
                        console.log('[API] You may need to manually configure port forwarding in your router');
                    }
                } else {
                    console.log('[API] UPnP disabled (set ENABLE_UPNP=true to enable)');
                }
                
                resolve();
            }).on('error', (err) => {
                this.bot.logger.error('API server failed to start', err);
                console.error('[API] Failed to start server:', err.message);
                reject(err);
            });
        });
    }

    async stop() {
        // Cleanup intervals
        if (this.rateLimiterCleanup) {
            this.rateLimiterCleanup();
        }
        if (this.websocketCleanup) {
            this.websocketCleanup();
        }
        
        // Cleanup UPnP port mappings
        if (this.upnpManager) {
            try {
                await this.upnpManager.cleanup();
                console.log('[API] UPnP port mappings cleaned up');
            } catch (error) {
                console.warn('[API] Failed to cleanup UPnP:', error.message);
            }
        }
        
        return new Promise((resolve) => {
            // Set a timeout to force shutdown after 5 seconds
            const forceShutdownTimer = setTimeout(() => {
                this.bot.logger.warn('API server force shutdown after timeout');
                console.log('[API] Force shutdown after timeout');
                resolve();
            }, 5000);
            
            // Disconnect all WebSocket clients first
            this.io.disconnectSockets(true);
            
            // Close WebSocket server
            this.io.close(() => {
                // Close HTTP server
                this.server.close(() => {
                    clearTimeout(forceShutdownTimer);
                    this.bot.logger.info('API server stopped');
                    console.log('[API] Server stopped');
                    resolve();
                });
            });
        });
    }

    setupMiddleware() {
        // Body parsing
        this.app.use(express.json({ limit: '1mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));
        
        // Request logging
        this.app.use((req, res, next) => {
            const start = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - start;
                this.bot.logger.debug(`[API] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
            });
            next();
        });
        
        // CORS setup
        const corsOptions = createCorsMiddleware(this);
        this.app.use(cors(corsOptions));
        
        // Rate limiting
        this.app.use(createRateLimiter(this));
    }

    setupRoutes() {
        // API version prefix
        const router = express.Router();
        
        // Mount route modules
        router.use('/', createHealthRoutes(this));
        router.use('/gallery', createGalleryRoutes(this));
        router.use('/stats', createStatsRoutes(this));
        
        // Mount versioned API
        this.app.use('/api/v1', router);
        
        // Root redirect
        this.app.get('/', (req, res) => {
            res.json({
                name: 'Dazza Bot API',
                version: '1.0.0',
                docs: '/api/v1/health'
            });
        });
        
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                error: true,
                message: 'Endpoint not found',
                code: 'NOT_FOUND'
            });
        });
        
        // Error handler (must be last)
        this.app.use(createErrorHandler(this));
    }

    setupWebSocket() {
        // Set up WebSocket event handlers
        const wsHandlers = setupWebSocketEvents(this);
        
        // Store reference for status checks
        this.wsHandlers = wsHandlers;
    }

    // Helper method to register endpoints for tracking
    registerEndpoint(method, path) {
        this.endpoints.add(`${method.toUpperCase()} ${path}`);
    }

    // Helper method to emit events to all connected clients
    broadcast(event, data) {
        // Use EventEmitter to trigger internal event
        this.emit(event, data);
        
        // Also broadcast via Socket.IO
        this.io.emit(event, {
            ...data,
            timestamp: Date.now()
        });
        this.bot.logger.debug(`[API] Broadcast event: ${event}`, data);
    }
}