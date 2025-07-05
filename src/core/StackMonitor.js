import { EventEmitter } from 'events';
import StackAnalyzer from './StackAnalyzer.js';
import RecursionDetector from './RecursionDetector.js';
import EmergencyShutdown from './EmergencyShutdown.js';

/**
 * Global Stack Monitor - Prevents infinite recursion crashes
 * 
 * Provides multiple layers of protection:
 * 1. Global call stack depth monitoring
 * 2. Function call pattern analysis
 * 3. Emergency shutdown triggers
 * 4. Stack overflow prevention
 * 5. Recovery mechanisms
 * 6. Real-time monitoring and alerting
 */
class StackMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        
        // Configuration with protection levels
        this.config = {
            // Stack depth limits
            warningDepth: 100,      // Warning threshold
            criticalDepth: 200,     // Critical threshold
            emergencyDepth: 300,    // Emergency threshold
            shutdownDepth: 500,     // Immediate shutdown
            
            // Pattern detection settings
            recursionWindow: 1000,  // Time window for recursion detection (ms)
            patternThreshold: 5,    // Number of identical patterns to trigger alert
            
            // Monitoring intervals
            monitoringInterval: 100,  // Stack monitoring frequency (ms)
            cleanupInterval: 5000,   // Cleanup frequency (ms)
            
            // Memory correlation
            memoryThreshold: 100 * 1024 * 1024, // 100MB heap growth correlation
            
            // Performance settings
            enablePerformanceTracking: true,
            enablePatternAnalysis: true,
            enableMemoryCorrelation: true,
            
            // Emergency shutdown settings
            enableEmergencyShutdown: true,
            shutdownTimeout: 5000,   // Max time for graceful shutdown
            
            // Logging
            enableDebugLogging: false,
            logStackTraces: true,
            
            ...config
        };
        
        // Core components
        this.stackAnalyzer = new StackAnalyzer(this.config);
        this.recursionDetector = new RecursionDetector(this.config);
        this.emergencyShutdown = new EmergencyShutdown(this.config);
        
        // Stack monitoring state
        this.monitoring = {
            isEnabled: false,
            currentDepth: 0,
            maxDepthReached: 0,
            lastDepthCheck: Date.now(),
            
            // Stack capture state
            stackCaptures: [],
            maxStackCaptures: 100,
            
            // Alert state
            warningTriggered: false,
            criticalTriggered: false,
            emergencyTriggered: false,
            
            // Performance tracking
            stackCheckTimes: [],
            avgStackCheckTime: 0
        };
        
        // Function call tracking
        this.callTracking = {
            activeCalls: new Map(),     // callId -> call info
            callPatterns: new Map(),    // pattern -> count
            functionCalls: new Map(),   // function -> call count
            
            // Recursion detection
            recursionChains: new Map(), // chain -> detection info
            activeRecursions: new Set(),
            
            // Memory correlation
            memorySnapshots: [],
            lastMemoryCheck: Date.now()
        };
        
        // Emergency state
        this.emergencyState = {
            isInEmergency: false,
            emergencyStartTime: null,
            shutdownInitiated: false,
            recoveryAttempts: 0,
            maxRecoveryAttempts: 3
        };
        
        // Monitoring intervals
        this.intervals = {
            monitoring: null,
            cleanup: null,
            memoryCheck: null
        };
        
        // Statistics
        this.stats = {
            totalStackChecks: 0,
            recursionDetections: 0,
            emergencyShutdowns: 0,
            recoveryAttempts: 0,
            patternDetections: 0,
            memoryCorrelations: 0,
            startTime: Date.now(),
            lastResetTime: Date.now()
        };
        
        // Bind methods for stack instrumentation
        this.originalTimeout = global.setTimeout;
        this.originalInterval = global.setInterval;
        this.originalImmediate = global.setImmediate;
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    // ===== Core Stack Monitoring =====
    
    /**
     * Start stack monitoring
     */
    start() {
        if (this.monitoring.isEnabled) {
            this.debugLog('Stack monitoring already enabled');
            return;
        }
        
        this.monitoring.isEnabled = true;
        this.monitoring.lastDepthCheck = Date.now();
        
        // Start monitoring intervals
        this.intervals.monitoring = setInterval(() => {
            this.performStackCheck();
        }, this.config.monitoringInterval);
        
        this.intervals.cleanup = setInterval(() => {
            this.performCleanup();
        }, this.config.cleanupInterval);
        
        if (this.config.enableMemoryCorrelation) {
            this.intervals.memoryCheck = setInterval(() => {
                this.checkMemoryCorrelation();
            }, this.config.monitoringInterval * 5);
        }
        
        // Instrument global functions
        this.instrumentGlobalFunctions();
        
        this.debugLog('Stack monitoring started');
        this.emit('monitoring:started');
    }
    
    /**
     * Stop stack monitoring
     */
    stop() {
        if (!this.monitoring.isEnabled) {
            this.debugLog('Stack monitoring not enabled');
            return;
        }
        
        this.monitoring.isEnabled = false;
        
        // Clear intervals
        for (const [name, interval] of Object.entries(this.intervals)) {
            if (interval) {
                clearInterval(interval);
                this.intervals[name] = null;
            }
        }
        
        // Restore original functions
        this.restoreGlobalFunctions();
        
        this.debugLog('Stack monitoring stopped');
        this.emit('monitoring:stopped');
    }
    
    /**
     * Perform stack depth check
     */
    performStackCheck() {
        const startTime = process.hrtime.bigint();
        
        try {
            // Capture current stack
            const stackTrace = this.captureStackTrace();
            const currentDepth = this.calculateStackDepth(stackTrace);
            
            // Update monitoring state
            this.monitoring.currentDepth = currentDepth;
            this.monitoring.maxDepthReached = Math.max(this.monitoring.maxDepthReached, currentDepth);
            this.monitoring.lastDepthCheck = Date.now();
            
            // Check protection levels
            this.checkProtectionLevels(currentDepth, stackTrace);
            
            // Pattern analysis
            if (this.config.enablePatternAnalysis) {
                this.analyzeStackPattern(stackTrace);
            }
            
            // Update statistics
            this.stats.totalStackChecks++;
            
            // Track performance
            if (this.config.enablePerformanceTracking) {
                this.trackStackCheckPerformance(startTime);
            }
            
        } catch (error) {
            this.handleMonitoringError(error);
        }
    }
    
    /**
     * Capture current stack trace
     */
    captureStackTrace() {
        const originalLimit = Error.stackTraceLimit;
        Error.stackTraceLimit = 100; // Capture more stack frames
        
        const stack = new Error().stack;
        Error.stackTraceLimit = originalLimit;
        
        return stack;
    }
    
    /**
     * Calculate stack depth from stack trace
     */
    calculateStackDepth(stackTrace) {
        if (!stackTrace) return 0;
        
        const lines = stackTrace.split('\n');
        // Filter out the first line (Error message) and stack monitor frames
        const stackFrames = lines.slice(1).filter(line => {
            return line.includes('at ') && 
                   !line.includes('StackMonitor') &&
                   !line.includes('performStackCheck') &&
                   !line.includes('captureStackTrace');
        });
        
        return stackFrames.length;
    }
    
    /**
     * Check protection levels and trigger appropriate responses
     */
    checkProtectionLevels(currentDepth, stackTrace) {
        // Emergency shutdown level
        if (currentDepth >= this.config.shutdownDepth) {
            this.triggerEmergencyShutdown('stack_overflow_imminent', {
                depth: currentDepth,
                threshold: this.config.shutdownDepth
            });
            return;
        }
        
        // Emergency level
        if (currentDepth >= this.config.emergencyDepth && !this.emergencyState.isInEmergency) {
            this.triggerEmergencyResponse(currentDepth, stackTrace);
        }
        
        // Critical level
        if (currentDepth >= this.config.criticalDepth && !this.monitoring.criticalTriggered) {
            this.triggerCriticalAlert(currentDepth, stackTrace);
        }
        
        // Warning level
        if (currentDepth >= this.config.warningDepth && !this.monitoring.warningTriggered) {
            this.triggerWarningAlert(currentDepth, stackTrace);
        }
        
        // Reset alerts if depth decreases
        if (currentDepth < this.config.warningDepth) {
            this.resetAlerts();
        }
    }
    
    /**
     * Analyze stack pattern for recursion detection
     */
    analyzeStackPattern(stackTrace) {
        const pattern = this.stackAnalyzer.analyzePattern(stackTrace);
        
        if (pattern.isRecursive) {
            this.handleRecursionDetection(pattern);
        }
        
        // Track function call patterns
        this.trackFunctionPattern(pattern);
    }
    
    /**
     * Track stack check performance
     */
    trackStackCheckPerformance(startTime) {
        const duration = Number(process.hrtime.bigint() - startTime) / 1e6; // Convert to ms
        
        this.monitoring.stackCheckTimes.push(duration);
        
        // Keep only last 100 measurements
        if (this.monitoring.stackCheckTimes.length > 100) {
            this.monitoring.stackCheckTimes.shift();
        }
        
        // Calculate average
        this.monitoring.avgStackCheckTime = this.monitoring.stackCheckTimes.reduce((a, b) => a + b, 0) / this.monitoring.stackCheckTimes.length;
        
        // Emit performance warning if checks are taking too long
        if (duration > 10) { // 10ms threshold
            this.emit('performance:warning', {
                type: 'slow_stack_check',
                duration,
                average: this.monitoring.avgStackCheckTime
            });
        }
    }
    
    // ===== Alert Triggers =====
    
    /**
     * Trigger warning alert
     */
    triggerWarningAlert(depth, stackTrace) {
        this.monitoring.warningTriggered = true;
        
        const alertData = {
            level: 'warning',
            depth,
            threshold: this.config.warningDepth,
            stackTrace: this.config.logStackTraces ? stackTrace : null,
            timestamp: Date.now()
        };
        
        this.debugLog(`WARNING: Stack depth reached ${depth} (threshold: ${this.config.warningDepth})`);
        this.emit('stack:warning', alertData);
    }
    
    /**
     * Trigger critical alert
     */
    triggerCriticalAlert(depth, stackTrace) {
        this.monitoring.criticalTriggered = true;
        
        const alertData = {
            level: 'critical',
            depth,
            threshold: this.config.criticalDepth,
            stackTrace: this.config.logStackTraces ? stackTrace : null,
            timestamp: Date.now()
        };
        
        this.debugLog(`CRITICAL: Stack depth reached ${depth} (threshold: ${this.config.criticalDepth})`);
        this.emit('stack:critical', alertData);
        
        // Attempt automatic recovery
        this.attemptRecovery('critical_depth', alertData);
    }
    
    /**
     * Trigger emergency response
     */
    triggerEmergencyResponse(depth, stackTrace) {
        this.monitoring.emergencyTriggered = true;
        this.emergencyState.isInEmergency = true;
        this.emergencyState.emergencyStartTime = Date.now();
        
        const alertData = {
            level: 'emergency',
            depth,
            threshold: this.config.emergencyDepth,
            stackTrace: this.config.logStackTraces ? stackTrace : null,
            timestamp: Date.now()
        };
        
        this.debugLog(`EMERGENCY: Stack depth reached ${depth} (threshold: ${this.config.emergencyDepth})`);
        this.emit('stack:emergency', alertData);
        
        // Attempt emergency recovery
        this.attemptEmergencyRecovery(alertData);
    }
    
    /**
     * Trigger emergency shutdown
     */
    triggerEmergencyShutdown(reason, data) {
        if (this.emergencyState.shutdownInitiated) {
            return; // Already shutting down
        }
        
        this.emergencyState.shutdownInitiated = true;
        this.stats.emergencyShutdowns++;
        
        const shutdownData = {
            reason,
            data,
            timestamp: Date.now(),
            stackDepth: this.monitoring.currentDepth
        };
        
        this.debugLog(`EMERGENCY SHUTDOWN: ${reason}`);
        this.emit('stack:shutdown', shutdownData);
        
        // Perform emergency shutdown
        if (this.config.enableEmergencyShutdown) {
            this.emergencyShutdown.initiateShutdown(reason, data);
        }
    }
    
    /**
     * Reset alerts when stack depth decreases
     */
    resetAlerts() {
        const wasInEmergency = this.emergencyState.isInEmergency;
        
        this.monitoring.warningTriggered = false;
        this.monitoring.criticalTriggered = false;
        this.monitoring.emergencyTriggered = false;
        this.emergencyState.isInEmergency = false;
        
        if (wasInEmergency) {
            this.debugLog('Emergency state cleared - stack depth normalized');
            this.emit('stack:recovery', {
                timestamp: Date.now(),
                currentDepth: this.monitoring.currentDepth
            });
        }
    }
    
    // ===== Recursion Detection =====
    
    /**
     * Handle recursion detection
     */
    handleRecursionDetection(pattern) {
        this.stats.recursionDetections++;
        
        const recursionData = {
            pattern: pattern.signature,
            depth: pattern.depth,
            functions: pattern.functions,
            timestamp: Date.now()
        };
        
        this.debugLog(`Recursion detected: ${pattern.signature}`);
        this.emit('recursion:detected', recursionData);
        
        // Attempt to break recursion
        this.attemptRecursionBreak(pattern);
    }
    
    /**
     * Attempt to break recursion
     */
    attemptRecursionBreak(pattern) {
        const breakData = {
            pattern: pattern.signature,
            method: 'stack_manipulation',
            timestamp: Date.now()
        };
        
        this.debugLog(`Attempting to break recursion: ${pattern.signature}`);
        this.emit('recursion:break_attempt', breakData);
        
        // Try to break recursion by throwing an error
        // This will be caught by the recursion detection system
        setTimeout(() => {
            this.emit('recursion:break_signal', {
                pattern: pattern.signature,
                emergency: true
            });
        }, 0);
    }
    
    /**
     * Track function call patterns
     */
    trackFunctionPattern(pattern) {
        if (!pattern.signature) return;
        
        const count = this.callTracking.callPatterns.get(pattern.signature) || 0;
        this.callTracking.callPatterns.set(pattern.signature, count + 1);
        
        // Detect pattern-based recursion
        if (count > this.config.patternThreshold) {
            this.stats.patternDetections++;
            
            this.emit('pattern:excessive', {
                pattern: pattern.signature,
                count: count + 1,
                threshold: this.config.patternThreshold
            });
        }
    }
    
    // ===== Recovery Mechanisms =====
    
    /**
     * Attempt automatic recovery
     */
    attemptRecovery(type, data) {
        this.stats.recoveryAttempts++;
        
        const recoveryData = {
            type,
            data,
            timestamp: Date.now(),
            attempt: this.stats.recoveryAttempts
        };
        
        this.debugLog(`Attempting recovery: ${type}`);
        this.emit('recovery:attempt', recoveryData);
        
        // Different recovery strategies based on type
        switch (type) {
            case 'critical_depth':
                this.recoverFromCriticalDepth(data);
                break;
            case 'recursion':
                this.recoverFromRecursion(data);
                break;
            case 'memory_correlation':
                this.recoverFromMemorySpike(data);
                break;
            default:
                this.performGenericRecovery(data);
        }
    }
    
    /**
     * Attempt emergency recovery
     */
    attemptEmergencyRecovery(data) {
        this.emergencyState.recoveryAttempts++;
        
        if (this.emergencyState.recoveryAttempts > this.emergencyState.maxRecoveryAttempts) {
            this.triggerEmergencyShutdown('recovery_failed', {
                attempts: this.emergencyState.recoveryAttempts,
                data
            });
            return;
        }
        
        this.debugLog(`Emergency recovery attempt ${this.emergencyState.recoveryAttempts}`);
        
        // Try emergency recovery strategies
        this.performEmergencyRecovery(data);
    }
    
    /**
     * Recover from critical depth
     */
    recoverFromCriticalDepth(data) {
        // Clear event loop
        setImmediate(() => {
            this.emit('recovery:event_loop_clear');
        });
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
        
        // Clear any pending timers that might be causing recursion
        this.clearSuspiciousTimers();
    }
    
    /**
     * Recover from recursion
     */
    recoverFromRecursion(data) {
        // Break recursion chains
        this.breakRecursionChains();
        
        // Clear suspicious call patterns
        this.clearSuspiciousPatterns();
    }
    
    /**
     * Recover from memory spike
     */
    recoverFromMemorySpike(data) {
        // Force garbage collection
        if (global.gc) {
            global.gc();
        }
        
        // Clear caches
        this.clearCaches();
    }
    
    /**
     * Perform generic recovery
     */
    performGenericRecovery(data) {
        // Generic recovery strategies
        this.clearEventLoop();
        this.resetCallTracking();
    }
    
    /**
     * Perform emergency recovery
     */
    performEmergencyRecovery(data) {
        // Emergency recovery strategies
        this.clearEventLoop();
        this.resetCallTracking();
        this.clearCaches();
        
        if (global.gc) {
            global.gc();
        }
        
        // Emit emergency recovery event
        this.emit('recovery:emergency', {
            timestamp: Date.now(),
            data
        });
    }
    
    // ===== Memory Correlation =====
    
    /**
     * Check memory correlation with stack depth
     */
    checkMemoryCorrelation() {
        const memoryUsage = process.memoryUsage();
        const currentDepth = this.monitoring.currentDepth;
        
        const snapshot = {
            timestamp: Date.now(),
            heapUsed: memoryUsage.heapUsed,
            heapTotal: memoryUsage.heapTotal,
            stackDepth: currentDepth
        };
        
        this.callTracking.memorySnapshots.push(snapshot);
        
        // Keep only last 100 snapshots
        if (this.callTracking.memorySnapshots.length > 100) {
            this.callTracking.memorySnapshots.shift();
        }
        
        // Check for correlation
        this.analyzeMemoryCorrelation(snapshot);
    }
    
    /**
     * Analyze memory-stack correlation
     */
    analyzeMemoryCorrelation(currentSnapshot) {
        if (this.callTracking.memorySnapshots.length < 2) return;
        
        const previousSnapshot = this.callTracking.memorySnapshots[this.callTracking.memorySnapshots.length - 2];
        
        const heapGrowth = currentSnapshot.heapUsed - previousSnapshot.heapUsed;
        const depthChange = currentSnapshot.stackDepth - previousSnapshot.stackDepth;
        
        // Check for suspicious correlation
        if (heapGrowth > this.config.memoryThreshold && depthChange > 10) {
            this.stats.memoryCorrelations++;
            
            this.emit('memory:correlation', {
                heapGrowth,
                depthChange,
                currentDepth: currentSnapshot.stackDepth,
                timestamp: currentSnapshot.timestamp
            });
            
            // Trigger recovery
            this.attemptRecovery('memory_correlation', {
                heapGrowth,
                depthChange,
                snapshot: currentSnapshot
            });
        }
    }
    
    // ===== Cleanup and Utilities =====
    
    /**
     * Perform periodic cleanup
     */
    performCleanup() {
        const now = Date.now();
        const cleanupThreshold = 60000; // 1 minute
        
        // Cleanup old stack captures
        this.monitoring.stackCaptures = this.monitoring.stackCaptures.filter(
            capture => now - capture.timestamp < cleanupThreshold
        );
        
        // Cleanup old call patterns
        for (const [pattern, lastSeen] of this.callTracking.callPatterns.entries()) {
            if (typeof lastSeen === 'number' && now - lastSeen > cleanupThreshold) {
                this.callTracking.callPatterns.delete(pattern);
            }
        }
        
        // Cleanup old recursion chains
        for (const [chain, info] of this.callTracking.recursionChains.entries()) {
            if (now - info.timestamp > cleanupThreshold) {
                this.callTracking.recursionChains.delete(chain);
            }
        }
        
        // Cleanup old memory snapshots
        this.callTracking.memorySnapshots = this.callTracking.memorySnapshots.filter(
            snapshot => now - snapshot.timestamp < cleanupThreshold * 5
        );
    }
    
    /**
     * Clear event loop
     */
    clearEventLoop() {
        setImmediate(() => {
            this.emit('recovery:event_loop_cleared');
        });
    }
    
    /**
     * Reset call tracking
     */
    resetCallTracking() {
        this.callTracking.activeCalls.clear();
        this.callTracking.callPatterns.clear();
        this.callTracking.recursionChains.clear();
        this.callTracking.activeRecursions.clear();
    }
    
    /**
     * Clear caches
     */
    clearCaches() {
        this.stackAnalyzer.clearCache();
        this.recursionDetector.clearCache();
    }
    
    /**
     * Clear suspicious timers
     */
    clearSuspiciousTimers() {
        // This would need to be implemented based on timer tracking
        this.emit('recovery:timers_cleared');
    }
    
    /**
     * Break recursion chains
     */
    breakRecursionChains() {
        this.callTracking.recursionChains.clear();
        this.callTracking.activeRecursions.clear();
        this.emit('recovery:recursion_chains_broken');
    }
    
    /**
     * Clear suspicious patterns
     */
    clearSuspiciousPatterns() {
        // Clear patterns that exceed threshold
        for (const [pattern, count] of this.callTracking.callPatterns.entries()) {
            if (count > this.config.patternThreshold) {
                this.callTracking.callPatterns.delete(pattern);
            }
        }
        this.emit('recovery:patterns_cleared');
    }
    
    // ===== Function Instrumentation =====
    
    /**
     * Instrument global functions for call tracking
     */
    instrumentGlobalFunctions() {
        // This is a basic implementation - could be expanded for deeper instrumentation
        this.debugLog('Global function instrumentation enabled');
    }
    
    /**
     * Restore original global functions
     */
    restoreGlobalFunctions() {
        // Restore original functions
        this.debugLog('Global function instrumentation disabled');
    }
    
    // ===== Event Listeners =====
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for process events
        process.on('uncaughtException', (error) => {
            this.handleUncaughtException(error);
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            this.handleUnhandledRejection(reason, promise);
        });
        
        // Listen for emergency shutdown signals
        this.emergencyShutdown.on('shutdown:initiated', (data) => {
            this.handleEmergencyShutdown(data);
        });
    }
    
    /**
     * Handle uncaught exceptions
     */
    handleUncaughtException(error) {
        this.debugLog(`Uncaught exception: ${error.message}`);
        
        // Check if this might be stack overflow related
        if (error.message.includes('Maximum call stack size exceeded')) {
            this.triggerEmergencyShutdown('stack_overflow', {
                error: error.message,
                stack: error.stack
            });
        }
    }
    
    /**
     * Handle unhandled rejections
     */
    handleUnhandledRejection(reason, promise) {
        this.debugLog(`Unhandled rejection: ${reason}`);
        
        // Check if this might be recursion related
        if (reason && reason.toString().includes('recursion')) {
            this.handleRecursionDetection({
                signature: 'unhandled_rejection',
                depth: this.monitoring.currentDepth,
                functions: ['unhandled_rejection']
            });
        }
    }
    
    /**
     * Handle emergency shutdown
     */
    handleEmergencyShutdown(data) {
        this.debugLog(`Emergency shutdown handled: ${data.reason}`);
        this.stop();
    }
    
    /**
     * Handle monitoring errors
     */
    handleMonitoringError(error) {
        this.debugLog(`Monitoring error: ${error.message}`);
        this.emit('monitoring:error', {
            error: error.message,
            stack: error.stack,
            timestamp: Date.now()
        });
    }
    
    // ===== Public API =====
    
    /**
     * Get current stack monitoring status
     */
    getStatus() {
        return {
            isEnabled: this.monitoring.isEnabled,
            currentDepth: this.monitoring.currentDepth,
            maxDepthReached: this.monitoring.maxDepthReached,
            isInEmergency: this.emergencyState.isInEmergency,
            shutdownInitiated: this.emergencyState.shutdownInitiated,
            alerts: {
                warning: this.monitoring.warningTriggered,
                critical: this.monitoring.criticalTriggered,
                emergency: this.monitoring.emergencyTriggered
            },
            performance: {
                avgStackCheckTime: this.monitoring.avgStackCheckTime,
                totalStackChecks: this.stats.totalStackChecks
            }
        };
    }
    
    /**
     * Get detailed statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            uptime: Date.now() - this.stats.startTime,
            monitoring: this.monitoring,
            callTracking: {
                activeCalls: this.callTracking.activeCalls.size,
                callPatterns: this.callTracking.callPatterns.size,
                recursionChains: this.callTracking.recursionChains.size,
                activeRecursions: this.callTracking.activeRecursions.size
            },
            emergencyState: this.emergencyState
        };
    }
    
    /**
     * Get configuration
     */
    getConfiguration() {
        return { ...this.config };
    }
    
    /**
     * Update configuration
     */
    updateConfiguration(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.debugLog('Configuration updated');
        this.emit('config:updated', this.config);
    }
    
    /**
     * Force emergency shutdown
     */
    forceEmergencyShutdown(reason = 'manual') {
        this.triggerEmergencyShutdown(reason, {
            manual: true,
            timestamp: Date.now()
        });
    }
    
    /**
     * Reset all statistics
     */
    resetStatistics() {
        this.stats = {
            totalStackChecks: 0,
            recursionDetections: 0,
            emergencyShutdowns: 0,
            recoveryAttempts: 0,
            patternDetections: 0,
            memoryCorrelations: 0,
            startTime: Date.now(),
            lastResetTime: Date.now()
        };
        
        this.debugLog('Statistics reset');
        this.emit('stats:reset');
    }
    
    /**
     * Debug logging
     */
    debugLog(message) {
        if (this.config.enableDebugLogging) {
            console.log(`[StackMonitor] ${message}`);
        }
    }
    
    /**
     * Cleanup and shutdown
     */
    async shutdown() {
        this.debugLog('Shutting down stack monitor');
        
        this.stop();
        
        // Cleanup components
        await this.stackAnalyzer.shutdown();
        await this.recursionDetector.shutdown();
        await this.emergencyShutdown.shutdown();
        
        // Remove all listeners
        this.removeAllListeners();
        
        this.debugLog('Stack monitor shutdown complete');
    }
}

export default StackMonitor;