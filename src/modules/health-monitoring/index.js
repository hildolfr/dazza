import BaseModule from '../../core/BaseModule.js';
import { HealthMonitoringService } from './services/HealthMonitoringService.js';

/**
 * Health Monitoring Module
 * 
 * Provides comprehensive system health monitoring with:
 * - Real-time health checking of all components and protection systems
 * - Predictive analytics for early issue detection
 * - Multi-channel alerting and reporting
 * - Trend analysis and pattern recognition
 * - Circuit breaker patterns for failing components
 * - Health dashboard and API endpoints
 */
export default class HealthMonitoringModule extends BaseModule {
    constructor(context) {
        super(context);
        this.name = 'Health Monitoring System';
        this.dependencies = [];
        this.optionalDependencies = [];
        
        // Health monitoring state
        this.isInitialized = false;
        this.isMonitoring = false;
        this.service = null;
        
        // Module statistics
        this.stats = {
            startTime: null,
            restarts: 0,
            errors: 0,
            lastError: null
        };
    }
    
    /**
     * Initialize the health monitoring module
     */
    async init() {
        try {
            await super.init();
            
            this.logger.info('Initializing Health Monitoring Module');
            
            // Create health monitoring service
            this.service = new HealthMonitoringService(
                this._context.services,
                this.config,
                this.logger,
                this._context.eventBus
            );
            
            // TODO: Temporarily disable health monitoring initialization to prevent hanging
            // await this.service.initialize();
            
            // Setup event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            this.stats.startTime = Date.now();
            
            this.logger.info('Health Monitoring Module initialized successfully');
            
            // Emit initialization event
            if (this._context.eventBus) {
                this._context.eventBus.emit('module:initialized', {
                    moduleId: this.id,
                    name: this.name,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            this.stats.errors++;
            this.stats.lastError = {
                message: error.message,
                timestamp: Date.now(),
                phase: 'initialization'
            };
            
            if (this.logger) {
                this.logger.error('Failed to initialize Health Monitoring Module', {
                    error: error.message,
                    stack: error.stack
                });
            } else {
                console.error('Failed to initialize Health Monitoring Module:', error.message);
            }
            
            throw error;
        }
    }
    
    /**
     * Start the health monitoring module
     */
    async start() {
        if (!this.isInitialized) {
            throw new Error('Module must be initialized before starting');
        }
        
        if (this.status === 'started') {
            this.logger.warn('Health Monitoring Module is already started');
            return;
        }
        
        try {
            this.logger.info('Starting Health Monitoring Module');
            
            // TODO: Temporarily disable health monitoring service start to prevent hanging
            // Start the health monitoring service
            // await this.service.start();
            
            this.status = 'started';
            this.stats.startTime = Date.now();
            this.isMonitoring = true;
            
            this.logger.info('Health Monitoring Module started successfully');
            
            // Emit start event
            if (this.eventBus) {
                this.eventBus.emit('module:started', {
                    moduleId: this.id,
                    name: this.name,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            this.stats.errors++;
            this.stats.lastError = {
                message: error.message,
                timestamp: Date.now(),
                phase: 'start'
            };
            
            this.logger.error('Failed to start Health Monitoring Module', {
                error: error.message,
                stack: error.stack
            });
            
            this.status = 'failed';
            throw error;
        }
    }
    
    /**
     * Stop the health monitoring module
     */
    async stop() {
        if (this.status === 'stopped') {
            this.logger.warn('Health Monitoring Module is already stopped');
            return;
        }
        
        try {
            this.logger.info('Stopping Health Monitoring Module');
            
            // Stop the health monitoring service
            if (this.service) {
                await this.service.stop();
            }
            
            this.status = 'stopped';
            this.isMonitoring = false;
            
            this.logger.info('Health Monitoring Module stopped successfully');
            
            // Emit stop event
            if (this.eventBus) {
                this.eventBus.emit('module:stopped', {
                    moduleId: this.id,
                    name: this.name,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            this.stats.errors++;
            this.stats.lastError = {
                message: error.message,
                timestamp: Date.now(),
                phase: 'stop'
            };
            
            this.logger.error('Failed to stop Health Monitoring Module', {
                error: error.message,
                stack: error.stack
            });
            
            this.status = 'failed';
            throw error;
        }
    }
    
    /**
     * Restart the health monitoring module
     */
    async restart() {
        try {
            this.logger.info('Restarting Health Monitoring Module');
            
            await this.stop();
            await this.start();
            
            this.stats.restarts++;
            
            this.logger.info('Health Monitoring Module restarted successfully');
            
            // Emit restart event
            if (this.eventBus) {
                this.eventBus.emit('module:restarted', {
                    moduleId: this.id,
                    name: this.name,
                    restartCount: this.stats.restarts,
                    timestamp: Date.now()
                });
            }
            
        } catch (error) {
            this.stats.errors++;
            this.stats.lastError = {
                message: error.message,
                timestamp: Date.now(),
                phase: 'restart'
            };
            
            this.logger.error('Failed to restart Health Monitoring Module', {
                error: error.message,
                stack: error.stack
            });
            
            this.status = 'failed';
            throw error;
        }
    }
    
    /**
     * Setup event listeners for module integration
     */
    setupEventListeners() {
        if (!this._context.eventBus) return;
        
        // Listen for system events that affect health
        this._context.eventBus.subscribe(this.id, 'module:error', (data) => {
            this.handleModuleError(data);
        });
        
        this._context.eventBus.subscribe(this.id, 'system:memory:warning', (data) => {
            this.handleMemoryWarning(data);
        });
        
        this._context.eventBus.subscribe(this.id, 'system:stack:critical', (data) => {
            this.handleStackCritical(data);
        });
        
        this._context.eventBus.subscribe(this.id, 'eventbus:recursion:detected', (data) => {
            this.handleRecursionDetected(data);
        });
        
        // Listen for health monitoring events to forward them
        if (this.service) {
            this.service.on('health:system:changed', (data) => {
                this.eventBus.emit('health:system:changed', data);
            });
            
            this.service.on('health:component:critical', (data) => {
                this.eventBus.emit('health:component:critical', data);
            });
            
            this.service.on('health:alert:triggered', (data) => {
                this.eventBus.emit('health:alert:triggered', data);
            });
            
            this.service.on('health:prediction:concern', (data) => {
                this.eventBus.emit('health:prediction:concern', data);
            });
            
            this.service.on('health:emergency:activated', (data) => {
                this.eventBus.emit('health:emergency:activated', data);
            });
        }
        
        this.logger.debug('Health Monitoring Module event listeners setup complete');
    }
    
    /**
     * Handle module error events
     */
    handleModuleError(data) {
        this.logger.warn('Module error detected', {
            moduleId: data.moduleId,
            error: data.error,
            timestamp: data.timestamp
        });
        
        // The health monitoring service will automatically detect and handle this
        // through its component health checking
    }
    
    /**
     * Handle memory warning events
     */
    handleMemoryWarning(data) {
        this.logger.warn('Memory warning detected', {
            heapPercent: data.heapPercent,
            recommendation: data.recommendation
        });
        
        // Forward to health monitoring service for correlation
        if (this.service) {
            this.service.handleSystemAlert('memory', 'warning', data);
        }
    }
    
    /**
     * Handle stack critical events
     */
    handleStackCritical(data) {
        this.logger.error('Stack critical event detected', {
            depth: data.depth,
            threshold: data.threshold
        });
        
        // Forward to health monitoring service for immediate action
        if (this.service) {
            this.service.handleSystemAlert('stack', 'critical', data);
        }
    }
    
    /**
     * Handle recursion detection events
     */
    handleRecursionDetected(data) {
        this.logger.warn('Recursion detected', {
            pattern: data.pattern,
            timestamp: data.timestamp
        });
        
        // Forward to health monitoring service
        if (this.service) {
            this.service.handleSystemAlert('recursion', 'warning', data);
        }
    }
    
    /**
     * Get module status
     */
    getStatus() {
        const baseStatus = {
            id: this.id,
            name: this.name,
            version: this.version,
            status: this.status,
            initialized: this.isInitialized,
            monitoring: this.isMonitoring,
            uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0,
            stats: this.stats
        };
        
        // Add service status if available
        if (this.service) {
            baseStatus.service = {
                healthMonitor: this.service.healthMonitor ? 'available' : 'unavailable',
                healthChecker: this.service.healthChecker ? 'available' : 'unavailable',
                healthReporter: this.service.healthReporter ? 'available' : 'unavailable',
                systemHealth: this.service.getSystemHealthSummary()
            };
        }
        
        return baseStatus;
    }
    
    /**
     * Get module health status
     */
    async checkHealth() {
        try {
            if (!this.isInitialized || this.status !== 'started') {
                return {
                    healthy: false,
                    status: this.status,
                    message: 'Module not properly started'
                };
            }
            
            if (!this.service) {
                return {
                    healthy: false,
                    status: 'service_unavailable',
                    message: 'Health monitoring service not available'
                };
            }
            
            // Check service health
            const serviceHealth = await this.service.checkHealth();
            
            return {
                healthy: serviceHealth.healthy,
                status: serviceHealth.status,
                message: serviceHealth.message,
                details: {
                    service: serviceHealth,
                    module: {
                        status: this.status,
                        monitoring: this.isMonitoring,
                        errors: this.stats.errors
                    }
                }
            };
            
        } catch (error) {
            this.logger.error('Error checking module health', {
                error: error.message
            });
            
            return {
                healthy: false,
                status: 'check_failed',
                message: error.message
            };
        }
    }
    
    /**
     * Get module metrics
     */
    async getMetrics() {
        const metrics = {
            module: {
                uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0,
                restarts: this.stats.restarts,
                errors: this.stats.errors,
                status: this.status
            }
        };
        
        // Add service metrics if available
        if (this.service) {
            try {
                metrics.service = await this.service.getMetrics();
            } catch (error) {
                this.logger.warn('Error getting service metrics', {
                    error: error.message
                });
                metrics.service = { error: error.message };
            }
        }
        
        return metrics;
    }
    
    /**
     * Get health dashboard data
     */
    getHealthDashboard() {
        if (!this.service) {
            return {
                error: 'Health monitoring service not available'
            };
        }
        
        try {
            return this.service.getHealthDashboard();
        } catch (error) {
            this.logger.error('Error getting health dashboard', {
                error: error.message
            });
            return {
                error: error.message
            };
        }
    }
    
    /**
     * Force health check
     */
    async forceHealthCheck() {
        if (!this.service) {
            throw new Error('Health monitoring service not available');
        }
        
        return await this.service.forceHealthCheck();
    }
    
    /**
     * Generate health report
     */
    async generateHealthReport() {
        if (!this.service) {
            throw new Error('Health monitoring service not available');
        }
        
        return await this.service.generateHealthReport();
    }
    
    /**
     * Update module configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        if (this.service) {
            this.service.updateConfig(newConfig);
        }
        
        this.logger.info('Health Monitoring Module configuration updated');
    }
    
    /**
     * Cleanup and shutdown the module
     */
    async cleanup() {
        try {
            this.logger.info('Cleaning up Health Monitoring Module');
            
            // Stop the module if running
            if (this.status === 'started') {
                await this.stop();
            }
            
            // Cleanup service
            if (this.service) {
                await this.service.cleanup();
                this.service = null;
            }
            
            // Remove event listeners
            if (this.eventBus) {
                this.eventBus.removeModuleListeners(this.id);
            }
            
            // Reset state
            this.isInitialized = false;
            this.isMonitoring = false;
            this.status = 'stopped';
            
            this.logger.info('Health Monitoring Module cleanup complete');
            
        } catch (error) {
            this.logger.error('Error during Health Monitoring Module cleanup', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
}

// Export for module loading
export { HealthMonitoringModule };