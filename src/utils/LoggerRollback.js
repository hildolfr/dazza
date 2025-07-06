import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger as createLegacyLogger, getLogger as getLegacyLogger } from './logger.js';
import EnhancedWinstonLogger from './EnhancedWinstonLogger.js';
import LoggerCompatibilityLayer from './LoggerCompatibilityLayer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * LoggerRollback provides safety mechanisms for quick rollback during logger migration.
 * It enables configuration-based logger switching, emergency fallback to legacy logger,
 * state preservation during rollback, and validation of rollback success.
 * 
 * Features:
 * - Configuration-based logger switching
 * - Emergency fallback to legacy logger
 * - State preservation during rollback
 * - Rollback validation and verification
 * - Automated rollback triggers
 * - Safe migration state management
 * - Comprehensive rollback reporting
 */
class LoggerRollback {
    /**
     * Creates a logger rollback manager instance
     * @param {Object} options - Configuration options
     * @param {string} [options.configFile='./logger-config.json'] - Configuration file path
     * @param {string} [options.backupDir='./backup'] - Backup directory for state preservation
     * @param {boolean} [options.autoRollback=true] - Enable automatic rollback on critical failures
     * @param {number} [options.rollbackThreshold=5] - Number of failures to trigger auto-rollback
     * @param {number} [options.healthCheckInterval=30000] - Health check interval in milliseconds
     * @param {boolean} [options.enableMonitoring=true] - Enable continuous monitoring
     */
    constructor(options = {}) {
        this.options = {
            configFile: options.configFile || './logger-config.json',
            backupDir: options.backupDir || './backup',
            autoRollback: options.autoRollback !== false,
            rollbackThreshold: options.rollbackThreshold || 5,
            healthCheckInterval: options.healthCheckInterval || 30000,
            enableMonitoring: options.enableMonitoring !== false,
            ...options
        };
        
        this.state = {
            currentLogger: 'legacy',
            migrationPhase: 'not-started',
            rollbackCount: 0,
            lastRollback: null,
            healthStatus: 'unknown',
            failureCount: 0,
            lastHealthCheck: null,
            startTime: Date.now()
        };
        
        this.activeLogger = null;
        this.backupLogger = null;
        this.healthCheckTimer = null;
        this.rollbackHistory = [];
        
        this.setupRollbackSystem();
    }
    
    /**
     * Sets up the rollback system
     * @private
     */
    setupRollbackSystem() {
        // Ensure backup directory exists
        if (!fs.existsSync(this.options.backupDir)) {
            fs.mkdirSync(this.options.backupDir, { recursive: true });
        }
        
        // Load or create configuration
        this.loadConfiguration();
        
        // Initialize with legacy logger as safe default
        this.initializeLegacyLogger();
        
        // Set up monitoring if enabled
        if (this.options.enableMonitoring) {
            this.startMonitoring();
        }
        
        // Set up emergency handlers
        this.setupEmergencyHandlers();
        
        console.log('LoggerRollback system initialized', {
            currentLogger: this.state.currentLogger,
            autoRollback: this.options.autoRollback,
            monitoring: this.options.enableMonitoring
        });
    }
    
    /**
     * Loads configuration from file
     * @private
     */
    loadConfiguration() {
        try {
            if (fs.existsSync(this.options.configFile)) {
                const configData = fs.readFileSync(this.options.configFile, 'utf8');
                this.config = JSON.parse(configData);
                
                // Restore state if available
                if (this.config.state) {
                    this.state = { ...this.state, ...this.config.state };
                }
            } else {
                // Create default configuration
                this.config = {
                    loggerType: 'legacy',
                    migrationEnabled: false,
                    rollbackEnabled: true,
                    state: this.state
                };
                this.saveConfiguration();
            }
        } catch (error) {
            console.error('Failed to load configuration, using defaults:', error);
            this.config = {
                loggerType: 'legacy',
                migrationEnabled: false,
                rollbackEnabled: true,
                state: this.state
            };
        }
    }
    
    /**
     * Saves configuration to file
     * @private
     */
    saveConfiguration() {
        try {
            this.config.state = this.state;
            fs.writeFileSync(this.options.configFile, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('Failed to save configuration:', error);
        }
    }
    
    /**
     * Initializes legacy logger as safe default
     * @private
     */
    initializeLegacyLogger() {
        try {
            this.activeLogger = getLegacyLogger();
            this.backupLogger = this.activeLogger; // Backup is same as active initially
            this.state.currentLogger = 'legacy';
            this.state.healthStatus = 'healthy';
            this.state.lastHealthCheck = Date.now();
        } catch (error) {
            console.error('Failed to initialize legacy logger:', error);
            this.state.healthStatus = 'critical';
            throw error;
        }
    }
    
    /**
     * Sets up emergency handlers for process signals
     * @private
     */
    setupEmergencyHandlers() {
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('Uncaught exception detected, initiating emergency rollback:', error);
            this.emergencyRollback('uncaught-exception');
        });
        
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled promise rejection detected:', reason);
            this.handleFailure('unhandled-rejection');
        });
        
        // Handle process termination signals
        ['SIGINT', 'SIGTERM'].forEach(signal => {
            process.on(signal, () => {
                console.log(`Received ${signal}, performing clean shutdown...`);
                this.shutdown();
                process.exit(0);
            });
        });
    }
    
    /**
     * Starts continuous monitoring
     * @private
     */
    startMonitoring() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }
        
        this.healthCheckTimer = setInterval(() => {
            this.performHealthCheck();
        }, this.options.healthCheckInterval);
    }
    
    /**
     * Performs health check on current logger
     * @private
     */
    async performHealthCheck() {
        try {
            const startTime = Date.now();
            
            // Test basic logging functionality
            await this.testLoggerHealth();
            
            const duration = Date.now() - startTime;
            
            this.state.lastHealthCheck = Date.now();
            this.state.healthStatus = 'healthy';
            this.state.failureCount = 0; // Reset failure count on successful health check
            
            if (duration > 1000) { // Health check took more than 1 second
                console.warn(`Logger health check slow: ${duration}ms`);
            }
            
        } catch (error) {
            console.error('Logger health check failed:', error);
            this.handleFailure('health-check-failure');
        }
    }
    
    /**
     * Tests logger health
     * @private
     * @returns {Promise<void>}
     */
    async testLoggerHealth() {
        if (!this.activeLogger) {
            throw new Error('No active logger available');
        }
        
        // Test basic logging methods
        const testMessage = `Health check at ${new Date().toISOString()}`;
        
        if (typeof this.activeLogger.info === 'function') {
            this.activeLogger.info(testMessage);
        } else {
            throw new Error('Logger missing info method');
        }
        
        if (typeof this.activeLogger.error === 'function') {
            this.activeLogger.error('Health check error test', { test: true });
        } else {
            throw new Error('Logger missing error method');
        }
        
        // Test child logger if available
        if (typeof this.activeLogger.child === 'function') {
            const childLogger = this.activeLogger.child({ healthCheck: true });
            childLogger.info('Child logger health check');
        }
    }
    
    /**
     * Handles logger failures
     * @private
     * @param {string} reason - Failure reason
     */
    handleFailure(reason) {
        this.state.failureCount++;
        this.state.healthStatus = 'degraded';
        
        console.warn(`Logger failure detected: ${reason} (count: ${this.state.failureCount})`);
        
        // Trigger auto-rollback if threshold exceeded
        if (this.options.autoRollback && this.state.failureCount >= this.options.rollbackThreshold) {
            console.error(`Failure threshold exceeded (${this.state.failureCount}/${this.options.rollbackThreshold}), initiating auto-rollback`);
            this.emergencyRollback('failure-threshold-exceeded');
        }
    }
    
    /**
     * Switches to specified logger type
     * @param {string} loggerType - Logger type ('legacy', 'enhanced', 'compatibility')
     * @param {Object} [options] - Logger options
     * @returns {Promise<boolean>} Success status
     */
    async switchLogger(loggerType, options = {}) {
        console.log(`Switching logger from ${this.state.currentLogger} to ${loggerType}...`);
        
        try {
            // Backup current state
            await this.backupCurrentState();
            
            // Create new logger instance
            const newLogger = await this.createLogger(loggerType, options);
            
            // Test new logger
            await this.testLogger(newLogger);
            
            // Store previous logger as backup
            this.backupLogger = this.activeLogger;
            
            // Switch to new logger
            this.activeLogger = newLogger;
            this.state.currentLogger = loggerType;
            this.state.healthStatus = 'healthy';
            this.state.failureCount = 0;
            
            // Update configuration
            this.config.loggerType = loggerType;
            this.saveConfiguration();
            
            console.log(`Successfully switched to ${loggerType} logger`);
            return true;
            
        } catch (error) {
            console.error(`Failed to switch to ${loggerType} logger:`, error);
            this.handleFailure('logger-switch-failure');
            return false;
        }
    }
    
    /**
     * Creates logger instance of specified type
     * @private
     * @param {string} loggerType - Logger type
     * @param {Object} options - Logger options
     * @returns {Promise<Object>} Logger instance
     */
    async createLogger(loggerType, options) {
        switch (loggerType) {
            case 'legacy':
                return createLegacyLogger(options);
                
            case 'enhanced':
                return new EnhancedWinstonLogger(options);
                
            case 'compatibility':
                return new LoggerCompatibilityLayer(options);
                
            default:
                throw new Error(`Unknown logger type: ${loggerType}`);
        }
    }
    
    /**
     * Tests logger functionality
     * @private
     * @param {Object} logger - Logger instance to test
     * @returns {Promise<void>}
     */
    async testLogger(logger) {
        const testMessage = `Logger test at ${new Date().toISOString()}`;
        
        // Test basic methods
        if (typeof logger.info !== 'function') {
            throw new Error('Logger missing info method');
        }
        
        if (typeof logger.error !== 'function') {
            throw new Error('Logger missing error method');
        }
        
        if (typeof logger.warn !== 'function') {
            throw new Error('Logger missing warn method');
        }
        
        if (typeof logger.debug !== 'function') {
            throw new Error('Logger missing debug method');
        }
        
        // Test bot-specific methods if available
        if (typeof logger.command === 'function') {
            logger.command('test-user', 'test-command', ['arg1']);
        }
        
        if (typeof logger.userEvent === 'function') {
            logger.userEvent('test-user', 'test-event');
        }
        
        if (typeof logger.connection === 'function') {
            logger.connection('test-connection', { test: true });
        }
        
        // Test child logger if available
        if (typeof logger.child === 'function') {
            const childLogger = logger.child({ test: true });
            childLogger.info('Child logger test');
        }
        
        // Test actual logging
        logger.info(testMessage);
        logger.error('Test error message', { test: true });
    }
    
    /**
     * Backs up current state
     * @private
     * @returns {Promise<void>}
     */
    async backupCurrentState() {
        const backupData = {
            timestamp: Date.now(),
            state: { ...this.state },
            config: { ...this.config },
            loggerType: this.state.currentLogger
        };
        
        const backupFile = path.join(this.options.backupDir, `state-backup-${Date.now()}.json`);
        
        try {
            await fs.promises.writeFile(backupFile, JSON.stringify(backupData, null, 2));
            console.log(`State backed up to ${backupFile}`);
        } catch (error) {
            console.error('Failed to backup state:', error);
        }
    }
    
    /**
     * Performs emergency rollback to legacy logger
     * @param {string} reason - Rollback reason
     * @returns {Promise<boolean>} Success status
     */
    async emergencyRollback(reason) {
        console.error(`EMERGENCY ROLLBACK INITIATED: ${reason}`);
        
        const rollbackRecord = {
            timestamp: Date.now(),
            reason,
            fromLogger: this.state.currentLogger,
            toLogger: 'legacy',
            success: false,
            duration: 0
        };
        
        const startTime = Date.now();
        
        try {
            // Backup current state
            await this.backupCurrentState();
            
            // Close current logger if possible
            if (this.activeLogger && typeof this.activeLogger.close === 'function') {
                try {
                    await this.activeLogger.close();
                } catch (error) {
                    console.error('Failed to close current logger during rollback:', error);
                }
            }
            
            // Switch to legacy logger
            this.activeLogger = getLegacyLogger();
            this.state.currentLogger = 'legacy';
            this.state.healthStatus = 'healthy';
            this.state.failureCount = 0;
            this.state.rollbackCount++;
            this.state.lastRollback = Date.now();
            
            // Update configuration
            this.config.loggerType = 'legacy';
            this.config.migrationEnabled = false;
            this.saveConfiguration();
            
            // Test rollback success
            await this.testLogger(this.activeLogger);
            
            rollbackRecord.success = true;
            rollbackRecord.duration = Date.now() - startTime;
            
            console.log(`Emergency rollback completed successfully in ${rollbackRecord.duration}ms`);
            
            // Log rollback event
            this.activeLogger.error('Emergency rollback completed', rollbackRecord);
            
        } catch (error) {
            console.error('Emergency rollback failed:', error);
            rollbackRecord.error = error.message;
            rollbackRecord.duration = Date.now() - startTime;
            
            // Try to fall back to console logging
            console.error('CRITICAL: All logger systems failed, falling back to console logging');
            this.state.healthStatus = 'critical';
        }
        
        this.rollbackHistory.push(rollbackRecord);
        
        // Keep only last 10 rollback records
        if (this.rollbackHistory.length > 10) {
            this.rollbackHistory.shift();
        }
        
        return rollbackRecord.success;
    }
    
    /**
     * Performs controlled rollback to previous logger
     * @param {string} [reason='manual-rollback'] - Rollback reason
     * @returns {Promise<boolean>} Success status
     */
    async rollback(reason = 'manual-rollback') {
        console.log(`Performing controlled rollback: ${reason}`);
        
        if (!this.backupLogger) {
            console.error('No backup logger available for rollback');
            return this.emergencyRollback(reason);
        }
        
        const rollbackRecord = {
            timestamp: Date.now(),
            reason,
            fromLogger: this.state.currentLogger,
            toLogger: 'backup',
            success: false,
            duration: 0
        };
        
        const startTime = Date.now();
        
        try {
            // Backup current state
            await this.backupCurrentState();
            
            // Close current logger if possible
            if (this.activeLogger && typeof this.activeLogger.close === 'function') {
                try {
                    await this.activeLogger.close();
                } catch (error) {
                    console.error('Failed to close current logger during rollback:', error);
                }
            }
            
            // Switch to backup logger
            this.activeLogger = this.backupLogger;
            this.state.currentLogger = 'backup';
            this.state.healthStatus = 'healthy';
            this.state.failureCount = 0;
            this.state.rollbackCount++;
            this.state.lastRollback = Date.now();
            
            // Test rollback success
            await this.testLogger(this.activeLogger);
            
            rollbackRecord.success = true;
            rollbackRecord.duration = Date.now() - startTime;
            
            console.log(`Controlled rollback completed successfully in ${rollbackRecord.duration}ms`);
            
            // Log rollback event
            this.activeLogger.info('Controlled rollback completed', rollbackRecord);
            
        } catch (error) {
            console.error('Controlled rollback failed, attempting emergency rollback:', error);
            return this.emergencyRollback(`controlled-rollback-failed: ${error.message}`);
        }
        
        this.rollbackHistory.push(rollbackRecord);
        
        return rollbackRecord.success;
    }
    
    /**
     * Validates rollback success
     * @returns {Promise<Object>} Validation results
     */
    async validateRollback() {
        const results = {
            success: true,
            tests: {},
            errors: []
        };
        
        try {
            // Test logger health
            await this.testLoggerHealth();
            results.tests.health = { success: true };
            
            // Test basic functionality
            const testMessage = `Rollback validation at ${new Date().toISOString()}`;
            this.activeLogger.info(testMessage);
            results.tests.basicLogging = { success: true };
            
            // Test error handling
            this.activeLogger.error('Rollback validation error test', new Error('Test error'));
            results.tests.errorHandling = { success: true };
            
            // Test child logger if available
            if (typeof this.activeLogger.child === 'function') {
                const childLogger = this.activeLogger.child({ rollbackValidation: true });
                childLogger.info('Child logger rollback validation');
                results.tests.childLogger = { success: true };
            }
            
        } catch (error) {
            results.success = false;
            results.errors.push(error.message);
            console.error('Rollback validation failed:', error);
        }
        
        return results;
    }
    
    /**
     * Gets current rollback system status
     * @returns {Object} Current status
     */
    getStatus() {
        return {
            state: { ...this.state },
            config: { ...this.config },
            rollbackHistory: this.rollbackHistory,
            uptime: Date.now() - this.state.startTime,
            monitoring: this.options.enableMonitoring,
            autoRollback: this.options.autoRollback
        };
    }
    
    /**
     * Gets the current active logger
     * @returns {Object} Current logger instance
     */
    getLogger() {
        return this.activeLogger;
    }
    
    /**
     * Shuts down the rollback system
     * @returns {Promise<void>}
     */
    async shutdown() {
        console.log('Shutting down LoggerRollback system...');
        
        // Stop monitoring
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
        
        // Save final state
        this.saveConfiguration();
        
        // Close active logger if possible
        if (this.activeLogger && typeof this.activeLogger.close === 'function') {
            try {
                await this.activeLogger.close();
            } catch (error) {
                console.error('Failed to close active logger during shutdown:', error);
            }
        }
        
        console.log('LoggerRollback system shut down');
    }
}

// Singleton instance for global access
let rollbackInstance = null;

/**
 * Creates or returns singleton rollback manager instance
 * @param {Object} [options] - Configuration options
 * @returns {LoggerRollback} Rollback manager instance
 */
export function createRollbackManager(options) {
    if (!rollbackInstance) {
        rollbackInstance = new LoggerRollback(options);
    }
    return rollbackInstance;
}

/**
 * Gets existing rollback manager instance or creates new one with default options
 * @returns {LoggerRollback} Rollback manager instance
 */
export function getRollbackManager() {
    if (!rollbackInstance) {
        rollbackInstance = new LoggerRollback();
    }
    return rollbackInstance;
}

/**
 * Resets the singleton instance (useful for testing)
 */
export function resetRollbackManager() {
    if (rollbackInstance) {
        rollbackInstance.shutdown();
        rollbackInstance = null;
    }
}

export default LoggerRollback;