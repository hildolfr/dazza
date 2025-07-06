import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';

export function createHealthRoutes(apiServer) {
    const router = Router();
    const startTime = Date.now();
    
    // GET /api/v1/health - Basic health check
    router.get('/health', asyncHandler(async (req, res) => {
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        
        // Get bot status
        const botConnected = apiServer.bot.connection?.connected || false;
        const databaseConnected = apiServer.bot.db ? true : false;
        
        // Get WebSocket client count
        const wsClients = apiServer.io.engine.clientsCount || 0;
        
        // Get health monitor status if available
        let healthStatus = 'ok';
        let healthScore = 1.0;
        let healthDetails = null;
        
        if (apiServer.bot.healthMonitor) {
            try {
                const systemHealth = apiServer.bot.healthMonitor.getSystemHealth();
                healthStatus = systemHealth.status;
                healthScore = systemHealth.score;
                healthDetails = {
                    components: systemHealth.componentsChecked || 0,
                    emergency: systemHealth.emergency?.isActive || false,
                    lastCheck: systemHealth.monitoring?.lastCheck
                };
            } catch (error) {
                console.warn('Error getting health monitor status:', error.message);
            }
        }
        
        res.json({
            success: true,
            data: {
                status: healthStatus,
                score: healthScore,
                uptime,
                version: '1.0.0',
                endpoints: apiServer.endpoints.size,
                connections: {
                    bot: botConnected,
                    database: databaseConnected,
                    websocket: wsClients
                },
                health: healthDetails,
                timestamp: new Date().toISOString()
            }
        });
    }));
    
    // GET /api/v1/health/detailed - Detailed health information
    router.get('/health/detailed', asyncHandler(async (req, res) => {
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        
        // Memory usage
        const memUsage = process.memoryUsage();
        const formatBytes = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB';
        
        // Get database stats
        let dbStats = null;
        if (apiServer.bot.db) {
            try {
                const result = await apiServer.bot.db.get(`
                    SELECT 
                        (SELECT COUNT(*) FROM messages) as messageCount,
                        (SELECT COUNT(*) FROM user_stats) as userCount,
                        (SELECT COUNT(*) FROM user_images WHERE is_active = 1) as activeImages
                `);
                dbStats = result;
            } catch (err) {
                dbStats = { error: err.message };
            }
        }
        
        res.json({
            success: true,
            data: {
                status: 'ok',
                uptime,
                version: '1.0.0',
                environment: process.env.NODE_ENV || 'development',
                memory: {
                    rss: formatBytes(memUsage.rss),
                    heapTotal: formatBytes(memUsage.heapTotal),
                    heapUsed: formatBytes(memUsage.heapUsed),
                    external: formatBytes(memUsage.external)
                },
                endpoints: Array.from(apiServer.endpoints).sort(),
                database: dbStats,
                bot: {
                    connected: apiServer.bot.connection?.connected || false,
                    channel: apiServer.bot.connection?.channel || null,
                    username: apiServer.bot.connection?.username || null
                },
                websocket: {
                    clients: apiServer.io.engine.clientsCount || 0
                },
                timestamp: new Date().toISOString()
            }
        });
    }));
    
    // GET /api/v1/health/endpoints - List all available endpoints
    router.get('/health/endpoints', (req, res) => {
        const endpoints = Array.from(apiServer.endpoints).sort().map(endpoint => {
            const [method, path] = endpoint.split(' ');
            return { method, path };
        });
        
        res.json({
            success: true,
            data: {
                count: endpoints.length,
                endpoints
            }
        });
    });
    
    // GET /api/v1/health/upnp - UPnP status
    router.get('/health/upnp', asyncHandler(async (req, res) => {
        if (!apiServer.upnpManager) {
            res.json({
                success: true,
                data: {
                    enabled: false,
                    message: 'UPnP is disabled. Set ENABLE_UPNP=true to enable.'
                }
            });
            return;
        }
        
        let status;
        
        // Check if it's a DoubleNatUpnpManager
        if (apiServer.upnpManager.getStatus && apiServer.upnpManager.getStatus.constructor.name === 'AsyncFunction') {
            // Double NAT manager has async getStatus
            status = await apiServer.upnpManager.getStatus();
        } else {
            // Regular manager has sync getStatus
            status = apiServer.upnpManager.getStatus();
        }
        
        res.json({
            success: true,
            data: {
                ...status,
                apiUrl: status.realExternalIp ? `http://${status.realExternalIp}:${apiServer.port}` : 
                        status.externalIp ? `http://${status.externalIp}:${apiServer.port}` : null
            }
        });
    }));
    
    // GET /api/v1/health/dashboard - Comprehensive health dashboard
    router.get('/health/dashboard', asyncHandler(async (req, res) => {
        if (!apiServer.bot.healthMonitor) {
            return res.status(503).json({
                success: false,
                error: 'Health monitoring not available'
            });
        }
        
        try {
            const dashboard = apiServer.bot.healthMonitor.getHealthDashboard();
            
            res.json({
                success: true,
                data: dashboard
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `Health dashboard error: ${error.message}`
            });
        }
    }));
    
    // GET /api/v1/health/components - Component health status
    router.get('/health/components', asyncHandler(async (req, res) => {
        if (!apiServer.bot.healthMonitor) {
            return res.status(503).json({
                success: false,
                error: 'Health monitoring not available'
            });
        }
        
        try {
            const componentId = req.query.component;
            const componentHealth = apiServer.bot.healthMonitor.getComponentHealth(componentId);
            
            res.json({
                success: true,
                data: componentHealth
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `Component health error: ${error.message}`
            });
        }
    }));
    
    // GET /api/v1/health/protection - Protection system status
    router.get('/health/protection', asyncHandler(async (req, res) => {
        if (!apiServer.bot.healthMonitor) {
            return res.status(503).json({
                success: false,
                error: 'Health monitoring not available'
            });
        }
        
        try {
            const protectionStatus = apiServer.bot.healthMonitor.getProtectionSystemStatus();
            
            res.json({
                success: true,
                data: protectionStatus
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `Protection system error: ${error.message}`
            });
        }
    }));
    
    // GET /api/v1/health/alerts - Health alerts
    router.get('/health/alerts', asyncHandler(async (req, res) => {
        if (!apiServer.bot.healthMonitor || !apiServer.bot.healthMonitor.healthReporter) {
            return res.status(503).json({
                success: false,
                error: 'Health monitoring not available'
            });
        }
        
        try {
            const limit = parseInt(req.query.limit) || 50;
            const active = req.query.active === 'true';
            
            let alerts;
            if (active) {
                alerts = apiServer.bot.healthMonitor.healthReporter.getActiveAlerts();
            } else {
                alerts = apiServer.bot.healthMonitor.healthReporter.getAlertHistory(limit);
            }
            
            res.json({
                success: true,
                data: {
                    alerts,
                    count: alerts.length,
                    active: active
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `Alerts error: ${error.message}`
            });
        }
    }));
    
    // GET /api/v1/health/trends - Health trend analysis
    router.get('/health/trends', asyncHandler(async (req, res) => {
        if (!apiServer.bot.healthMonitor || !apiServer.bot.healthMonitor.healthReporter) {
            return res.status(503).json({
                success: false,
                error: 'Health monitoring not available'
            });
        }
        
        try {
            const trends = apiServer.bot.healthMonitor.healthReporter.getTrendAnalysis();
            
            res.json({
                success: true,
                data: trends || { message: 'Trend analysis not available yet' }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `Trends error: ${error.message}`
            });
        }
    }));
    
    // GET /api/v1/health/predictions - Health predictions
    router.get('/health/predictions', asyncHandler(async (req, res) => {
        if (!apiServer.bot.healthMonitor || !apiServer.bot.healthMonitor.healthReporter) {
            return res.status(503).json({
                success: false,
                error: 'Health monitoring not available'
            });
        }
        
        try {
            const predictions = apiServer.bot.healthMonitor.healthReporter.getPredictions();
            
            res.json({
                success: true,
                data: predictions || { message: 'Predictions not available yet' }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `Predictions error: ${error.message}`
            });
        }
    }));
    
    // GET /api/v1/health/history - Health history
    router.get('/health/history', asyncHandler(async (req, res) => {
        if (!apiServer.bot.healthMonitor) {
            return res.status(503).json({
                success: false,
                error: 'Health monitoring not available'
            });
        }
        
        try {
            const limit = parseInt(req.query.limit) || 100;
            const history = apiServer.bot.healthMonitor.getHealthHistory(limit);
            
            res.json({
                success: true,
                data: {
                    history,
                    count: history.length,
                    limit
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `History error: ${error.message}`
            });
        }
    }));
    
    // GET /api/v1/health/metrics - Performance metrics
    router.get('/health/metrics', asyncHandler(async (req, res) => {
        if (!apiServer.bot.healthMonitor) {
            return res.status(503).json({
                success: false,
                error: 'Health monitoring not available'
            });
        }
        
        try {
            const dashboard = apiServer.bot.healthMonitor.getHealthDashboard();
            const metrics = dashboard.metrics || {};
            
            // Add system metrics
            const memoryUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            
            metrics.system = {
                memory: {
                    rss: memoryUsage.rss,
                    heapTotal: memoryUsage.heapTotal,
                    heapUsed: memoryUsage.heapUsed,
                    heapUsedPercent: memoryUsage.heapUsed / memoryUsage.heapTotal,
                    external: memoryUsage.external
                },
                cpu: {
                    user: cpuUsage.user,
                    system: cpuUsage.system
                },
                uptime: process.uptime(),
                timestamp: Date.now()
            };
            
            res.json({
                success: true,
                data: metrics
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `Metrics error: ${error.message}`
            });
        }
    }));
    
    // POST /api/v1/health/check - Force health check
    router.post('/health/check', asyncHandler(async (req, res) => {
        if (!apiServer.bot.healthMonitor) {
            return res.status(503).json({
                success: false,
                error: 'Health monitoring not available'
            });
        }
        
        try {
            await apiServer.bot.healthMonitor.forceHealthCheck();
            
            res.json({
                success: true,
                data: {
                    message: 'Health check initiated',
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `Health check error: ${error.message}`
            });
        }
    }));
    
    // POST /api/v1/health/report - Generate health report
    router.post('/health/report', asyncHandler(async (req, res) => {
        if (!apiServer.bot.healthMonitor) {
            return res.status(503).json({
                success: false,
                error: 'Health monitoring not available'
            });
        }
        
        try {
            const report = await apiServer.bot.healthMonitor.forceHealthReport();
            
            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `Report generation error: ${error.message}`
            });
        }
    }));
    
    // GET /api/v1/health/circuit-breakers - Circuit breaker status
    router.get('/health/circuit-breakers', asyncHandler(async (req, res) => {
        if (!apiServer.bot.healthMonitor || !apiServer.bot.healthMonitor.healthChecker) {
            return res.status(503).json({
                success: false,
                error: 'Health monitoring not available'
            });
        }
        
        try {
            const circuitBreakers = apiServer.bot.healthMonitor.healthChecker.getAllCircuitBreakers();
            
            res.json({
                success: true,
                data: circuitBreakers
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `Circuit breakers error: ${error.message}`
            });
        }
    }));
    
    // GET /api/v1/health/config - Health monitoring configuration
    router.get('/health/config', asyncHandler(async (req, res) => {
        if (!apiServer.bot.healthMonitor) {
            return res.status(503).json({
                success: false,
                error: 'Health monitoring not available'
            });
        }
        
        try {
            const config = apiServer.bot.healthMonitor.getHealthConfig();
            
            res.json({
                success: true,
                data: config
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `Config error: ${error.message}`
            });
        }
    }));
    
    // PUT /api/v1/health/config - Update health monitoring configuration
    router.put('/health/config', asyncHandler(async (req, res) => {
        if (!apiServer.bot.healthMonitor) {
            return res.status(503).json({
                success: false,
                error: 'Health monitoring not available'
            });
        }
        
        try {
            const newConfig = req.body;
            apiServer.bot.healthMonitor.updateHealthConfig(newConfig);
            
            res.json({
                success: true,
                data: {
                    message: 'Configuration updated',
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: `Config update error: ${error.message}`
            });
        }
    }));
    
    // Register endpoints
    apiServer.registerEndpoint('GET', '/api/v1/health');
    apiServer.registerEndpoint('GET', '/api/v1/health/detailed');
    apiServer.registerEndpoint('GET', '/api/v1/health/endpoints');
    apiServer.registerEndpoint('GET', '/api/v1/health/upnp');
    apiServer.registerEndpoint('GET', '/api/v1/health/dashboard');
    apiServer.registerEndpoint('GET', '/api/v1/health/components');
    apiServer.registerEndpoint('GET', '/api/v1/health/protection');
    apiServer.registerEndpoint('GET', '/api/v1/health/alerts');
    apiServer.registerEndpoint('GET', '/api/v1/health/trends');
    apiServer.registerEndpoint('GET', '/api/v1/health/predictions');
    apiServer.registerEndpoint('GET', '/api/v1/health/history');
    apiServer.registerEndpoint('GET', '/api/v1/health/metrics');
    apiServer.registerEndpoint('POST', '/api/v1/health/check');
    apiServer.registerEndpoint('POST', '/api/v1/health/report');
    apiServer.registerEndpoint('GET', '/api/v1/health/circuit-breakers');
    apiServer.registerEndpoint('GET', '/api/v1/health/config');
    apiServer.registerEndpoint('PUT', '/api/v1/health/config');
    
    return router;
}