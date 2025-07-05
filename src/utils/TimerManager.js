/**
 * Global Timer Manager - Comprehensive timer leak detection and cleanup
 * Monitors all timers across the application and provides emergency cleanup
 */

export class TimerManager {
    constructor(logger) {
        this.logger = logger || console;
        this.timers = new Map(); // Global timer registry
        this.components = new Map(); // Registered components
        this.isShuttingDown = false;
        this.monitoringInterval = null;
        this.leakDetectionInterval = null;
        
        // Configuration
        this.config = {
            monitorInterval: 30000, // 30 seconds
            leakDetectionInterval: 60000, // 1 minute
            maxTimersPerComponent: 50,
            maxTotalTimers: 500,
            alertThreshold: 100,
            leakAgeThreshold: 5 * 60 * 1000 // 5 minutes
        };
        
        // Statistics
        this.stats = {
            totalTimersCreated: 0,
            totalTimersCleared: 0,
            leaksDetected: 0,
            emergencyCleanups: 0,
            lastLeakCheck: null
        };
        
        // Bind methods
        this.boundEmergencyCleanup = this.emergencyCleanup.bind(this);
        this.boundGracefulShutdown = this.gracefulShutdown.bind(this);
        
        // Process event handlers
        process.on('SIGINT', this.boundGracefulShutdown);
        process.on('SIGTERM', this.boundGracefulShutdown);
        process.on('exit', this.boundEmergencyCleanup);
        process.on('uncaughtException', this.boundEmergencyCleanup);
        process.on('unhandledRejection', this.boundEmergencyCleanup);
        
        this.logger.info('TimerManager initialized with global monitoring');
    }
    
    /**
     * Register a component for timer monitoring
     */
    registerComponent(componentName, component) {
        if (this.components.has(componentName)) {
            this.logger.warn(`Component ${componentName} already registered, updating...`);
        }
        
        this.components.set(componentName, {
            instance: component,
            registeredAt: Date.now(),
            lastChecked: null,
            timerCount: 0,
            leakCount: 0
        });
        
        this.logger.debug(`Registered component: ${componentName}`);
    }
    
    /**
     * Unregister a component
     */
    unregisterComponent(componentName) {
        if (this.components.has(componentName)) {
            this.components.delete(componentName);
            this.logger.debug(`Unregistered component: ${componentName}`);
        }
    }
    
    /**
     * Track a timer globally
     */
    trackTimer(timerId, info) {
        this.timers.set(timerId, {
            ...info,
            trackedAt: Date.now()
        });
        this.stats.totalTimersCreated++;
    }
    
    /**
     * Untrack a timer
     */
    untrackTimer(timerId) {
        if (this.timers.has(timerId)) {
            this.timers.delete(timerId);
            this.stats.totalTimersCleared++;
            return true;
        }
        return false;
    }
    
    /**
     * Start monitoring timers across all components
     */
    startMonitoring() {
        if (this.monitoringInterval) {
            this.logger.warn('Timer monitoring already started');
            return;
        }
        
        // Start periodic monitoring
        this.monitoringInterval = setInterval(() => {
            if (!this.isShuttingDown) {
                this.performMonitoringCheck();
            }
        }, this.config.monitorInterval);
        
        // Start leak detection
        this.leakDetectionInterval = setInterval(() => {
            if (!this.isShuttingDown) {
                this.detectAndReportLeaks();
            }
        }, this.config.leakDetectionInterval);
        
        this.logger.info('Timer monitoring started');
    }
    
    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        
        if (this.leakDetectionInterval) {
            clearInterval(this.leakDetectionInterval);
            this.leakDetectionInterval = null;
        }
        
        this.logger.info('Timer monitoring stopped');
    }
    
    /**
     * Perform comprehensive monitoring check
     */
    performMonitoringCheck() {
        try {
            const now = Date.now();
            let totalTimers = 0;
            const componentStats = [];
            
            // Check each registered component
            for (const [name, info] of this.components) {
                const component = info.instance;
                let componentTimerCount = 0;
                
                // Try to get timer stats from component
                if (typeof component.getTimerStats === 'function') {
                    try {
                        const timerStats = component.getTimerStats();
                        componentTimerCount = (timerStats.activeTimeouts || 0) + 
                                           (timerStats.activeIntervals || 0);
                        
                        componentStats.push({
                            name,
                            timers: componentTimerCount,
                            stats: timerStats
                        });
                    } catch (error) {
                        this.logger.warn(`Error getting timer stats from ${name}:`, error.message);
                    }
                }
                
                totalTimers += componentTimerCount;
                info.lastChecked = now;
                info.timerCount = componentTimerCount;
            }
            
            // Add globally tracked timers
            totalTimers += this.timers.size;
            
            // Check for concerning timer counts
            if (totalTimers > this.config.alertThreshold) {
                this.logger.warn(`High timer count detected: ${totalTimers} active timers`);
                this.logger.warn('Component breakdown:', componentStats);
            }
            
            if (totalTimers > this.config.maxTotalTimers) {
                this.logger.error(`CRITICAL: Timer count exceeded maximum (${totalTimers}/${this.config.maxTotalTimers})`);
                this.triggerEmergencyCleanup('excessive_timer_count');
            }
            
            // Debug logging every 5th check
            if (Math.random() < 0.2) {
                this.logger.debug(`Timer monitoring: ${totalTimers} total timers across ${this.components.size} components`);
            }
            
        } catch (error) {
            this.logger.error('Error during timer monitoring check:', error);
        }
    }
    
    /**
     * Detect and report timer leaks
     */
    detectAndReportLeaks() {
        try {
            this.stats.lastLeakCheck = Date.now();
            const allLeaks = [];
            
            // Check each component for leaks
            for (const [name, info] of this.components) {
                const component = info.instance;
                
                if (typeof component.detectTimerLeaks === 'function') {
                    try {
                        const leaks = component.detectTimerLeaks();
                        if (leaks && leaks.length > 0) {
                            allLeaks.push({
                                component: name,
                                leaks: leaks
                            });
                            info.leakCount += leaks.length;
                        }
                    } catch (error) {
                        this.logger.warn(`Error detecting leaks in ${name}:`, error.message);
                    }
                }
                
                // Check for excessive timers per component
                if (info.timerCount > this.config.maxTimersPerComponent) {
                    allLeaks.push({
                        component: name,
                        leaks: [{
                            type: 'excessive_component_timers',
                            count: info.timerCount,
                            threshold: this.config.maxTimersPerComponent
                        }]
                    });
                }
            }
            
            // Check globally tracked timers
            const globalLeaks = this.detectGlobalTimerLeaks();
            if (globalLeaks.length > 0) {
                allLeaks.push({
                    component: 'global',
                    leaks: globalLeaks
                });
            }
            
            // Report leaks
            if (allLeaks.length > 0) {
                this.stats.leaksDetected += allLeaks.reduce((sum, item) => sum + item.leaks.length, 0);
                this.logger.warn('Timer leaks detected:', allLeaks);
                
                // Trigger emergency cleanup if critical leaks detected
                const criticalLeaks = allLeaks.some(item => 
                    item.leaks.some(leak => 
                        leak.type === 'excessive_component_timers' || 
                        leak.type === 'excessive_timeouts' ||
                        leak.type === 'excessive_intervals'
                    )
                );
                
                if (criticalLeaks) {
                    this.triggerEmergencyCleanup('critical_leaks_detected');
                }
            }
            
        } catch (error) {
            this.logger.error('Error during leak detection:', error);
        }
    }
    
    /**
     * Detect leaks in globally tracked timers
     */
    detectGlobalTimerLeaks() {
        const leaks = [];
        const now = Date.now();
        
        // Check for old timers
        for (const [timerId, info] of this.timers) {
            const age = now - info.trackedAt;
            if (age > this.config.leakAgeThreshold) {
                leaks.push({
                    type: 'stale_global_timer',
                    timerId,
                    age,
                    info
                });
            }
        }
        
        return leaks;
    }
    
    /**
     * Trigger emergency cleanup
     */
    triggerEmergencyCleanup(reason) {
        this.logger.error(`Triggering emergency timer cleanup - Reason: ${reason}`);
        this.stats.emergencyCleanups++;
        
        // Cleanup all registered components
        for (const [name, info] of this.components) {
            const component = info.instance;
            
            if (typeof component.cleanup === 'function') {
                try {
                    this.logger.warn(`Emergency cleanup for component: ${name}`);
                    component.cleanup();
                } catch (error) {
                    this.logger.error(`Error during emergency cleanup of ${name}:`, error);
                }
            }
        }
        
        // Clear globally tracked timers
        this.clearGlobalTimers();
    }
    
    /**
     * Clear all globally tracked timers
     */
    clearGlobalTimers() {
        this.logger.warn(`Clearing ${this.timers.size} globally tracked timers`);
        
        for (const [timerId, info] of this.timers) {
            try {
                if (info.type === 'timeout') {
                    clearTimeout(timerId);
                } else if (info.type === 'interval') {
                    clearInterval(timerId);
                }
            } catch (error) {
                this.logger.error(`Error clearing timer ${timerId}:`, error);
            }
        }
        
        this.timers.clear();
    }
    
    /**
     * Emergency cleanup for process shutdown
     */
    emergencyCleanup() {
        if (this.isShuttingDown) return;
        
        this.logger.warn('TimerManager: Emergency cleanup initiated');
        this.isShuttingDown = true;
        
        this.stopMonitoring();
        this.triggerEmergencyCleanup('process_shutdown');
        
        this.logger.warn('TimerManager: Emergency cleanup completed');
    }
    
    /**
     * Graceful shutdown
     */
    async gracefulShutdown() {
        if (this.isShuttingDown) return;
        
        this.logger.info('TimerManager: Graceful shutdown initiated');
        this.isShuttingDown = true;
        
        // Stop monitoring
        this.stopMonitoring();
        
        // Give components time to clean up
        this.logger.info('Allowing components 5 seconds for graceful cleanup...');
        
        const shutdownPromise = new Promise((resolve) => {
            setTimeout(() => {
                this.triggerEmergencyCleanup('graceful_shutdown_timeout');
                resolve();
            }, 5000);
        });
        
        // Try graceful cleanup first
        for (const [name, info] of this.components) {
            const component = info.instance;
            
            if (typeof component.stop === 'function') {
                try {
                    this.logger.debug(`Graceful shutdown for component: ${name}`);
                    await component.stop();
                } catch (error) {
                    this.logger.error(`Error during graceful shutdown of ${name}:`, error);
                }
            }
        }
        
        await shutdownPromise;
        
        // Remove process listeners
        process.removeListener('SIGINT', this.boundGracefulShutdown);
        process.removeListener('SIGTERM', this.boundGracefulShutdown);
        process.removeListener('exit', this.boundEmergencyCleanup);
        process.removeListener('uncaughtException', this.boundEmergencyCleanup);
        process.removeListener('unhandledRejection', this.boundEmergencyCleanup);
        
        this.logger.info('TimerManager: Graceful shutdown completed');
    }
    
    /**
     * Get comprehensive statistics
     */
    getStats() {
        const componentStats = Array.from(this.components.entries()).map(([name, info]) => ({
            name,
            registeredAt: info.registeredAt,
            lastChecked: info.lastChecked,
            timerCount: info.timerCount,
            leakCount: info.leakCount,
            hasTimerSupport: typeof info.instance.getTimerStats === 'function',
            hasLeakDetection: typeof info.instance.detectTimerLeaks === 'function',
            hasCleanup: typeof info.instance.cleanup === 'function'
        }));
        
        return {
            ...this.stats,
            globalTimers: this.timers.size,
            registeredComponents: this.components.size,
            isMonitoring: !!this.monitoringInterval,
            isShuttingDown: this.isShuttingDown,
            config: this.config,
            components: componentStats
        };
    }
    
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.logger.info('TimerManager configuration updated:', this.config);
    }
    
    /**
     * Manual leak detection run
     */
    runLeakDetection() {
        this.logger.info('Running manual leak detection...');
        this.detectAndReportLeaks();
    }
}

// Global singleton instance
let globalTimerManager = null;

/**
 * Get or create the global timer manager instance
 */
export function getGlobalTimerManager(logger) {
    if (!globalTimerManager) {
        globalTimerManager = new TimerManager(logger);
    }
    return globalTimerManager;
}

/**
 * Initialize global timer monitoring
 */
export function initializeGlobalTimerMonitoring(logger, config = {}) {
    const manager = getGlobalTimerManager(logger);
    manager.updateConfig(config);
    manager.startMonitoring();
    return manager;
}

export default TimerManager;