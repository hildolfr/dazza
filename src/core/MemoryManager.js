import { EventEmitter } from 'events';
import { MemoryPressureMonitor } from '../utils/MemoryPressureMonitor.js';
import { MemoryCleanupManager } from '../utils/MemoryCleanupManager.js';

/**
 * Core Memory Manager
 * Central orchestrator for memory pressure monitoring and automatic cleanup
 * Integrates with all core systems to provide comprehensive memory management
 */
export class MemoryManager extends EventEmitter {
    constructor(services, config, logger) {
        super();
        this.services = services;
        this.config = config;
        this.logger = logger;
        
        // Memory management configuration
        this.memoryConfig = {
            // Monitoring settings
            monitoring: {
                enabled: this.config.memory?.monitoring?.enabled ?? true,
                checkInterval: this.config.memory?.monitoring?.checkInterval ?? 30000,
                historySize: this.config.memory?.monitoring?.historySize ?? 100,
                ...this.config.memory?.monitoring
            },
            
            // Threshold settings
            thresholds: {
                warning: this.config.memory?.thresholds?.warning ?? 0.80,
                critical: this.config.memory?.thresholds?.critical ?? 0.90,
                emergency: this.config.memory?.thresholds?.emergency ?? 0.95,
                rss: this.config.memory?.thresholds?.rss ?? 1024 * 1024 * 1024, // 1GB
                external: this.config.memory?.thresholds?.external ?? 512 * 1024 * 1024, // 512MB
                ...this.config.memory?.thresholds
            },
            
            // Cleanup settings
            cleanup: {
                enabled: this.config.memory?.cleanup?.enabled ?? true,
                autoCleanup: this.config.memory?.cleanup?.autoCleanup ?? true,
                emergencyShutdown: this.config.memory?.cleanup?.emergencyShutdown ?? true,
                ...this.config.memory?.cleanup
            },
            
            // Alert settings
            alerts: {
                enabled: this.config.memory?.alerts?.enabled ?? true,
                cooldown: this.config.memory?.alerts?.cooldown ?? 300000, // 5 minutes
                emergencyCooldown: this.config.memory?.alerts?.emergencyCooldown ?? 60000, // 1 minute
                ...this.config.memory?.alerts
            }
        };
        
        // Core components
        this.pressureMonitor = null;
        this.cleanupManager = null;
        
        // State management
        this.isInitialized = false;
        this.isMonitoring = false;
        this.currentPressureLevel = 'normal';
        this.lastCleanupTime = null;
        this.emergencyMode = false;
        
        // Statistics
        this.stats = {
            startTime: Date.now(),
            totalAlerts: 0,
            totalCleanups: 0,
            totalMemoryFreed: 0,
            emergencyActions: 0,
            componentShutdowns: 0,
            restarts: 0
        };
        
        // Component registry for memory tracking
        this.componentRegistry = new Map();
        this.criticalComponents = new Set(['core-database', 'core-connection', 'command-handler']);
        
        // Emergency shutdown protection
        this.shutdownProtection = {
            enabled: this.memoryConfig.cleanup.emergencyShutdown,
            threshold: 0.98, // 98% - absolute emergency threshold
            attempts: 0,
            maxAttempts: 3,
            lastAttempt: null
        };
        
        // Auto-restart components after cleanup
        this.componentRestartQueue = new Map();
    }
    
    /**
     * Initialize memory management system
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        
        try {
            this.logger.info('Initializing Memory Management System');
            
            // Initialize pressure monitor
            this.pressureMonitor = new MemoryPressureMonitor({
                ...this.memoryConfig.monitoring,
                ...this.memoryConfig.thresholds
            });
            
            // Initialize cleanup manager
            this.cleanupManager = new MemoryCleanupManager(
                this.services,
                this.memoryConfig.cleanup,
                this.logger
            );
            
            // Setup event handlers
            this.setupEventHandlers();
            
            // Register core components
            await this.registerCoreComponents();
            
            // Start monitoring if enabled
            if (this.memoryConfig.monitoring.enabled) {
                await this.startMonitoring();
            }
            
            this.isInitialized = true;
            this.logger.info('Memory Management System initialized successfully', {
                monitoring: this.memoryConfig.monitoring.enabled,
                autoCleanup: this.memoryConfig.cleanup.autoCleanup,
                thresholds: this.memoryConfig.thresholds
            });
            
            this.emit('initialized', { config: this.memoryConfig });
            
        } catch (error) {
            this.logger.error('Failed to initialize Memory Management System', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
    
    /**
     * Setup event handlers for pressure monitoring and cleanup
     */
    setupEventHandlers() {
        // Pressure monitoring events
        this.pressureMonitor.on('pressure:warning', this.handlePressureWarning.bind(this));
        this.pressureMonitor.on('pressure:critical', this.handlePressureCritical.bind(this));
        this.pressureMonitor.on('pressure:emergency', this.handlePressureEmergency.bind(this));
        this.pressureMonitor.on('memory:leak-detected', this.handleMemoryLeak.bind(this));
        this.pressureMonitor.on('memory:emergency-action-needed', this.handleEmergencyAction.bind(this));
        
        // Cleanup events
        this.cleanupManager.on('cleanup:completed', this.handleCleanupCompleted.bind(this));
        this.cleanupManager.on('cleanup:failed', this.handleCleanupFailed.bind(this));
        
        // Monitor component events
        this.pressureMonitor.on('component:registered', (data) => {
            this.logger.debug(`Component registered for memory monitoring: ${data.name}`);
        });
        
        this.pressureMonitor.on('sample:taken', (sample) => {
            this.emit('memory:sample', sample);
        });
        
        this.pressureMonitor.on('gc:executed', (data) => {
            this.emit('memory:gc', data);
        });
    }
    
    /**
     * Register core components for memory tracking
     */
    async registerCoreComponents() {
        try {
            // Register services for memory tracking
            for (const [serviceName, service] of this.services) {
                if (service && typeof service === 'object') {
                    await this.registerComponent(serviceName, service);
                }
            }
            
            // Register with cleanup manager
            for (const [name, component] of this.componentRegistry) {
                this.cleanupManager.registerComponent(name, component);
            }
            
            this.logger.info(`Registered ${this.componentRegistry.size} components for memory monitoring`);
            
        } catch (error) {
            this.logger.error('Error registering core components', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Register a component for memory tracking
     */
    async registerComponent(name, component) {
        this.componentRegistry.set(name, component);
        
        // Register with pressure monitor for size tracking
        if (component instanceof Map) {
            this.pressureMonitor.registerComponent(name, () => component.size);
        } else if (Array.isArray(component)) {
            this.pressureMonitor.registerComponent(name, () => component.length);
        } else if (component instanceof Set) {
            this.pressureMonitor.registerComponent(name, () => component.size);
        } else if (typeof component.getMemoryUsage === 'function') {
            this.pressureMonitor.registerComponent(name, () => component.getMemoryUsage());
        }
        
        this.logger.debug(`Registered component for memory management: ${name}`);
    }
    
    /**
     * Unregister a component from memory tracking
     */
    async unregisterComponent(name) {
        this.componentRegistry.delete(name);
        this.pressureMonitor.unregisterComponent(name);
        this.cleanupManager.unregisterComponent(name);
        
        this.logger.debug(`Unregistered component from memory management: ${name}`);
    }
    
    /**
     * Start memory monitoring
     */
    async startMonitoring() {
        if (this.isMonitoring) {
            return;
        }
        
        try {
            this.pressureMonitor.start();
            this.isMonitoring = true;
            
            this.logger.info('Memory monitoring started', {
                interval: this.memoryConfig.monitoring.checkInterval,
                thresholds: this.memoryConfig.thresholds
            });
            
            this.emit('monitoring:started');
            
        } catch (error) {
            this.logger.error('Failed to start memory monitoring', { error: error.message });
            throw error;
        }
    }
    
    /**
     * Stop memory monitoring
     */
    async stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }
        
        try {
            this.pressureMonitor.stop();
            this.isMonitoring = false;
            
            this.logger.info('Memory monitoring stopped');
            this.emit('monitoring:stopped');
            
        } catch (error) {
            this.logger.error('Failed to stop memory monitoring', { error: error.message });
        }
    }
    
    /**
     * Handle pressure warning events
     */
    async handlePressureWarning(data) {
        this.currentPressureLevel = 'warning';
        this.stats.totalAlerts++;
        
        this.logger.warn('Memory pressure warning detected', {
            heapPercent: data.sample.heap.usagePercent * 100,
            heapUsedMB: data.sample.heap.usedMB,
            recommendation: data.recommendation
        });
        
        // Emit warning event
        this.emit('memory:pressure:warning', data);
        
        // Auto-cleanup if enabled
        if (this.memoryConfig.cleanup.autoCleanup) {
            await this.executeAutoCleanup('gentle', data);
        }
    }
    
    /**
     * Handle pressure critical events
     */
    async handlePressureCritical(data) {
        this.currentPressureLevel = 'critical';
        this.stats.totalAlerts++;
        
        this.logger.error('Critical memory pressure detected', {
            heapPercent: data.sample.heap.usagePercent * 100,
            heapUsedMB: data.sample.heap.usedMB,
            recommendation: data.recommendation
        });
        
        // Emit critical event
        this.emit('memory:pressure:critical', data);
        
        // Auto-cleanup if enabled
        if (this.memoryConfig.cleanup.autoCleanup) {
            await this.executeAutoCleanup('moderate', data);
        }
    }
    
    /**
     * Handle pressure emergency events
     */
    async handlePressureEmergency(data) {
        this.currentPressureLevel = 'emergency';
        this.stats.totalAlerts++;
        this.stats.emergencyActions++;
        
        this.logger.error('EMERGENCY: Critical memory pressure - immediate action required', {
            heapPercent: data.sample.heap.usagePercent * 100,
            heapUsedMB: data.sample.heap.usedMB,
            recommendation: data.recommendation
        });
        
        // Enter emergency mode
        this.emergencyMode = true;
        
        // Emit emergency event
        this.emit('memory:pressure:emergency', data);
        
        // Execute emergency cleanup
        await this.executeEmergencyCleanup(data);
        
        // Check if emergency shutdown is needed
        if (data.sample.heap.usagePercent >= this.shutdownProtection.threshold) {
            await this.considerEmergencyShutdown(data);
        }
    }
    
    /**
     * Handle memory leak detection
     */
    async handleMemoryLeak(data) {
        this.logger.error('Memory leak detected', {
            confidence: data.confidence,
            avgGrowthPercent: data.avgGrowthPercent,
            totalIncreaseMB: data.totalIncreaseMB,
            indicators: data.indicators
        });
        
        this.emit('memory:leak-detected', data);
        
        // Execute aggressive cleanup for potential leaks
        if (this.memoryConfig.cleanup.autoCleanup) {
            await this.executeAutoCleanup('aggressive', data);
        }
    }
    
    /**
     * Handle emergency action needed
     */
    async handleEmergencyAction(data) {
        this.logger.error('Emergency memory action needed', {
            conditions: data.conditions,
            emergencyCount: data.emergencyCount
        });
        
        this.emit('memory:emergency-action-needed', data);
        
        // Execute emergency cleanup
        await this.executeEmergencyCleanup(data);
    }
    
    /**
     * Execute automatic cleanup based on pressure level
     */
    async executeAutoCleanup(level, memoryData) {
        try {
            const now = Date.now();
            
            // Check cooldown
            if (this.lastCleanupTime && (now - this.lastCleanupTime) < 60000) {
                this.logger.debug('Cleanup skipped due to cooldown');
                return;
            }
            
            this.logger.info(`Executing ${level} cleanup strategy`);
            
            const result = await this.cleanupManager.executeCleanup(level, memoryData);
            
            if (result.success) {
                this.lastCleanupTime = now;
                this.stats.totalCleanups++;
                this.stats.totalMemoryFreed += result.memoryFreed;
                
                this.logger.info(`Cleanup completed successfully`, {
                    level,
                    memoryFreedMB: Math.round(result.memoryFreed / 1024 / 1024),
                    duration: result.duration,
                    actionsExecuted: result.actions.length
                });
                
                // Check if pressure level improved
                setTimeout(() => {
                    const currentSample = this.pressureMonitor.getLatestSample();
                    if (currentSample) {
                        const newLevel = this.pressureMonitor.calculatePressureLevel(currentSample);
                        if (newLevel !== this.currentPressureLevel) {
                            this.currentPressureLevel = newLevel;
                            this.logger.info(`Memory pressure improved to: ${newLevel}`);
                            
                            // Exit emergency mode if pressure normalized
                            if (newLevel === 'normal' && this.emergencyMode) {
                                this.emergencyMode = false;
                                this.logger.info('Exiting emergency mode - memory pressure normalized');
                            }
                        }
                    }
                }, 5000);
                
            } else {
                this.logger.error(`Cleanup failed: ${level}`, { errors: result.errors });
            }
            
        } catch (error) {
            this.logger.error(`Error executing auto cleanup: ${level}`, {
                error: error.message,
                stack: error.stack
            });
        }
    }
    
    /**
     * Execute emergency cleanup
     */
    async executeEmergencyCleanup(memoryData) {
        try {
            this.logger.warn('Executing emergency cleanup procedures');
            
            // Execute aggressive cleanup first
            await this.executeAutoCleanup('aggressive', memoryData);
            
            // Wait and check if emergency cleanup is still needed
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const currentSample = this.pressureMonitor.getLatestSample();
            if (currentSample && currentSample.heap.usagePercent >= this.memoryConfig.thresholds.emergency) {
                // Still in emergency - execute emergency cleanup
                await this.executeAutoCleanup('emergency', memoryData);
            }
            
        } catch (error) {
            this.logger.error('Error executing emergency cleanup', {
                error: error.message,
                stack: error.stack
            });
        }
    }
    
    /**
     * Consider emergency shutdown protection
     */
    async considerEmergencyShutdown(memoryData) {
        if (!this.shutdownProtection.enabled) {
            return;
        }
        
        const now = Date.now();
        
        // Check if we've exceeded maximum attempts
        if (this.shutdownProtection.attempts >= this.shutdownProtection.maxAttempts) {
            this.logger.error('Maximum emergency shutdown attempts reached - system may be unstable');
            return;
        }
        
        // Check cooldown
        if (this.shutdownProtection.lastAttempt && 
            (now - this.shutdownProtection.lastAttempt) < 300000) { // 5 minutes
            return;
        }
        
        this.shutdownProtection.attempts++;
        this.shutdownProtection.lastAttempt = now;
        
        this.logger.error('CRITICAL: Considering emergency shutdown due to extreme memory pressure', {
            heapPercent: memoryData.sample.heap.usagePercent * 100,
            attempt: this.shutdownProtection.attempts,
            maxAttempts: this.shutdownProtection.maxAttempts
        });
        
        // Emit emergency shutdown consideration event
        this.emit('memory:emergency-shutdown-considered', {
            memoryData,
            attempt: this.shutdownProtection.attempts,
            maxAttempts: this.shutdownProtection.maxAttempts
        });
        
        // Give one more chance for cleanup
        await this.executeEmergencyCleanup(memoryData);
        
        // Check if shutdown is still needed
        setTimeout(async () => {
            const latestSample = this.pressureMonitor.getLatestSample();
            if (latestSample && latestSample.heap.usagePercent >= this.shutdownProtection.threshold) {
                this.logger.error('Emergency shutdown protection activated - shutting down non-critical systems');
                await this.emergencyShutdown();
            }
        }, 10000);
    }
    
    /**
     * Emergency shutdown of non-critical systems
     */
    async emergencyShutdown() {
        try {
            this.logger.error('EMERGENCY SHUTDOWN: Shutting down non-critical systems to prevent crash');
            
            // Shut down non-critical components
            const nonCriticalComponents = Array.from(this.componentRegistry.keys())
                .filter(name => !this.criticalComponents.has(name));
            
            for (const componentName of nonCriticalComponents) {
                try {
                    const component = this.componentRegistry.get(componentName);
                    const service = this.services.get(componentName);
                    
                    if (service && typeof service.stop === 'function') {
                        await service.stop();
                        this.componentRestartQueue.set(componentName, Date.now());
                        this.stats.componentShutdowns++;
                        
                        this.logger.warn(`Emergency shutdown of component: ${componentName}`);
                    }
                } catch (error) {
                    this.logger.error(`Error shutting down component: ${componentName}`, {
                        error: error.message
                    });
                }
            }
            
            // Force multiple GC cycles
            if (global.gc) {
                for (let i = 0; i < 5; i++) {
                    global.gc();
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
            
            this.emit('memory:emergency-shutdown-executed', {
                shutdownComponents: nonCriticalComponents.length,
                timestamp: Date.now()
            });
            
            // Schedule component restart check
            setTimeout(() => {
                this.checkComponentRestart();
            }, 60000); // Check after 1 minute
            
        } catch (error) {
            this.logger.error('Error during emergency shutdown', {
                error: error.message,
                stack: error.stack
            });
        }
    }
    
    /**
     * Check if components can be restarted after emergency shutdown
     */
    async checkComponentRestart() {
        const currentSample = this.pressureMonitor.getLatestSample();
        
        if (!currentSample || currentSample.heap.usagePercent > this.memoryConfig.thresholds.warning) {
            this.logger.info('Memory pressure still high - delaying component restart');
            setTimeout(() => this.checkComponentRestart(), 60000);
            return;
        }
        
        // Memory pressure is acceptable - restart components
        this.logger.info('Memory pressure normalized - restarting components');
        
        for (const [componentName, shutdownTime] of this.componentRestartQueue) {
            try {
                const service = this.services.get(componentName);
                if (service && typeof service.start === 'function') {
                    await service.start();
                    this.stats.restarts++;
                    
                    this.logger.info(`Restarted component after emergency shutdown: ${componentName}`);
                }
            } catch (error) {
                this.logger.error(`Error restarting component: ${componentName}`, {
                    error: error.message
                });
            }
        }
        
        this.componentRestartQueue.clear();
        this.emergencyMode = false;
        
        this.emit('memory:components-restarted', {
            restarted: this.stats.restarts,
            timestamp: Date.now()
        });
    }
    
    /**
     * Handle cleanup completion
     */
    async handleCleanupCompleted(result) {
        this.logger.info('Memory cleanup completed', {
            strategy: result.strategy,
            memoryFreedMB: Math.round(result.memoryFreed / 1024 / 1024),
            duration: result.duration,
            actions: result.actions.length
        });
        
        this.emit('memory:cleanup-completed', result);
    }
    
    /**
     * Handle cleanup failure
     */
    async handleCleanupFailed(result) {
        this.logger.error('Memory cleanup failed', {
            strategy: result.strategy,
            errors: result.errors,
            duration: result.duration
        });
        
        this.emit('memory:cleanup-failed', result);
    }
    
    /**
     * Get comprehensive memory statistics
     */
    getMemoryStats() {
        const pressureStats = this.pressureMonitor ? this.pressureMonitor.getPressureStats() : null;
        const cleanupStats = this.cleanupManager ? this.cleanupManager.getCleanupStats() : null;
        
        return {
            system: {
                isInitialized: this.isInitialized,
                isMonitoring: this.isMonitoring,
                currentPressureLevel: this.currentPressureLevel,
                emergencyMode: this.emergencyMode,
                uptime: Date.now() - this.stats.startTime
            },
            pressure: pressureStats,
            cleanup: cleanupStats,
            stats: this.stats,
            config: this.memoryConfig,
            components: {
                registered: this.componentRegistry.size,
                critical: this.criticalComponents.size,
                restartQueue: this.componentRestartQueue.size
            },
            shutdownProtection: {
                ...this.shutdownProtection,
                lastAttempt: this.shutdownProtection.lastAttempt ? 
                    new Date(this.shutdownProtection.lastAttempt).toISOString() : null
            }
        };
    }
    
    /**
     * Get memory history
     */
    getMemoryHistory() {
        return this.pressureMonitor ? this.pressureMonitor.getMemoryHistory() : [];
    }
    
    /**
     * Force cleanup execution
     */
    async forceCleanup(level = 'moderate') {
        const memoryData = this.pressureMonitor ? this.pressureMonitor.getLatestSample() : null;
        return await this.cleanupManager.executeCleanup(level, memoryData);
    }
    
    /**
     * Force garbage collection
     */
    forceGC() {
        return this.pressureMonitor ? this.pressureMonitor.forceGC() : { success: false, reason: 'monitor_not_available' };
    }
    
    /**
     * Shutdown memory management system
     */
    async shutdown() {
        try {
            this.logger.info('Shutting down Memory Management System');
            
            // Stop monitoring
            await this.stopMonitoring();
            
            // Clear timers and intervals
            this.removeAllListeners();
            
            // Clear component registry
            this.componentRegistry.clear();
            this.componentRestartQueue.clear();
            
            this.isInitialized = false;
            this.logger.info('Memory Management System shut down successfully');
            
        } catch (error) {
            this.logger.error('Error shutting down Memory Management System', {
                error: error.message,
                stack: error.stack
            });
        }
    }
}

export default MemoryManager;