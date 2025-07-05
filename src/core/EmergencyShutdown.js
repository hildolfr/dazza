import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

/**
 * Emergency Shutdown System - Safe shutdown mechanisms with graceful recovery
 * 
 * Provides comprehensive emergency shutdown capabilities:
 * 1. Graceful shutdown with timeout
 * 2. Force shutdown for critical situations
 * 3. State preservation during shutdown
 * 4. Recovery mechanisms after shutdown
 * 5. Component isolation and restart
 * 6. Resource cleanup and management
 */
class EmergencyShutdown extends EventEmitter {
    constructor(config = {}) {
        super();
        
        // Configuration
        this.config = {
            // Shutdown timeouts
            gracefulTimeout: 5000,      // Time for graceful shutdown
            forceTimeout: 2000,         // Time for force shutdown
            componentTimeout: 1000,     // Time per component shutdown
            
            // Recovery settings
            enableRecovery: true,       // Enable automatic recovery
            recoveryDelay: 5000,        // Delay before recovery attempt
            maxRecoveryAttempts: 3,     // Maximum recovery attempts
            
            // State preservation
            saveState: true,            // Save state during shutdown
            stateDirectory: 'data/emergency-state',
            
            // Isolation settings
            enableIsolation: true,      // Enable component isolation
            isolationTimeout: 2000,     // Time for isolation
            
            // Process management
            exitOnShutdown: false,      // Exit process on shutdown
            exitCode: 1,                // Exit code for emergency shutdown
            
            // Logging
            enableDebugLogging: false,
            logShutdownSteps: true,
            
            ...config
        };
        
        // Shutdown state
        this.shutdown = {
            isShuttingDown: false,
            shutdownStartTime: null,
            shutdownReason: null,
            shutdownData: null,
            phase: 'idle',              // idle, graceful, force, complete
            
            // Component tracking
            components: new Map(),       // component -> shutdown status
            completedComponents: new Set(),
            failedComponents: new Set(),
            
            // Recovery state
            recoveryAttempts: 0,
            lastRecoveryAttempt: null,
            recoveryInProgress: false
        };
        
        // Component registry
        this.components = new Map();    // component -> shutdown handler
        this.componentPriorities = new Map(); // component -> priority (lower = higher priority)
        
        // Resource tracking
        this.resources = {
            timers: new Set(),          // Timer IDs to clear
            intervals: new Set(),       // Interval IDs to clear
            connections: new Set(),     // Connection objects to close
            streams: new Set(),         // Stream objects to close
            databases: new Set(),       // Database connections to close
            servers: new Set(),         // Server instances to close
            processes: new Set(),       // Child processes to terminate
            
            // Custom cleanup functions
            cleanupFunctions: new Map() // name -> cleanup function
        };
        
        // Recovery mechanisms
        this.recovery = {
            strategies: new Map(),      // strategy -> recovery function
            componentRecovery: new Map(), // component -> recovery function
            stateRecovery: new Map(),   // state type -> recovery function
            
            // Recovery statistics
            attempts: 0,
            successes: 0,
            failures: 0
        };
        
        // Statistics
        this.stats = {
            totalShutdowns: 0,
            gracefulShutdowns: 0,
            forceShutdowns: 0,
            failedShutdowns: 0,
            recoveryAttempts: 0,
            successfulRecoveries: 0,
            startTime: Date.now()
        };
        
        // Bind process events
        this.bindProcessEvents();
        
        // Initialize state directory
        this.initializeStateDirectory();
    }
    
    // ===== Core Shutdown Methods =====
    
    /**
     * Initiate emergency shutdown
     */
    async initiateShutdown(reason, data = {}) {
        if (this.shutdown.isShuttingDown) {
            this.debugLog('Shutdown already in progress');
            return;
        }
        
        this.shutdown.isShuttingDown = true;
        this.shutdown.shutdownStartTime = Date.now();
        this.shutdown.shutdownReason = reason;
        this.shutdown.shutdownData = data;
        this.shutdown.phase = 'graceful';
        
        this.stats.totalShutdowns++;
        
        this.debugLog(`Emergency shutdown initiated: ${reason}`);
        this.emit('shutdown:initiated', {
            reason,
            data,
            timestamp: this.shutdown.shutdownStartTime
        });
        
        try {
            // Attempt graceful shutdown first
            const gracefulSuccess = await this.performGracefulShutdown();
            
            if (gracefulSuccess) {
                this.stats.gracefulShutdowns++;
                this.debugLog('Graceful shutdown completed successfully');
                this.completeShutdown('graceful');
            } else {
                this.debugLog('Graceful shutdown failed, initiating force shutdown');
                await this.performForceShutdown();
            }
            
        } catch (error) {
            this.handleShutdownError(error);
            await this.performForceShutdown();
        }
    }
    
    /**
     * Perform graceful shutdown
     */
    async performGracefulShutdown() {
        this.shutdown.phase = 'graceful';
        
        this.debugLog('Starting graceful shutdown');
        this.emit('shutdown:graceful_start');
        
        // Set timeout for graceful shutdown
        const gracefulTimeout = setTimeout(() => {
            this.debugLog('Graceful shutdown timeout reached');
            this.emit('shutdown:graceful_timeout');
        }, this.config.gracefulTimeout);
        
        try {
            // Save state if enabled
            if (this.config.saveState) {
                await this.saveEmergencyState();
            }
            
            // Shutdown components in priority order
            const success = await this.shutdownComponents();
            
            // Cleanup resources
            await this.cleanupResources();
            
            clearTimeout(gracefulTimeout);
            
            if (success) {
                this.emit('shutdown:graceful_complete');
                return true;
            } else {
                this.emit('shutdown:graceful_failed');
                return false;
            }
            
        } catch (error) {
            clearTimeout(gracefulTimeout);
            this.handleShutdownError(error);
            return false;
        }
    }
    
    /**
     * Perform force shutdown
     */
    async performForceShutdown() {
        this.shutdown.phase = 'force';
        this.stats.forceShutdowns++;
        
        this.debugLog('Starting force shutdown');
        this.emit('shutdown:force_start');
        
        // Set timeout for force shutdown
        const forceTimeout = setTimeout(() => {
            this.debugLog('Force shutdown timeout reached, terminating immediately');
            this.terminateImmediately();
        }, this.config.forceTimeout);
        
        try {
            // Force stop all components
            await this.forceStopComponents();
            
            // Force cleanup all resources
            await this.forceCleanupResources();
            
            clearTimeout(forceTimeout);
            
            this.emit('shutdown:force_complete');
            this.completeShutdown('force');
            
        } catch (error) {
            clearTimeout(forceTimeout);
            this.handleShutdownError(error);
            this.terminateImmediately();
        }
    }
    
    /**
     * Complete shutdown process
     */
    completeShutdown(type) {
        this.shutdown.phase = 'complete';
        
        const duration = Date.now() - this.shutdown.shutdownStartTime;
        
        this.debugLog(`Shutdown completed (${type}) in ${duration}ms`);
        this.emit('shutdown:complete', {
            type,
            duration,
            reason: this.shutdown.shutdownReason,
            data: this.shutdown.shutdownData
        });
        
        // Schedule recovery if enabled
        if (this.config.enableRecovery && !this.config.exitOnShutdown) {
            this.scheduleRecovery();
        }
        
        // Exit process if configured
        if (this.config.exitOnShutdown) {
            this.debugLog(`Exiting process with code ${this.config.exitCode}`);
            process.exit(this.config.exitCode);
        }
    }
    
    /**
     * Terminate immediately
     */
    terminateImmediately() {
        this.stats.failedShutdowns++;
        
        this.debugLog('Immediate termination initiated');
        this.emit('shutdown:immediate');
        
        // Force cleanup critical resources
        this.forceCleanupCriticalResources();
        
        // Exit process
        process.exit(this.config.exitCode);
    }
    
    // ===== Component Management =====
    
    /**
     * Register component for shutdown
     */
    registerComponent(name, shutdownHandler, priority = 10) {
        this.components.set(name, shutdownHandler);
        this.componentPriorities.set(name, priority);
        
        this.debugLog(`Component registered: ${name} (priority: ${priority})`);
        this.emit('component:registered', { name, priority });
    }
    
    /**
     * Unregister component
     */
    unregisterComponent(name) {
        this.components.delete(name);
        this.componentPriorities.delete(name);
        
        this.debugLog(`Component unregistered: ${name}`);
        this.emit('component:unregistered', { name });
    }
    
    /**
     * Shutdown all components
     */
    async shutdownComponents() {
        const sortedComponents = this.getSortedComponents();
        let allSuccessful = true;
        
        for (const [name, handler] of sortedComponents) {
            try {
                this.debugLog(`Shutting down component: ${name}`);
                this.emit('component:shutdown_start', { name });
                
                // Set timeout for component shutdown
                const componentTimeout = setTimeout(() => {
                    this.debugLog(`Component shutdown timeout: ${name}`);
                    this.emit('component:shutdown_timeout', { name });
                }, this.config.componentTimeout);
                
                await handler();
                
                clearTimeout(componentTimeout);
                
                this.shutdown.completedComponents.add(name);
                this.debugLog(`Component shutdown completed: ${name}`);
                this.emit('component:shutdown_complete', { name });
                
            } catch (error) {
                this.shutdown.failedComponents.add(name);
                this.debugLog(`Component shutdown failed: ${name} - ${error.message}`);
                this.emit('component:shutdown_failed', { name, error: error.message });
                allSuccessful = false;
            }
        }
        
        return allSuccessful;
    }
    
    /**
     * Force stop all components
     */
    async forceStopComponents() {
        const sortedComponents = this.getSortedComponents();
        
        // Run all component shutdowns in parallel for force shutdown
        const shutdownPromises = sortedComponents.map(async ([name, handler]) => {
            try {
                this.debugLog(`Force stopping component: ${name}`);
                await Promise.race([
                    handler(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Force timeout')), 500)
                    )
                ]);
                
                this.shutdown.completedComponents.add(name);
                this.debugLog(`Component force stopped: ${name}`);
                
            } catch (error) {
                this.shutdown.failedComponents.add(name);
                this.debugLog(`Component force stop failed: ${name} - ${error.message}`);
            }
        });
        
        await Promise.allSettled(shutdownPromises);
    }
    
    /**
     * Get components sorted by priority
     */
    getSortedComponents() {
        const componentArray = Array.from(this.components.entries());
        
        // Sort by priority (lower number = higher priority)
        return componentArray.sort((a, b) => {
            const priorityA = this.componentPriorities.get(a[0]) || 10;
            const priorityB = this.componentPriorities.get(b[0]) || 10;
            return priorityA - priorityB;
        });
    }
    
    // ===== Resource Management =====
    
    /**
     * Register resource for cleanup
     */
    registerResource(type, resource) {
        if (this.resources[type]) {
            this.resources[type].add(resource);
            this.debugLog(`Resource registered: ${type}`);
        } else {
            this.debugLog(`Unknown resource type: ${type}`);
        }
    }
    
    /**
     * Register cleanup function
     */
    registerCleanupFunction(name, cleanupFunction) {
        this.resources.cleanupFunctions.set(name, cleanupFunction);
        this.debugLog(`Cleanup function registered: ${name}`);
    }
    
    /**
     * Cleanup all resources
     */
    async cleanupResources() {
        this.debugLog('Starting resource cleanup');
        
        // Clear timers
        for (const timerId of this.resources.timers) {
            clearTimeout(timerId);
        }
        this.resources.timers.clear();
        
        // Clear intervals
        for (const intervalId of this.resources.intervals) {
            clearInterval(intervalId);
        }
        this.resources.intervals.clear();
        
        // Close connections
        for (const connection of this.resources.connections) {
            try {
                if (connection.close) {
                    await connection.close();
                } else if (connection.end) {
                    connection.end();
                }
            } catch (error) {
                this.debugLog(`Failed to close connection: ${error.message}`);
            }
        }
        this.resources.connections.clear();
        
        // Close streams
        for (const stream of this.resources.streams) {
            try {
                if (stream.destroy) {
                    stream.destroy();
                } else if (stream.end) {
                    stream.end();
                }
            } catch (error) {
                this.debugLog(`Failed to close stream: ${error.message}`);
            }
        }
        this.resources.streams.clear();
        
        // Close databases
        for (const database of this.resources.databases) {
            try {
                if (database.close) {
                    await database.close();
                }
            } catch (error) {
                this.debugLog(`Failed to close database: ${error.message}`);
            }
        }
        this.resources.databases.clear();
        
        // Close servers
        for (const server of this.resources.servers) {
            try {
                if (server.close) {
                    await new Promise((resolve, reject) => {
                        server.close((err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                }
            } catch (error) {
                this.debugLog(`Failed to close server: ${error.message}`);
            }
        }
        this.resources.servers.clear();
        
        // Terminate processes
        for (const process of this.resources.processes) {
            try {
                if (process.kill) {
                    process.kill('SIGTERM');
                }
            } catch (error) {
                this.debugLog(`Failed to terminate process: ${error.message}`);
            }
        }
        this.resources.processes.clear();
        
        // Run custom cleanup functions
        for (const [name, cleanupFunction] of this.resources.cleanupFunctions) {
            try {
                this.debugLog(`Running cleanup function: ${name}`);
                await cleanupFunction();
            } catch (error) {
                this.debugLog(`Cleanup function failed: ${name} - ${error.message}`);
            }
        }
        
        this.debugLog('Resource cleanup completed');
    }
    
    /**
     * Force cleanup resources
     */
    async forceCleanupResources() {
        this.debugLog('Starting force resource cleanup');
        
        // Force cleanup with shorter timeouts
        const cleanupPromises = [
            this.forceCleanupTimers(),
            this.forceCleanupConnections(),
            this.forceCleanupStreams(),
            this.forceCleanupDatabases(),
            this.forceCleanupServers(),
            this.forceCleanupProcesses()
        ];
        
        await Promise.allSettled(cleanupPromises);
        
        this.debugLog('Force resource cleanup completed');
    }
    
    /**
     * Force cleanup critical resources
     */
    forceCleanupCriticalResources() {
        this.debugLog('Force cleanup of critical resources');
        
        // Clear all timers synchronously
        for (const timerId of this.resources.timers) {
            clearTimeout(timerId);
        }
        for (const intervalId of this.resources.intervals) {
            clearInterval(intervalId);
        }
        
        // Force terminate processes
        for (const process of this.resources.processes) {
            try {
                if (process.kill) {
                    process.kill('SIGKILL');
                }
            } catch (error) {
                // Ignore errors during force cleanup
            }
        }
    }
    
    // ===== Force Cleanup Helpers =====
    
    async forceCleanupTimers() {
        for (const timerId of this.resources.timers) {
            clearTimeout(timerId);
        }
        for (const intervalId of this.resources.intervals) {
            clearInterval(intervalId);
        }
        this.resources.timers.clear();
        this.resources.intervals.clear();
    }
    
    async forceCleanupConnections() {
        const cleanupPromises = Array.from(this.resources.connections).map(async (connection) => {
            try {
                if (connection.destroy) {
                    connection.destroy();
                } else if (connection.end) {
                    connection.end();
                }
            } catch (error) {
                // Ignore errors during force cleanup
            }
        });
        
        await Promise.allSettled(cleanupPromises);
        this.resources.connections.clear();
    }
    
    async forceCleanupStreams() {
        for (const stream of this.resources.streams) {
            try {
                if (stream.destroy) {
                    stream.destroy();
                }
            } catch (error) {
                // Ignore errors during force cleanup
            }
        }
        this.resources.streams.clear();
    }
    
    async forceCleanupDatabases() {
        const cleanupPromises = Array.from(this.resources.databases).map(async (database) => {
            try {
                if (database.close) {
                    await Promise.race([
                        database.close(),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Database cleanup timeout')), 1000)
                        )
                    ]);
                }
            } catch (error) {
                // Ignore errors during force cleanup
            }
        });
        
        await Promise.allSettled(cleanupPromises);
        this.resources.databases.clear();
    }
    
    async forceCleanupServers() {
        const cleanupPromises = Array.from(this.resources.servers).map(async (server) => {
            try {
                if (server.close) {
                    await Promise.race([
                        new Promise((resolve, reject) => {
                            server.close((err) => {
                                if (err) reject(err);
                                else resolve();
                            });
                        }),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Server cleanup timeout')), 1000)
                        )
                    ]);
                }
            } catch (error) {
                // Ignore errors during force cleanup
            }
        });
        
        await Promise.allSettled(cleanupPromises);
        this.resources.servers.clear();
    }
    
    async forceCleanupProcesses() {
        for (const process of this.resources.processes) {
            try {
                if (process.kill) {
                    process.kill('SIGKILL');
                }
            } catch (error) {
                // Ignore errors during force cleanup
            }
        }
        this.resources.processes.clear();
    }
    
    // ===== State Management =====
    
    /**
     * Save emergency state
     */
    async saveEmergencyState() {
        if (!this.config.saveState) return;
        
        this.debugLog('Saving emergency state');
        
        const state = {
            timestamp: Date.now(),
            shutdownReason: this.shutdown.shutdownReason,
            shutdownData: this.shutdown.shutdownData,
            components: Array.from(this.components.keys()),
            completedComponents: Array.from(this.shutdown.completedComponents),
            failedComponents: Array.from(this.shutdown.failedComponents),
            stats: this.stats
        };
        
        try {
            await fs.mkdir(this.config.stateDirectory, { recursive: true });
            
            const stateFile = path.join(this.config.stateDirectory, 'emergency-state.json');
            await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
            
            this.debugLog('Emergency state saved');
            this.emit('state:saved', { file: stateFile });
            
        } catch (error) {
            this.debugLog(`Failed to save emergency state: ${error.message}`);
            this.emit('state:save_failed', { error: error.message });
        }
    }
    
    /**
     * Load emergency state
     */
    async loadEmergencyState() {
        if (!this.config.saveState) return null;
        
        try {
            const stateFile = path.join(this.config.stateDirectory, 'emergency-state.json');
            const stateData = await fs.readFile(stateFile, 'utf8');
            const state = JSON.parse(stateData);
            
            this.debugLog('Emergency state loaded');
            this.emit('state:loaded', { state });
            
            return state;
            
        } catch (error) {
            this.debugLog(`Failed to load emergency state: ${error.message}`);
            this.emit('state:load_failed', { error: error.message });
            return null;
        }
    }
    
    // ===== Recovery Mechanisms =====
    
    /**
     * Schedule recovery
     */
    scheduleRecovery() {
        if (this.shutdown.recoveryInProgress) return;
        
        this.debugLog(`Recovery scheduled in ${this.config.recoveryDelay}ms`);
        this.emit('recovery:scheduled', { delay: this.config.recoveryDelay });
        
        setTimeout(() => {
            this.attemptRecovery();
        }, this.config.recoveryDelay);
    }
    
    /**
     * Attempt recovery
     */
    async attemptRecovery() {
        if (this.shutdown.recoveryAttempts >= this.config.maxRecoveryAttempts) {
            this.debugLog('Maximum recovery attempts reached');
            this.emit('recovery:max_attempts_reached');
            return;
        }
        
        this.shutdown.recoveryAttempts++;
        this.shutdown.recoveryInProgress = true;
        this.shutdown.lastRecoveryAttempt = Date.now();
        
        this.stats.recoveryAttempts++;
        this.recovery.attempts++;
        
        this.debugLog(`Recovery attempt ${this.shutdown.recoveryAttempts}`);
        this.emit('recovery:attempt', { attempt: this.shutdown.recoveryAttempts });
        
        try {
            // Load previous state
            const previousState = await this.loadEmergencyState();
            
            // Attempt component recovery
            const success = await this.performRecovery(previousState);
            
            if (success) {
                this.stats.successfulRecoveries++;
                this.recovery.successes++;
                
                this.debugLog('Recovery successful');
                this.emit('recovery:success');
                
                // Reset shutdown state
                this.resetShutdownState();
                
            } else {
                this.recovery.failures++;
                this.debugLog('Recovery failed');
                this.emit('recovery:failed');
                
                // Schedule next recovery attempt
                if (this.shutdown.recoveryAttempts < this.config.maxRecoveryAttempts) {
                    this.scheduleRecovery();
                }
            }
            
        } catch (error) {
            this.recovery.failures++;
            this.debugLog(`Recovery error: ${error.message}`);
            this.emit('recovery:error', { error: error.message });
            
            // Schedule next recovery attempt
            if (this.shutdown.recoveryAttempts < this.config.maxRecoveryAttempts) {
                this.scheduleRecovery();
            }
        } finally {
            this.shutdown.recoveryInProgress = false;
        }
    }
    
    /**
     * Perform recovery
     */
    async performRecovery(previousState) {
        this.debugLog('Performing recovery');
        
        // Run recovery strategies
        const strategies = Array.from(this.recovery.strategies.entries());
        
        for (const [name, strategy] of strategies) {
            try {
                this.debugLog(`Running recovery strategy: ${name}`);
                await strategy(previousState);
                
                this.debugLog(`Recovery strategy completed: ${name}`);
                this.emit('recovery:strategy_success', { name });
                
            } catch (error) {
                this.debugLog(`Recovery strategy failed: ${name} - ${error.message}`);
                this.emit('recovery:strategy_failed', { name, error: error.message });
            }
        }
        
        // Attempt to restart failed components
        if (previousState?.failedComponents) {
            for (const componentName of previousState.failedComponents) {
                const recoveryFunction = this.recovery.componentRecovery.get(componentName);
                if (recoveryFunction) {
                    try {
                        await recoveryFunction();
                        this.debugLog(`Component recovered: ${componentName}`);
                        this.emit('recovery:component_success', { name: componentName });
                    } catch (error) {
                        this.debugLog(`Component recovery failed: ${componentName} - ${error.message}`);
                        this.emit('recovery:component_failed', { name: componentName, error: error.message });
                    }
                }
            }
        }
        
        return true; // Recovery considered successful if we reach here
    }
    
    /**
     * Register recovery strategy
     */
    registerRecoveryStrategy(name, strategy) {
        this.recovery.strategies.set(name, strategy);
        this.debugLog(`Recovery strategy registered: ${name}`);
    }
    
    /**
     * Register component recovery
     */
    registerComponentRecovery(componentName, recoveryFunction) {
        this.recovery.componentRecovery.set(componentName, recoveryFunction);
        this.debugLog(`Component recovery registered: ${componentName}`);
    }
    
    /**
     * Reset shutdown state
     */
    resetShutdownState() {
        this.shutdown.isShuttingDown = false;
        this.shutdown.shutdownStartTime = null;
        this.shutdown.shutdownReason = null;
        this.shutdown.shutdownData = null;
        this.shutdown.phase = 'idle';
        this.shutdown.completedComponents.clear();
        this.shutdown.failedComponents.clear();
        this.shutdown.recoveryInProgress = false;
        
        this.debugLog('Shutdown state reset');
        this.emit('shutdown:reset');
    }
    
    // ===== Error Handling =====
    
    /**
     * Handle shutdown errors
     */
    handleShutdownError(error) {
        this.debugLog(`Shutdown error: ${error.message}`);
        this.emit('shutdown:error', {
            error: error.message,
            stack: error.stack,
            phase: this.shutdown.phase
        });
    }
    
    // ===== Process Events =====
    
    /**
     * Bind process events
     */
    bindProcessEvents() {
        process.on('SIGTERM', () => {
            this.debugLog('SIGTERM received, initiating shutdown');
            this.initiateShutdown('SIGTERM');
        });
        
        process.on('SIGINT', () => {
            this.debugLog('SIGINT received, initiating shutdown');
            this.initiateShutdown('SIGINT');
        });
        
        process.on('uncaughtException', (error) => {
            this.debugLog(`Uncaught exception: ${error.message}`);
            this.initiateShutdown('uncaught_exception', { error: error.message });
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            this.debugLog(`Unhandled rejection: ${reason}`);
            this.initiateShutdown('unhandled_rejection', { reason: reason.toString() });
        });
    }
    
    // ===== Initialization =====
    
    /**
     * Initialize state directory
     */
    async initializeStateDirectory() {
        if (!this.config.saveState) return;
        
        try {
            await fs.mkdir(this.config.stateDirectory, { recursive: true });
            this.debugLog('State directory initialized');
        } catch (error) {
            this.debugLog(`Failed to initialize state directory: ${error.message}`);
        }
    }
    
    // ===== Public API =====
    
    /**
     * Get shutdown status
     */
    getStatus() {
        return {
            isShuttingDown: this.shutdown.isShuttingDown,
            phase: this.shutdown.phase,
            reason: this.shutdown.shutdownReason,
            startTime: this.shutdown.shutdownStartTime,
            duration: this.shutdown.shutdownStartTime ? Date.now() - this.shutdown.shutdownStartTime : 0,
            completedComponents: Array.from(this.shutdown.completedComponents),
            failedComponents: Array.from(this.shutdown.failedComponents),
            recoveryAttempts: this.shutdown.recoveryAttempts,
            recoveryInProgress: this.shutdown.recoveryInProgress
        };
    }
    
    /**
     * Get statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            uptime: Date.now() - this.stats.startTime,
            recovery: {
                attempts: this.recovery.attempts,
                successes: this.recovery.successes,
                failures: this.recovery.failures,
                strategies: this.recovery.strategies.size,
                componentRecovery: this.recovery.componentRecovery.size
            }
        };
    }
    
    /**
     * Force shutdown
     */
    forceShutdown(reason = 'manual') {
        this.debugLog('Force shutdown requested');
        this.performForceShutdown();
    }
    
    /**
     * Debug logging
     */
    debugLog(message) {
        if (this.config.enableDebugLogging) {
            console.log(`[EmergencyShutdown] ${message}`);
        }
    }
    
    /**
     * Shutdown emergency system
     */
    async shutdown() {
        this.debugLog('Shutting down emergency system');
        
        // Clear all resources
        this.resources.timers.clear();
        this.resources.intervals.clear();
        this.resources.connections.clear();
        this.resources.streams.clear();
        this.resources.databases.clear();
        this.resources.servers.clear();
        this.resources.processes.clear();
        this.resources.cleanupFunctions.clear();
        
        // Clear recovery
        this.recovery.strategies.clear();
        this.recovery.componentRecovery.clear();
        this.recovery.stateRecovery.clear();
        
        // Remove all listeners
        this.removeAllListeners();
        
        this.debugLog('Emergency system shutdown complete');
    }
}

export default EmergencyShutdown;