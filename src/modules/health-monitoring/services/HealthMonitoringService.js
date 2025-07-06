import { EventEmitter } from 'events';
import { HealthMonitor } from '../../../core/HealthMonitor.js';

/**
 * Health Monitoring Service
 * 
 * Service wrapper for the HealthMonitor that integrates with the module system
 * and provides additional service-level functionality.
 */
export class HealthMonitoringService extends EventEmitter {
    constructor(services, config, logger, eventBus) {
        super();
        this.services = services;
        this.config = config;
        this.logger = logger;
        this.eventBus = eventBus;
        
        // Core health monitoring components
        this.healthMonitor = null;
        this.healthChecker = null;
        this.healthReporter = null;
        
        // Service state
        this.isInitialized = false;
        this.isRunning = false;
        
        // Service configuration
        this.serviceConfig = {
            // Health monitoring settings from module config
            health: config.health || {
                checkInterval: config.checkInterval || 30000,
                reportInterval: config.reportInterval || 300000,
                aggregationInterval: config.aggregationInterval || 60000,
                thresholds: config.thresholds || {},
                alerts: config.alerts || {},
                prediction: config.prediction || {}
            },
            
            // Integration settings
            integration: {
                autoRegisterServices: true,
                autoRegisterModules: true,
                monitorEventBus: true,
                exposeAPI: true
            }
        };
        
        // Service statistics
        this.stats = {
            startTime: null,
            healthChecks: 0,
            alerts: 0,
            reports: 0,
            errors: 0
        };
    }
    
    /**
     * Initialize the health monitoring service
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        
        try {
            this.logger.info('Initializing Health Monitoring Service');
            
            // Create health monitor with service configuration
            this.healthMonitor = new HealthMonitor(
                this.services,
                this.serviceConfig.health,
                this.logger
            );
            
            // Initialize the health monitor
            await this.healthMonitor.initialize();
            
            // Get references to health checker and reporter
            this.healthChecker = this.healthMonitor.healthChecker;
            this.healthReporter = this.healthMonitor.healthReporter;
            
            // Setup event forwarding
            this.setupEventForwarding();
            
            // Auto-register services if enabled
            if (this.serviceConfig.integration.autoRegisterServices) {
                await this.autoRegisterServices();
            }
            
            // Auto-register modules if enabled
            if (this.serviceConfig.integration.autoRegisterModules) {
                await this.autoRegisterModules();
            }
            
            // Setup event bus monitoring if enabled
            if (this.serviceConfig.integration.monitorEventBus && this.eventBus) {
                this.setupEventBusMonitoring();
            }
            
            this.isInitialized = true;
            
            this.logger.info('Health Monitoring Service initialized successfully');
            
        } catch (error) {
            this.logger.error('Failed to initialize Health Monitoring Service', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
    
    /**
     * Start the health monitoring service
     */
    async start() {
        if (!this.isInitialized) {
            throw new Error('Service must be initialized before starting');
        }
        
        if (this.isRunning) {
            this.logger.warn('Health Monitoring Service is already running');
            return;
        }
        
        try {
            this.logger.info('Starting Health Monitoring Service');
            
            // Start health monitoring
            await this.healthMonitor.startMonitoring();
            
            this.isRunning = true;
            this.stats.startTime = Date.now();
            
            this.logger.info('Health Monitoring Service started successfully');
            
        } catch (error) {
            this.logger.error('Failed to start Health Monitoring Service', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
    
    /**
     * Stop the health monitoring service
     */
    async stop() {
        if (!this.isRunning) {
            this.logger.warn('Health Monitoring Service is not running');
            return;
        }
        
        try {
            this.logger.info('Stopping Health Monitoring Service');
            
            // Stop health monitoring
            if (this.healthMonitor) {
                await this.healthMonitor.stopMonitoring();
            }
            
            this.isRunning = false;
            
            this.logger.info('Health Monitoring Service stopped successfully');
            
        } catch (error) {
            this.logger.error('Failed to stop Health Monitoring Service', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
    
    /**
     * Setup event forwarding from health monitor to module
     */
    setupEventForwarding() {
        if (!this.healthMonitor) return;
        
        // Forward health monitor events through the service
        this.healthMonitor.on('health:system:changed', (data) => {
            this.emit('health:system:changed', data);
        });
        
        this.healthMonitor.on('health:component:critical', (data) => {
            this.emit('health:component:critical', data);
        });
        
        this.healthMonitor.on('health:alert:triggered', (data) => {
            this.stats.alerts++;
            this.emit('health:alert:triggered', data);
        });
        
        this.healthMonitor.on('health:prediction:concern', (data) => {
            this.emit('health:prediction:concern', data);
        });
        
        this.healthMonitor.on('health:emergency:activated', (data) => {
            this.emit('health:emergency:activated', data);
        });
        
        this.healthMonitor.on('health:check:completed', (data) => {
            this.stats.healthChecks++;
        });
        
        this.healthMonitor.on('health:report:generated', (data) => {
            this.stats.reports++;
        });
        
        this.logger.debug('Health monitoring event forwarding setup complete');
    }
    
    /**
     * Auto-register services for health monitoring
     */
    async autoRegisterServices() {
        if (!this.services) return;
        
        try {
            this.logger.info('Auto-registering services for health monitoring');
            
            // Register each service
            for (const [serviceName, service] of this.services) {
                try {
                    const config = this.inferServiceConfig(serviceName, service);
                    await this.healthMonitor.registerComponent(serviceName, service, config);
                    
                    this.logger.debug(`Auto-registered service: ${serviceName}`, {
                        type: config.type,
                        priority: config.priority
                    });
                    
                } catch (error) {
                    this.logger.warn(`Failed to auto-register service: ${serviceName}`, {
                        error: error.message
                    });
                }
            }
            
        } catch (error) {
            this.logger.error('Error auto-registering services', {
                error: error.message
            });
        }
    }
    
    /**
     * Auto-register modules for health monitoring
     */
    async autoRegisterModules() {
        const moduleRegistry = this.services.get('module-registry') || this.services.get('moduleRegistry');
        if (!moduleRegistry) {
            this.logger.warn('Module registry not found - cannot auto-register modules');
            return;
        }
        
        try {
            this.logger.info('Auto-registering modules for health monitoring');
            
            const modules = moduleRegistry.getAll();
            
            for (const module of modules) {
                try {
                    const config = {
                        type: 'module',
                        priority: this.inferModulePriority(module),
                        healthCheck: async (mod) => {
                            if (typeof mod.checkHealth === 'function') {
                                return await mod.checkHealth();
                            }
                            
                            // Basic module health check
                            return {
                                status: mod.status === 'started' ? 'healthy' : 'degraded',
                                score: mod.status === 'started' ? 1.0 : 0.5,
                                details: { moduleStatus: mod.status }
                            };
                        },
                        metrics: async (mod) => {
                            if (typeof mod.getMetrics === 'function') {
                                return await mod.getMetrics();
                            }
                            return { status: mod.status };
                        }
                    };
                    
                    await this.healthMonitor.registerComponent(module.id, module, config);
                    
                    this.logger.debug(`Auto-registered module: ${module.id}`, {
                        priority: config.priority,
                        status: module.status
                    });
                    
                } catch (error) {
                    this.logger.warn(`Failed to auto-register module: ${module.id}`, {
                        error: error.message
                    });
                }
            }
            
        } catch (error) {
            this.logger.error('Error auto-registering modules', {
                error: error.message
            });
        }
    }
    
    /**
     * Setup event bus monitoring
     */
    setupEventBusMonitoring() {
        if (!this.eventBus || !this.healthMonitor) return;
        
        try {
            // Register event bus as a component
            const config = {
                type: 'communication',
                priority: 'critical',
                healthCheck: (eventBus) => {
                    const stats = eventBus.getStats();
                    const protectionStatus = eventBus.getRecursionProtectionStatus();
                    
                    const isHealthy = protectionStatus.isHealthy && !protectionStatus.circuitBreakerOpen;
                    
                    return {
                        status: isHealthy ? 'healthy' : 'degraded',
                        score: isHealthy ? 1.0 : 0.7,
                        details: {
                            circuitBreaker: protectionStatus.circuitBreakerOpen,
                            stackDepth: protectionStatus.currentStackDepth,
                            activeChains: protectionStatus.activeChains,
                            totalEvents: stats.totalEvents
                        },
                        metrics: stats
                    };
                }
            };
            
            this.healthMonitor.registerComponent('event-bus', this.eventBus, config);
            
            this.logger.debug('Event bus monitoring setup complete');
            
        } catch (error) {
            this.logger.warn('Failed to setup event bus monitoring', {
                error: error.message
            });
        }
    }
    
    /**
     * Infer service configuration for health monitoring
     */
    inferServiceConfig(serviceName, service) {
        const config = {
            type: 'service',
            priority: 'medium',
            tags: []
        };
        
        // Infer type based on service name
        if (serviceName.includes('database') || serviceName.includes('db')) {
            config.type = 'database';
            config.priority = 'critical';
        } else if (serviceName.includes('api') || serviceName.includes('server')) {
            config.type = 'api';
            config.priority = 'high';
        } else if (serviceName.includes('memory') || serviceName.includes('stack') || serviceName.includes('protection')) {
            config.type = 'protection';
            config.priority = 'critical';
        } else if (serviceName.includes('performance') || serviceName.includes('monitor')) {
            config.type = 'monitoring';
            config.priority = 'medium';
        } else if (serviceName.includes('connection') || serviceName.includes('network')) {
            config.type = 'network';
            config.priority = 'high';
        }
        
        // Add custom health check if service has methods
        if (typeof service.getStatus === 'function') {
            config.healthCheck = async (svc) => {
                const status = await svc.getStatus();
                return {
                    status: status.healthy !== false ? 'healthy' : 'failed',
                    score: status.healthy !== false ? 1.0 : 0.0,
                    details: status
                };
            };
        }
        
        // Add metrics if service has methods
        if (typeof service.getMetrics === 'function') {
            config.metrics = async (svc) => await svc.getMetrics();
        } else if (typeof service.getStats === 'function') {
            config.metrics = async (svc) => await svc.getStats();
        }
        
        return config;
    }
    
    /**
     * Infer module priority for health monitoring
     */
    inferModulePriority(module) {
        if (module.type === 'core' || module.priority === 'critical') {
            return 'critical';
        } else if (module.priority === 'high') {
            return 'high';
        } else if (module.priority === 'low') {
            return 'low';
        }
        return 'medium';
    }
    
    /**
     * Handle system alerts from other parts of the system
     */
    handleSystemAlert(source, level, data) {
        if (!this.healthReporter) return;
        
        try {
            // Create alert from system event
            const alertConfig = {
                componentId: source,
                type: 'system_alert',
                level: level,
                title: `${source.toUpperCase()} ${level.toUpperCase()}`,
                message: data.message || `${source} ${level} detected`,
                data: data,
                timestamp: Date.now()
            };
            
            // Trigger alert
            this.healthReporter.triggerAlert(alertConfig);
            
        } catch (error) {
            this.logger.error('Error handling system alert', {
                source,
                level,
                error: error.message
            });
        }
    }
    
    /**
     * Get system health summary
     */
    getSystemHealthSummary() {
        if (!this.healthMonitor) {
            return { status: 'unavailable' };
        }
        
        try {
            const systemHealth = this.healthMonitor.getSystemHealth();
            return {
                status: systemHealth.status,
                score: systemHealth.score,
                components: systemHealth.componentsChecked || 0,
                emergency: systemHealth.emergency?.isActive || false
            };
        } catch (error) {
            return { status: 'error', error: error.message };
        }
    }
    
    /**
     * Get health dashboard data
     */
    getHealthDashboard() {
        if (!this.healthMonitor) {
            throw new Error('Health monitor not available');
        }
        
        return this.healthMonitor.getHealthDashboard();
    }
    
    /**
     * Force health check
     */
    async forceHealthCheck() {
        if (!this.healthMonitor) {
            throw new Error('Health monitor not available');
        }
        
        return await this.healthMonitor.forceHealthCheck();
    }
    
    /**
     * Generate health report
     */
    async generateHealthReport() {
        if (!this.healthMonitor) {
            throw new Error('Health monitor not available');
        }
        
        return await this.healthMonitor.forceHealthReport();
    }
    
    /**
     * Check service health
     */
    async checkHealth() {
        try {
            if (!this.isInitialized) {
                return {
                    healthy: false,
                    status: 'not_initialized',
                    message: 'Service not initialized'
                };
            }
            
            if (!this.isRunning) {
                return {
                    healthy: false,
                    status: 'not_running',
                    message: 'Service not running'
                };
            }
            
            if (!this.healthMonitor) {
                return {
                    healthy: false,
                    status: 'health_monitor_unavailable',
                    message: 'Health monitor not available'
                };
            }
            
            // Check if health monitoring is working
            const systemHealth = this.healthMonitor.getSystemHealth();
            
            return {
                healthy: true,
                status: 'healthy',
                message: 'Service operational',
                details: {
                    systemHealth: systemHealth.status,
                    monitoring: this.healthMonitor.isMonitoring,
                    components: systemHealth.componentsChecked || 0
                }
            };
            
        } catch (error) {
            return {
                healthy: false,
                status: 'check_failed',
                message: error.message
            };
        }
    }
    
    /**
     * Get service metrics
     */
    async getMetrics() {
        const metrics = {
            service: {
                initialized: this.isInitialized,
                running: this.isRunning,
                uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0,
                stats: this.stats
            }
        };
        
        // Add health monitor metrics if available
        if (this.healthMonitor) {
            try {
                const dashboard = this.healthMonitor.getHealthDashboard();
                metrics.healthMonitor = {
                    systemHealth: dashboard.system,
                    components: Object.keys(dashboard.components || {}).length,
                    alerts: dashboard.alerts?.active?.length || 0,
                    stats: dashboard.stats
                };
            } catch (error) {
                metrics.healthMonitor = { error: error.message };
            }
        }
        
        return metrics;
    }
    
    /**
     * Update service configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.serviceConfig.health = { ...this.serviceConfig.health, ...newConfig.health };
        
        // Update health monitor configuration
        if (this.healthMonitor) {
            this.healthMonitor.updateHealthConfig(newConfig.health || newConfig);
        }
        
        this.logger.info('Health Monitoring Service configuration updated');
    }
    
    /**
     * Cleanup and shutdown the service
     */
    async cleanup() {
        try {
            this.logger.info('Cleaning up Health Monitoring Service');
            
            // Stop monitoring if running
            if (this.isRunning) {
                await this.stop();
            }
            
            // Shutdown health monitor
            if (this.healthMonitor) {
                await this.healthMonitor.shutdown();
                this.healthMonitor = null;
            }
            
            // Clear references
            this.healthChecker = null;
            this.healthReporter = null;
            
            // Remove all listeners
            this.removeAllListeners();
            
            // Reset state
            this.isInitialized = false;
            this.isRunning = false;
            
            this.logger.info('Health Monitoring Service cleanup complete');
            
        } catch (error) {
            this.logger.error('Error during Health Monitoring Service cleanup', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
}

export default HealthMonitoringService;