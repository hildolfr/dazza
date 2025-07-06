import { EventEmitter } from 'events';

/**
 * Health Checker - Individual component health checking with configurable thresholds
 * 
 * Provides:
 * 1. Component-specific health checks with custom logic
 * 2. Configurable health thresholds and scoring
 * 3. Circuit breaker patterns for failing components
 * 4. Dependency-aware health evaluation
 * 5. Performance-based health scoring
 * 6. Health status caching and optimization
 */
export class HealthChecker extends EventEmitter {
    constructor(services, config, logger) {
        super();
        this.services = services;
        this.config = config;
        this.logger = logger;
        
        // Health checking configuration
        this.checkerConfig = {
            // Default thresholds
            thresholds: {
                responseTime: {
                    excellent: 50,    // 50ms
                    good: 200,        // 200ms
                    warning: 1000,    // 1s
                    critical: 5000    // 5s
                },
                errorRate: {
                    excellent: 0,     // 0%
                    good: 0.001,      // 0.1%
                    warning: 0.01,    // 1%
                    critical: 0.05    // 5%
                },
                availability: {
                    excellent: 0.999, // 99.9%
                    good: 0.99,       // 99%
                    warning: 0.95,    // 95%
                    critical: 0.90    // 90%
                },
                resourceUsage: {
                    excellent: 0.5,   // 50%
                    good: 0.7,        // 70%
                    warning: 0.85,    // 85%
                    critical: 0.95    // 95%
                },
                ...config.thresholds
            },
            
            // Circuit breaker settings
            circuitBreaker: {
                failureThreshold: 3,        // Consecutive failures
                timeoutPeriod: 60000,       // 1 minute
                resetTimeout: 300000,       // 5 minutes
                halfOpenMax: 5,             // Max half-open attempts
                ...config.circuitBreaker
            },
            
            // Caching settings
            cache: {
                enabled: true,
                ttl: 30000,                 // 30 seconds
                maxSize: 1000,
                ...config.cache
            },
            
            // Performance monitoring
            performance: {
                trackResponseTimes: true,
                trackErrorRates: true,
                trackAvailability: true,
                historySize: 100,
                ...config.performance
            }
        };
        
        // Component registry
        this.components = new Map(); // componentId -> component config
        this.healthCache = new Map(); // componentId -> cached health result
        this.circuitBreakers = new Map(); // componentId -> circuit breaker state
        this.performanceMetrics = new Map(); // componentId -> performance data
        
        // Health check execution tracking
        this.activeChecks = new Set(); // Currently running health checks
        this.checkHistory = new Map(); // componentId -> check history
        
        // Custom health check functions
        this.customCheckers = new Map(); // type -> checker function
        
        // Initialize built-in checkers
        this.initializeBuiltInCheckers();
        
        // Cleanup interval for cache and metrics
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, 60000); // Every minute
    }
    
    /**
     * Initialize built-in health checker functions
     */
    initializeBuiltInCheckers() {
        // Database health checker
        this.customCheckers.set('database', this.checkDatabaseHealth.bind(this));
        
        // API service health checker
        this.customCheckers.set('api', this.checkApiServiceHealth.bind(this));
        
        // Module health checker
        this.customCheckers.set('module', this.checkModuleHealth.bind(this));
        
        // Protection system health checker
        this.customCheckers.set('protection', this.checkProtectionSystemHealth.bind(this));
        
        // Memory health checker
        this.customCheckers.set('memory', this.checkMemoryHealth.bind(this));
        
        // Network health checker
        this.customCheckers.set('network', this.checkNetworkHealth.bind(this));
        
        // File system health checker
        this.customCheckers.set('filesystem', this.checkFileSystemHealth.bind(this));
        
        // Process health checker
        this.customCheckers.set('process', this.checkProcessHealth.bind(this));
    }
    
    /**
     * Register a custom health checker function
     */
    registerChecker(type, checkerFunction) {
        this.customCheckers.set(type, checkerFunction);
        this.logger.debug(`Registered custom health checker: ${type}`);
    }
    
    /**
     * Check component health
     */
    async checkComponentHealth(componentId, component, config) {
        // Check if health check is already running
        if (this.activeChecks.has(componentId)) {
            this.logger.debug(`Health check already running for: ${componentId}`);
            return this.getFromCache(componentId) || this.createUnknownResult(componentId);
        }
        
        // Check circuit breaker
        const circuitBreaker = this.circuitBreakers.get(componentId);
        if (circuitBreaker && circuitBreaker.state === 'open') {
            return this.createCircuitOpenResult(componentId, circuitBreaker);
        }
        
        // Check cache
        if (this.checkerConfig.cache.enabled) {
            const cached = this.getFromCache(componentId);
            if (cached) {
                return cached;
            }
        }
        
        this.activeChecks.add(componentId);
        
        try {
            const startTime = Date.now();
            
            // Perform the actual health check
            const healthResult = await this.performHealthCheck(componentId, component, config);
            
            const duration = Date.now() - startTime;
            
            // Update performance metrics
            this.updatePerformanceMetrics(componentId, healthResult, duration);
            
            // Update circuit breaker state
            this.updateCircuitBreaker(componentId, healthResult);
            
            // Cache the result
            if (this.checkerConfig.cache.enabled) {
                this.cacheResult(componentId, healthResult);
            }
            
            // Store in history
            this.storeCheckHistory(componentId, healthResult, duration);
            
            // Emit events based on health status
            this.emitHealthEvents(componentId, healthResult);
            
            return healthResult;
            
        } catch (error) {
            this.logger.error(`Health check failed for ${componentId}`, {
                error: error.message,
                stack: error.stack
            });
            
            const errorResult = this.createErrorResult(componentId, error);
            
            // Update circuit breaker on error
            this.updateCircuitBreaker(componentId, errorResult);
            
            return errorResult;
            
        } finally {
            this.activeChecks.delete(componentId);
        }
    }
    
    /**
     * Perform the actual health check based on component type
     */
    async performHealthCheck(componentId, component, config) {
        const healthResult = {
            componentId,
            status: 'unknown',
            score: 0,
            details: {},
            metrics: {},
            timestamp: Date.now(),
            duration: 0,
            dependencies: []
        };
        
        try {
            // Use custom health check if provided
            if (config.healthCheck && typeof config.healthCheck === 'function') {
                const customResult = await config.healthCheck(component);
                return this.normalizeHealthResult(componentId, customResult);
            }
            
            // Use type-specific checker
            const checker = this.customCheckers.get(config.type);
            if (checker) {
                const result = await checker(componentId, component, config);
                return this.normalizeHealthResult(componentId, result);
            }
            
            // Default generic health check
            return await this.performGenericHealthCheck(componentId, component, config);
            
        } catch (error) {
            throw new Error(`Health check execution failed: ${error.message}`);
        }
    }
    
    /**
     * Perform generic health check for components without specific checkers
     */
    async performGenericHealthCheck(componentId, component, config) {
        const healthResult = {
            status: 'unknown',
            score: 0.5,
            details: { type: 'generic', hasComponent: !!component },
            metrics: {}
        };
        
        // Basic availability check
        if (component) {
            healthResult.status = 'healthy';
            healthResult.score = 0.8;
            healthResult.details.available = true;
            
            // Check if component has status methods
            if (typeof component.getStatus === 'function') {
                try {
                    const status = await component.getStatus();
                    healthResult.details.componentStatus = status;
                    
                    if (status && (status.healthy === false || status.status === 'failed')) {
                        healthResult.status = 'critical';
                        healthResult.score = 0.1;
                    }
                } catch (error) {
                    healthResult.details.statusError = error.message;
                }
            }
            
            // Check if component has health methods
            if (typeof component.checkHealth === 'function') {
                try {
                    const health = await component.checkHealth();
                    healthResult.details.componentHealth = health;
                    
                    if (health && health.healthy === false) {
                        healthResult.status = 'degraded';
                        healthResult.score = 0.4;
                    }
                } catch (error) {
                    healthResult.details.healthError = error.message;
                }
            }
        } else {
            healthResult.status = 'failed';
            healthResult.score = 0;
            healthResult.details.available = false;
        }
        
        return healthResult;
    }
    
    /**
     * Check database health
     */
    async checkDatabaseHealth(componentId, database, config) {
        const healthResult = {
            status: 'unknown',
            score: 0,
            details: {},
            metrics: {}
        };
        
        if (!database) {
            healthResult.status = 'failed';
            healthResult.details.error = 'Database instance not available';
            return healthResult;
        }
        
        try {
            const startTime = Date.now();
            
            // Test basic connectivity
            await new Promise((resolve, reject) => {
                database.get('SELECT 1 as test', (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            const responseTime = Date.now() - startTime;
            
            // Calculate health score based on response time
            healthResult.score = this.calculateResponseTimeScore(responseTime);
            healthResult.status = this.getStatusFromScore(healthResult.score);
            healthResult.details = {
                connection: 'ok',
                responseTime,
                testQuery: 'successful'
            };
            healthResult.metrics = {
                responseTime,
                available: true
            };
            
            // Test write capability if configured
            if (config.testWrite) {
                const writeStartTime = Date.now();
                await new Promise((resolve, reject) => {
                    database.run('CREATE TEMP TABLE IF NOT EXISTS health_test (id INTEGER)', (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                
                const writeTime = Date.now() - writeStartTime;
                healthResult.details.writeTest = 'successful';
                healthResult.details.writeTime = writeTime;
                healthResult.metrics.writeTime = writeTime;
            }
            
        } catch (error) {
            healthResult.status = 'failed';
            healthResult.score = 0;
            healthResult.details = {
                connection: 'failed',
                error: error.message
            };
            healthResult.metrics = {
                available: false,
                error: error.message
            };
        }
        
        return healthResult;
    }
    
    /**
     * Check API service health
     */
    async checkApiServiceHealth(componentId, apiService, config) {
        const healthResult = {
            status: 'unknown',
            score: 0,
            details: {},
            metrics: {}
        };
        
        if (!apiService) {
            healthResult.status = 'failed';
            healthResult.details.error = 'API service not available';
            return healthResult;
        }
        
        try {
            const startTime = Date.now();
            
            // Check if service is listening
            if (apiService.server && apiService.server.listening) {
                healthResult.details.listening = true;
                healthResult.details.port = apiService.port;
            } else {
                healthResult.status = 'failed';
                healthResult.score = 0;
                healthResult.details.listening = false;
                return healthResult;
            }
            
            // Check endpoint count if available
            if (apiService.endpoints) {
                healthResult.details.endpoints = apiService.endpoints.size || apiService.endpoints.length;
            }
            
            // Check WebSocket connections if available
            if (apiService.io) {
                const clientCount = apiService.io.engine ? apiService.io.engine.clientsCount : 0;
                healthResult.details.websocketClients = clientCount;
                healthResult.metrics.websocketClients = clientCount;
            }
            
            const responseTime = Date.now() - startTime;
            healthResult.score = 0.9; // API services are generally healthy if listening
            healthResult.status = 'healthy';
            healthResult.details.responseTime = responseTime;
            healthResult.metrics.responseTime = responseTime;
            
        } catch (error) {
            healthResult.status = 'failed';
            healthResult.score = 0;
            healthResult.details.error = error.message;
        }
        
        return healthResult;
    }
    
    /**
     * Check module health
     */
    async checkModuleHealth(componentId, module, config) {
        const healthResult = {
            status: 'unknown',
            score: 0,
            details: {},
            metrics: {}
        };
        
        if (!module) {
            healthResult.status = 'failed';
            healthResult.details.error = 'Module not available';
            return healthResult;
        }
        
        try {
            // Check module status
            if (module.status) {
                healthResult.details.moduleStatus = module.status;
                
                switch (module.status) {
                    case 'started':
                        healthResult.status = 'healthy';
                        healthResult.score = 1.0;
                        break;
                    case 'stopped':
                        healthResult.status = 'degraded';
                        healthResult.score = 0.3;
                        break;
                    case 'failed':
                        healthResult.status = 'failed';
                        healthResult.score = 0;
                        break;
                    case 'initializing':
                        healthResult.status = 'warning';
                        healthResult.score = 0.5;
                        break;
                    default:
                        healthResult.status = 'unknown';
                        healthResult.score = 0.2;
                }
            }
            
            // Check if module has custom health check
            if (module.service && typeof module.service.checkHealth === 'function') {
                const moduleHealth = await module.service.checkHealth();
                healthResult.details.moduleHealth = moduleHealth;
                
                if (moduleHealth && typeof moduleHealth.score === 'number') {
                    healthResult.score = Math.min(healthResult.score, moduleHealth.score);
                }
                
                if (moduleHealth && moduleHealth.status) {
                    healthResult.status = this.combineStatuses(healthResult.status, moduleHealth.status);
                }
            }
            
            // Check module metrics if available
            if (module.service && typeof module.service.getMetrics === 'function') {
                try {
                    const metrics = await module.service.getMetrics();
                    healthResult.metrics = metrics;
                } catch (metricsError) {
                    healthResult.details.metricsError = metricsError.message;
                }
            }
            
        } catch (error) {
            healthResult.status = 'failed';
            healthResult.score = 0;
            healthResult.details.error = error.message;
        }
        
        return healthResult;
    }
    
    /**
     * Check protection system health
     */
    async checkProtectionSystemHealth(componentId, protectionSystem, config) {
        const healthResult = {
            status: 'unknown',
            score: 0,
            details: {},
            metrics: {}
        };
        
        if (!protectionSystem) {
            healthResult.status = 'failed';
            healthResult.details.error = 'Protection system not available';
            return healthResult;
        }
        
        try {
            // Use the protection system's custom health check if provided
            if (config.healthCheck && typeof config.healthCheck === 'function') {
                return await config.healthCheck(protectionSystem);
            }
            
            // Default protection system health check
            if (typeof protectionSystem.getStatus === 'function') {
                const status = protectionSystem.getStatus();
                healthResult.details.systemStatus = status;
                
                // Generic scoring based on status fields
                if (status.healthy === false || status.failed === true) {
                    healthResult.status = 'failed';
                    healthResult.score = 0;
                } else if (status.degraded === true || status.warning === true) {
                    healthResult.status = 'degraded';
                    healthResult.score = 0.6;
                } else {
                    healthResult.status = 'healthy';
                    healthResult.score = 0.9;
                }
            }
            
            // Get metrics if available
            if (typeof protectionSystem.getMetrics === 'function') {
                const metrics = protectionSystem.getMetrics();
                healthResult.metrics = metrics;
            } else if (typeof protectionSystem.getStats === 'function') {
                const stats = protectionSystem.getStats();
                healthResult.metrics = stats;
            }
            
        } catch (error) {
            healthResult.status = 'failed';
            healthResult.score = 0;
            healthResult.details.error = error.message;
        }
        
        return healthResult;
    }
    
    /**
     * Check memory health
     */
    async checkMemoryHealth(componentId, memoryComponent, config) {
        const healthResult = {
            status: 'unknown',
            score: 0,
            details: {},
            metrics: {}
        };
        
        try {
            const memoryUsage = process.memoryUsage();
            const heapUsedPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
            
            healthResult.metrics = {
                heapUsed: memoryUsage.heapUsed,
                heapTotal: memoryUsage.heapTotal,
                heapUsedPercent,
                rss: memoryUsage.rss,
                external: memoryUsage.external
            };
            
            healthResult.details = {
                heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
                heapUsedPercent: Math.round(heapUsedPercent * 100)
            };
            
            // Calculate score based on memory usage
            if (heapUsedPercent < 0.7) {
                healthResult.status = 'healthy';
                healthResult.score = 1.0;
            } else if (heapUsedPercent < 0.85) {
                healthResult.status = 'warning';
                healthResult.score = 0.7;
            } else if (heapUsedPercent < 0.95) {
                healthResult.status = 'critical';
                healthResult.score = 0.3;
            } else {
                healthResult.status = 'failed';
                healthResult.score = 0.1;
            }
            
        } catch (error) {
            healthResult.status = 'failed';
            healthResult.score = 0;
            healthResult.details.error = error.message;
        }
        
        return healthResult;
    }
    
    /**
     * Check network health
     */
    async checkNetworkHealth(componentId, networkComponent, config) {
        const healthResult = {
            status: 'healthy',
            score: 0.8,
            details: { type: 'network' },
            metrics: {}
        };
        
        // Basic network health check - could be expanded with ping tests, etc.
        return healthResult;
    }
    
    /**
     * Check file system health
     */
    async checkFileSystemHealth(componentId, fsComponent, config) {
        const healthResult = {
            status: 'healthy',
            score: 0.9,
            details: { type: 'filesystem' },
            metrics: {}
        };
        
        // Basic filesystem health check - could be expanded with disk space checks, etc.
        return healthResult;
    }
    
    /**
     * Check process health
     */
    async checkProcessHealth(componentId, processComponent, config) {
        const healthResult = {
            status: 'unknown',
            score: 0,
            details: {},
            metrics: {}
        };
        
        try {
            const uptime = process.uptime();
            const cpuUsage = process.cpuUsage();
            
            healthResult.metrics = {
                uptime,
                cpuUser: cpuUsage.user,
                cpuSystem: cpuUsage.system,
                pid: process.pid
            };
            
            healthResult.details = {
                uptimeHours: Math.round(uptime / 3600),
                pid: process.pid
            };
            
            // Process is healthy if it's running (which it is if we're executing this)
            healthResult.status = 'healthy';
            healthResult.score = 0.95;
            
        } catch (error) {
            healthResult.status = 'failed';
            healthResult.score = 0;
            healthResult.details.error = error.message;
        }
        
        return healthResult;
    }
    
    /**
     * Normalize health result to standard format
     */
    normalizeHealthResult(componentId, result) {
        const normalized = {
            componentId,
            status: result.status || 'unknown',
            score: typeof result.score === 'number' ? result.score : 0,
            details: result.details || {},
            metrics: result.metrics || {},
            timestamp: Date.now(),
            dependencies: result.dependencies || []
        };
        
        // Ensure status is valid
        if (!['healthy', 'warning', 'degraded', 'critical', 'failed', 'unknown'].includes(normalized.status)) {
            normalized.status = 'unknown';
        }
        
        // Ensure score is in valid range
        normalized.score = Math.max(0, Math.min(1, normalized.score));
        
        return normalized;
    }
    
    /**
     * Calculate response time score
     */
    calculateResponseTimeScore(responseTime) {
        const thresholds = this.checkerConfig.thresholds.responseTime;
        
        if (responseTime <= thresholds.excellent) return 1.0;
        if (responseTime <= thresholds.good) return 0.8;
        if (responseTime <= thresholds.warning) return 0.6;
        if (responseTime <= thresholds.critical) return 0.3;
        return 0.1;
    }
    
    /**
     * Get status from score
     */
    getStatusFromScore(score) {
        if (score >= 0.9) return 'healthy';
        if (score >= 0.7) return 'warning';
        if (score >= 0.4) return 'degraded';
        if (score >= 0.1) return 'critical';
        return 'failed';
    }
    
    /**
     * Combine two health statuses
     */
    combineStatuses(status1, status2) {
        const priority = ['failed', 'critical', 'degraded', 'warning', 'healthy', 'unknown'];
        const index1 = priority.indexOf(status1);
        const index2 = priority.indexOf(status2);
        
        // Return the status with higher priority (lower index)
        return index1 <= index2 ? status1 : status2;
    }
    
    /**
     * Update performance metrics for a component
     */
    updatePerformanceMetrics(componentId, healthResult, duration) {
        if (!this.checkerConfig.performance.trackResponseTimes) return;
        
        let metrics = this.performanceMetrics.get(componentId);
        if (!metrics) {
            metrics = {
                responseTimes: [],
                errorCounts: 0,
                totalChecks: 0,
                lastUpdate: Date.now()
            };
            this.performanceMetrics.set(componentId, metrics);
        }
        
        // Update response times
        metrics.responseTimes.push(duration);
        if (metrics.responseTimes.length > this.checkerConfig.performance.historySize) {
            metrics.responseTimes.shift();
        }
        
        // Update error counts
        if (healthResult.status === 'failed' || healthResult.status === 'critical') {
            metrics.errorCounts++;
        }
        
        metrics.totalChecks++;
        metrics.lastUpdate = Date.now();
        
        // Calculate averages
        metrics.avgResponseTime = metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length;
        metrics.errorRate = metrics.errorCounts / metrics.totalChecks;
    }
    
    /**
     * Update circuit breaker state
     */
    updateCircuitBreaker(componentId, healthResult) {
        let circuitBreaker = this.circuitBreakers.get(componentId);
        if (!circuitBreaker) {
            circuitBreaker = {
                state: 'closed',
                failureCount: 0,
                lastFailure: null,
                lastSuccess: null,
                halfOpenAttempts: 0
            };
            this.circuitBreakers.set(componentId, circuitBreaker);
        }
        
        const isFailure = healthResult.status === 'failed' || healthResult.status === 'critical';
        
        switch (circuitBreaker.state) {
            case 'closed':
                if (isFailure) {
                    circuitBreaker.failureCount++;
                    circuitBreaker.lastFailure = Date.now();
                    
                    if (circuitBreaker.failureCount >= this.checkerConfig.circuitBreaker.failureThreshold) {
                        circuitBreaker.state = 'open';
                        this.emit('circuit:breaker:opened', {
                            componentId,
                            reason: 'failure_threshold_exceeded',
                            failureCount: circuitBreaker.failureCount
                        });
                    }
                } else {
                    circuitBreaker.failureCount = 0;
                    circuitBreaker.lastSuccess = Date.now();
                }
                break;
                
            case 'open':
                if (!isFailure) {
                    const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailure;
                    if (timeSinceLastFailure > this.checkerConfig.circuitBreaker.resetTimeout) {
                        circuitBreaker.state = 'half-open';
                        circuitBreaker.halfOpenAttempts = 0;
                    }
                }
                break;
                
            case 'half-open':
                if (isFailure) {
                    circuitBreaker.state = 'open';
                    circuitBreaker.lastFailure = Date.now();
                } else {
                    circuitBreaker.halfOpenAttempts++;
                    if (circuitBreaker.halfOpenAttempts >= this.checkerConfig.circuitBreaker.halfOpenMax) {
                        circuitBreaker.state = 'closed';
                        circuitBreaker.failureCount = 0;
                        this.emit('circuit:breaker:closed', {
                            componentId,
                            reason: 'half_open_success'
                        });
                    }
                }
                break;
        }
    }
    
    /**
     * Cache health result
     */
    cacheResult(componentId, healthResult) {
        this.healthCache.set(componentId, {
            result: healthResult,
            timestamp: Date.now(),
            ttl: this.checkerConfig.cache.ttl
        });
        
        // Limit cache size
        if (this.healthCache.size > this.checkerConfig.cache.maxSize) {
            const oldestKey = this.healthCache.keys().next().value;
            this.healthCache.delete(oldestKey);
        }
    }
    
    /**
     * Get result from cache
     */
    getFromCache(componentId) {
        const cached = this.healthCache.get(componentId);
        if (!cached) return null;
        
        const age = Date.now() - cached.timestamp;
        if (age > cached.ttl) {
            this.healthCache.delete(componentId);
            return null;
        }
        
        return cached.result;
    }
    
    /**
     * Store check history
     */
    storeCheckHistory(componentId, healthResult, duration) {
        let history = this.checkHistory.get(componentId);
        if (!history) {
            history = [];
            this.checkHistory.set(componentId, history);
        }
        
        history.push({
            timestamp: Date.now(),
            status: healthResult.status,
            score: healthResult.score,
            duration
        });
        
        // Limit history size
        if (history.length > this.checkerConfig.performance.historySize) {
            history.shift();
        }
    }
    
    /**
     * Emit health events
     */
    emitHealthEvents(componentId, healthResult) {
        // Get previous result for comparison
        const history = this.checkHistory.get(componentId) || [];
        const previousResult = history[history.length - 2]; // Second to last (last is current)
        
        // Emit status change event
        if (previousResult && previousResult.status !== healthResult.status) {
            this.emit('component:health:changed', {
                componentId,
                previous: previousResult.status,
                current: healthResult.status,
                score: healthResult.score,
                timestamp: Date.now()
            });
        }
        
        // Emit critical event
        if (healthResult.status === 'critical' || healthResult.status === 'failed') {
            this.emit('component:health:critical', {
                componentId,
                status: healthResult.status,
                score: healthResult.score,
                error: healthResult.details.error,
                timestamp: Date.now()
            });
        }
        
        // Emit recovery event
        if (previousResult && 
            (previousResult.status === 'critical' || previousResult.status === 'failed') &&
            (healthResult.status === 'healthy' || healthResult.status === 'warning')) {
            this.emit('component:health:recovered', {
                componentId,
                previous: previousResult.status,
                current: healthResult.status,
                score: healthResult.score,
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * Create unknown result
     */
    createUnknownResult(componentId) {
        return {
            componentId,
            status: 'unknown',
            score: 0,
            details: { reason: 'check_in_progress' },
            metrics: {},
            timestamp: Date.now()
        };
    }
    
    /**
     * Create circuit open result
     */
    createCircuitOpenResult(componentId, circuitBreaker) {
        return {
            componentId,
            status: 'failed',
            score: 0,
            details: {
                reason: 'circuit_breaker_open',
                failureCount: circuitBreaker.failureCount,
                lastFailure: circuitBreaker.lastFailure
            },
            metrics: {},
            timestamp: Date.now()
        };
    }
    
    /**
     * Create error result
     */
    createErrorResult(componentId, error) {
        return {
            componentId,
            status: 'failed',
            score: 0,
            details: {
                error: error.message,
                reason: 'health_check_error'
            },
            metrics: {},
            timestamp: Date.now()
        };
    }
    
    /**
     * Open circuit breaker manually
     */
    openCircuitBreaker(componentId, reason) {
        const circuitBreaker = this.circuitBreakers.get(componentId) || {
            state: 'closed',
            failureCount: 0,
            lastFailure: null,
            lastSuccess: null,
            halfOpenAttempts: 0
        };
        
        circuitBreaker.state = 'open';
        circuitBreaker.lastFailure = Date.now();
        this.circuitBreakers.set(componentId, circuitBreaker);
        
        this.emit('circuit:breaker:opened', {
            componentId,
            reason: reason || 'manual',
            timestamp: Date.now()
        });
    }
    
    /**
     * Close circuit breaker manually
     */
    closeCircuitBreaker(componentId) {
        const circuitBreaker = this.circuitBreakers.get(componentId);
        if (circuitBreaker) {
            circuitBreaker.state = 'closed';
            circuitBreaker.failureCount = 0;
            
            this.emit('circuit:breaker:closed', {
                componentId,
                reason: 'manual',
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * Perform cleanup of old data
     */
    performCleanup() {
        const now = Date.now();
        
        // Clean up expired cache entries
        for (const [componentId, cached] of this.healthCache.entries()) {
            const age = now - cached.timestamp;
            if (age > cached.ttl) {
                this.healthCache.delete(componentId);
            }
        }
        
        // Clean up old performance metrics
        for (const [componentId, metrics] of this.performanceMetrics.entries()) {
            const age = now - metrics.lastUpdate;
            if (age > 300000) { // 5 minutes
                this.performanceMetrics.delete(componentId);
            }
        }
        
        // Reset circuit breakers that have been open too long
        for (const [componentId, circuitBreaker] of this.circuitBreakers.entries()) {
            if (circuitBreaker.state === 'open' && circuitBreaker.lastFailure) {
                const age = now - circuitBreaker.lastFailure;
                if (age > this.checkerConfig.circuitBreaker.resetTimeout * 2) {
                    circuitBreaker.state = 'half-open';
                    circuitBreaker.halfOpenAttempts = 0;
                }
            }
        }
    }
    
    // ===== Public API =====
    
    /**
     * Get component performance metrics
     */
    getComponentMetrics(componentId) {
        return this.performanceMetrics.get(componentId);
    }
    
    /**
     * Get circuit breaker status
     */
    getCircuitBreakerStatus(componentId) {
        return this.circuitBreakers.get(componentId);
    }
    
    /**
     * Get component check history
     */
    getComponentHistory(componentId) {
        return this.checkHistory.get(componentId) || [];
    }
    
    /**
     * Get all circuit breakers
     */
    getAllCircuitBreakers() {
        return Object.fromEntries(this.circuitBreakers);
    }
    
    /**
     * Clear component cache
     */
    clearCache(componentId = null) {
        if (componentId) {
            this.healthCache.delete(componentId);
        } else {
            this.healthCache.clear();
        }
    }
    
    /**
     * Get health checker configuration
     */
    getConfig() {
        return { ...this.checkerConfig };
    }
    
    /**
     * Update health checker configuration
     */
    updateConfig(newConfig) {
        this.checkerConfig = { ...this.checkerConfig, ...newConfig };
        this.logger.info('Health checker configuration updated');
    }
    
    /**
     * Shutdown health checker
     */
    async shutdown() {
        try {
            this.logger.info('Shutting down Health Checker');
            
            // Clear cleanup interval
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
                this.cleanupInterval = null;
            }
            
            // Clear all state
            this.healthCache.clear();
            this.circuitBreakers.clear();
            this.performanceMetrics.clear();
            this.checkHistory.clear();
            this.activeChecks.clear();
            
            // Remove all listeners
            this.removeAllListeners();
            
            this.logger.info('Health Checker shut down successfully');
            
        } catch (error) {
            this.logger.error('Error shutting down Health Checker', {
                error: error.message,
                stack: error.stack
            });
        }
    }
}

export default HealthChecker;