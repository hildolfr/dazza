import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { EventEmitter } from 'events';
import { createCorsMiddleware } from './middleware/cors.js';
import { createErrorHandler } from './middleware/errorHandler.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import { createHealthRoutes } from './routes/health.js';
import { createGalleryRoutes } from './routes/gallery.js';
import { createStatsRoutes } from './routes/stats.js';
import { createChatRoutes } from './routes/chat.js';
import { setupWebSocketEvents } from './websocket/events.js';
import { UpnpManager } from '../services/upnpManager.js';
import { DoubleNatUpnpManager } from '../services/doubleNatUpnp.js';
import { EnhancedDoubleNatManager } from '../services/enhancedDoubleNat.js';

export class ApiServer extends EventEmitter {
    constructor(bot, port = 3001) {
        super();
        this.bot = bot;
        this.port = port;
        this.app = express();
        
        // Set up HTTPS server if certificates are available, otherwise fall back to HTTP
        this.setupServer();
        
        // Socket.IO will be set up after server is started
        this.io = null;
        
        this.endpoints = new Set();
        this.upnpManager = null;
        this.upnpEnabled = process.env.ENABLE_UPNP !== 'false'; // Default to true
    }

    setupServer() {
        try {
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            const sslPath = path.join(__dirname, '..', '..', 'ssl');
            
            // Check for SSL certificates
            const keyPath = path.join(sslPath, 'server.key');
            const certPath = path.join(sslPath, 'server.crt');
            
            if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
                const sslOptions = {
                    key: fs.readFileSync(keyPath),
                    cert: fs.readFileSync(certPath)
                };
                
                this.server = https.createServer(sslOptions, this.app);
                this.isHttps = true;
                this.bot.logger.debug('[API] HTTPS server configured with SSL certificates');
            } else {
                this.server = http.createServer(this.app);
                this.isHttps = false;
                this.bot.logger.debug('[API] SSL certificates not found. Using HTTP server.');
                this.bot.logger.debug('[API] To enable HTTPS, place server.key and server.crt in the ssl/ directory');
            }
        } catch (error) {
            // Fallback to HTTP on error
            this.server = http.createServer(this.app);
            this.isHttps = false;
            this.bot.logger.error('[API] Failed to setup HTTPS server, falling back to HTTP:', error);
        }
    }

    getAllowedOrigins() {
        const origins = [];
        
        // Always allow GitHub Pages
        origins.push('https://hildolfr.github.io');
        
        // Allow seg.tplinkdns.com (both HTTP and HTTPS)
        origins.push('https://seg.tplinkdns.com');
        origins.push('http://seg.tplinkdns.com');
        origins.push(/^https?:\/\/seg\.tplinkdns\.com(:\d+)?$/);
        
        // Allow localhost in development
        if (process.env.NODE_ENV !== 'production') {
            origins.push(/^http:\/\/localhost(:\d+)?$/);
            origins.push(/^https:\/\/localhost(:\d+)?$/);
        }
        
        // Allow file:// protocol for local HTML files
        origins.push(/^file:\/\//);
        
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
        
        return new Promise((resolve, reject) => {
            // Start the server (either HTTPS or HTTP)
            this.server.listen(this.port, async () => {
                const protocol = this.isHttps ? 'HTTPS' : 'HTTP';
                const url = this.isHttps ? `https://localhost:${this.port}` : `http://localhost:${this.port}`;
                
                this.bot.logger.info(`API ${protocol} server started on port ${this.port}`);
                this.bot.logger.debug(`[API] ${protocol} server listening on ${url}`);
                
                // Set up Socket.IO with the server
                this.io = new SocketIOServer(this.server, {
                    cors: {
                        origin: this.getAllowedOrigins(),
                        methods: ["GET", "POST", "PUT", "DELETE"],
                        credentials: true
                    }
                });
                
                // Set up WebSocket events after Socket.IO is initialized
                this.setupWebSocket();
                
                this.bot.logger.debug(`[API] Endpoints registered: ${this.endpoints.size}`);
                this.bot.logger.debug(`[API] CORS origins:`, this.getAllowedOrigins());
                
                // Try to setup UPnP port forwarding (with timeout)
                if (this.upnpEnabled) {
                    // Don't let UPnP setup block startup for more than 10 seconds
                    const upnpTimeout = new Promise((resolve) => {
                        setTimeout(() => {
                            this.bot.logger.debug('[API] UPnP setup timeout - continuing without port forwarding');
                            resolve(null);
                        }, 10000);
                    });
                    
                    const upnpSetup = (async () => {
                        try {
                            // Use enhanced double NAT manager
                            const enhancedManager = new EnhancedDoubleNatManager(this.bot.logger);
                            const status = await enhancedManager.getStatus();
                            
                            this.bot.logger.debug('[API] Network configuration detected:');
                            this.bot.logger.debug(`[API] Local IP: ${status.localIp}`);
                            this.bot.logger.debug(`[API] Real external IP: ${status.realExternalIp}`);
                            this.bot.logger.debug(`[API] NAT layers: ${status.layers.length}`);
                            
                            this.upnpManager = enhancedManager;
                            const result = await enhancedManager.setupCompletePortForwarding(this.port);
                            
                            if (result.success) {
                                this.bot.logger.info('[API] Port forwarding configured successfully');
                            } else {
                                this.bot.logger.warn('[API] Port forwarding partially configured');
                                result.layers.forEach(layer => {
                                    if (layer.success) {
                                        this.bot.logger.debug(`[API] ${layer.name}: ${layer.mapping}`);
                                    } else {
                                        this.bot.logger.debug(`[API] ${layer.name}: ${layer.error}`);
                                    }
                                });
                                
                                if (result.instructions.length > 0) {
                                    this.bot.logger.debug('[API] Manual configuration may be required');
                                    result.instructions.forEach(inst => this.bot.logger.debug(`[API]    ${inst}`));
                                }
                            }
                        } catch (error) {
                            this.bot.logger.warn('[API] UPnP port forwarding failed:', error.message);
                        }
                    })();
                    
                    // Wait for either UPnP setup or timeout
                    await Promise.race([upnpSetup, upnpTimeout]);
                } else {
                    this.bot.logger.debug('[API] UPnP disabled (set ENABLE_UPNP=true to enable)');
                }
                
                resolve();
            }).on('error', (err) => {
                this.bot.logger.error('API server failed to start', { error: err.message, stack: err.stack });
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
        
        // Cleanup UPnP port mappings (don't wait, just fire and forget)
        if (this.upnpManager) {
            this.upnpManager.cleanup().catch(error => {
                this.bot.logger.debug('[API] UPnP cleanup error (ignored):', error.message);
            });
        }
        
        return new Promise((resolve) => {
            // Set a timeout to force shutdown after 1 second
            const forceShutdownTimer = setTimeout(() => {
                this.bot.logger.debug('API server force shutdown after timeout');
                resolve();
            }, 1000);
            
            // Disconnect all WebSocket clients first
            this.io.disconnectSockets(true);
            
            // Close WebSocket server
            this.io.close(() => {
                // Close the server
                this.server.close(() => {
                    clearTimeout(forceShutdownTimer);
                    this.bot.logger.info('API server stopped');
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
        router.use('/chat', createChatRoutes(this));
        
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
        this.bot.logger.debug(`[API] Broadcast event: ${event}`, data);
    }
}