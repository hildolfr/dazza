import { createLogger as createLegacyLogger, getLogger as getLegacyLogger } from './logger.js';
import EnhancedWinstonLogger from './EnhancedWinstonLogger.js';
import crypto from 'crypto';

/**
 * DualLogger implements a dual-logging system that writes to both old and new loggers
 * simultaneously for validation. This enables safe migration by comparing outputs
 * and ensuring consistency between the legacy and enhanced loggers.
 * 
 * Features:
 * - Simultaneous logging to both legacy and enhanced loggers
 * - Output comparison and validation
 * - Performance monitoring and analysis
 * - Discrepancy detection and reporting
 * - Safe migration validation
 * - Configurable validation modes
 */
class DualLogger {
    /**
     * Creates a dual logger instance
     * @param {Object} options - Configuration options
     * @param {Object} [options.legacy] - Legacy logger configuration
     * @param {Object} [options.enhanced] - Enhanced logger configuration
     * @param {string} [options.mode='compare'] - Validation mode ('compare', 'legacy-primary', 'enhanced-primary')
     * @param {boolean} [options.validateOutput=true] - Enable output validation
     * @param {boolean} [options.enableMetrics=true] - Enable performance metrics
     * @param {number} [options.comparisonSampling=1.0] - Fraction of outputs to compare (0.0-1.0)
     */
    constructor(options = {}) {
        this.options = {
            mode: options.mode || 'compare',
            validateOutput: options.validateOutput !== false,
            enableMetrics: options.enableMetrics !== false,
            comparisonSampling: options.comparisonSampling || 1.0,
            ...options
        };
        
        this.metrics = {
            totalCalls: 0,
            legacyErrors: 0,
            enhancedErrors: 0,
            comparisons: 0,
            discrepancies: 0,
            performanceData: {
                legacy: [],
                enhanced: []
            },
            startTime: Date.now()
        };
        
        this.discrepancies = [];
        this.validationResults = [];
        
        try {
            // Initialize legacy logger
            this.legacyLogger = this.options.legacy 
                ? createLegacyLogger(this.options.legacy)
                : getLegacyLogger();
            
            // Initialize enhanced logger
            this.enhancedLogger = new EnhancedWinstonLogger(this.options.enhanced || {});
            
            // Set up validation infrastructure
            if (this.options.validateOutput) {
                this.setupValidation();
            }
            
            // Initialize metrics collection
            if (this.options.enableMetrics) {
                this.initializeMetrics();
            }
            
            console.log('DualLogger initialized successfully', {
                mode: this.options.mode,
                validateOutput: this.options.validateOutput,
                enableMetrics: this.options.enableMetrics,
                comparisonSampling: this.options.comparisonSampling
            });
            
        } catch (error) {
            console.error('Failed to initialize DualLogger:', error);
            throw error;
        }
    }
    
    /**
     * Sets up validation infrastructure
     * @private
     */
    setupValidation() {
        this.validationQueue = [];
        this.validationInterval = setInterval(() => {
            this.processValidationQueue();
        }, 5000); // Process validation queue every 5 seconds
    }
    
    /**
     * Initializes performance metrics collection
     * @private
     */
    initializeMetrics() {
        this.metricsInterval = setInterval(() => {
            this.collectMetrics();
        }, 60000); // Collect metrics every minute
    }
    
    /**
     * Processes the validation queue
     * @private
     */
    processValidationQueue() {
        if (this.validationQueue.length === 0) return;
        
        const results = this.validationQueue.splice(0, 100); // Process up to 100 items at a time
        
        for (const result of results) {
            this.compareOutputs(result);
        }
    }
    
    /**
     * Collects performance metrics
     * @private
     */
    collectMetrics() {
        const uptime = Date.now() - this.metrics.startTime;
        const metricsData = {
            ...this.metrics,
            uptime,
            callsPerSecond: this.metrics.totalCalls / (uptime / 1000),
            errorRate: {
                legacy: this.metrics.legacyErrors / Math.max(this.metrics.totalCalls, 1),
                enhanced: this.metrics.enhancedErrors / Math.max(this.metrics.totalCalls, 1)
            },
            discrepancyRate: this.metrics.discrepancies / Math.max(this.metrics.comparisons, 1),
            averagePerformance: {
                legacy: this.calculateAveragePerformance(this.metrics.performanceData.legacy),
                enhanced: this.calculateAveragePerformance(this.metrics.performanceData.enhanced)
            }
        };
        
        console.log('DualLogger Metrics:', metricsData);
    }
    
    /**
     * Calculates average performance from performance data array
     * @private
     * @param {Array} performanceArray - Array of performance measurements
     * @returns {number} Average performance in milliseconds
     */
    calculateAveragePerformance(performanceArray) {
        if (performanceArray.length === 0) return 0;
        const sum = performanceArray.reduce((a, b) => a + b, 0);
        return sum / performanceArray.length;
    }
    
    /**
     * Executes logging on both loggers with performance monitoring
     * @private
     * @param {string} method - Method name
     * @param {Array} args - Method arguments
     * @returns {Object} Results from both loggers
     */
    async dualExecution(method, args) {
        this.metrics.totalCalls++;
        
        const execution = {
            method,
            args: this.sanitizeArgs(args),
            timestamp: Date.now(),
            id: crypto.randomUUID()
        };
        
        const results = {
            legacy: { success: false, error: null, duration: 0 },
            enhanced: { success: false, error: null, duration: 0 }
        };
        
        // Execute on legacy logger
        try {
            const legacyStart = process.hrtime.bigint();
            const legacyResult = await this.executeLegacyMethod(method, args);
            const legacyEnd = process.hrtime.bigint();
            
            results.legacy = {
                success: true,
                result: legacyResult,
                duration: Number(legacyEnd - legacyStart) / 1000000, // Convert to milliseconds
                error: null
            };
            
            if (this.options.enableMetrics) {
                this.metrics.performanceData.legacy.push(results.legacy.duration);
                // Keep only last 1000 measurements
                if (this.metrics.performanceData.legacy.length > 1000) {
                    this.metrics.performanceData.legacy.shift();
                }
            }
            
        } catch (error) {
            results.legacy.error = error;
            this.metrics.legacyErrors++;
        }
        
        // Execute on enhanced logger
        try {
            const enhancedStart = process.hrtime.bigint();
            const enhancedResult = await this.executeEnhancedMethod(method, args);
            const enhancedEnd = process.hrtime.bigint();
            
            results.enhanced = {
                success: true,
                result: enhancedResult,
                duration: Number(enhancedEnd - enhancedStart) / 1000000, // Convert to milliseconds
                error: null
            };
            
            if (this.options.enableMetrics) {
                this.metrics.performanceData.enhanced.push(results.enhanced.duration);
                // Keep only last 1000 measurements
                if (this.metrics.performanceData.enhanced.length > 1000) {
                    this.metrics.performanceData.enhanced.shift();
                }
            }
            
        } catch (error) {
            results.enhanced.error = error;
            this.metrics.enhancedErrors++;
        }
        
        // Queue for validation if enabled
        if (this.options.validateOutput && Math.random() < this.options.comparisonSampling) {
            this.validationQueue.push({ execution, results });
        }
        
        // Return result based on mode
        return this.selectResult(results);
    }
    
    /**
     * Sanitizes arguments for logging and comparison
     * @private
     * @param {Array} args - Original arguments
     * @returns {Array} Sanitized arguments
     */
    sanitizeArgs(args) {
        return args.map(arg => {
            if (typeof arg === 'function') {
                return '[Function]';
            }
            if (typeof arg === 'object' && arg !== null) {
                try {
                    return JSON.parse(JSON.stringify(arg));
                } catch (e) {
                    return '[Complex Object]';
                }
            }
            return arg;
        });
    }
    
    /**
     * Executes method on legacy logger
     * @private
     * @param {string} method - Method name
     * @param {Array} args - Method arguments
     * @returns {*} Method result
     */
    async executeLegacyMethod(method, args) {
        if (typeof this.legacyLogger[method] === 'function') {
            return this.legacyLogger[method](...args);
        }
        throw new Error(`Method ${method} not found on legacy logger`);
    }
    
    /**
     * Executes method on enhanced logger
     * @private
     * @param {string} method - Method name
     * @param {Array} args - Method arguments
     * @returns {*} Method result
     */
    async executeEnhancedMethod(method, args) {
        if (typeof this.enhancedLogger[method] === 'function') {
            return this.enhancedLogger[method](...args);
        }
        throw new Error(`Method ${method} not found on enhanced logger`);
    }
    
    /**
     * Selects result based on configured mode
     * @private
     * @param {Object} results - Results from both loggers
     * @returns {*} Selected result
     */
    selectResult(results) {
        switch (this.options.mode) {
            case 'legacy-primary':
                return results.legacy.success ? results.legacy.result : results.enhanced.result;
            case 'enhanced-primary':
                return results.enhanced.success ? results.enhanced.result : results.legacy.result;
            case 'compare':
            default:
                // In compare mode, prefer enhanced but fall back to legacy
                if (results.enhanced.success) {
                    return results.enhanced.result;
                } else if (results.legacy.success) {
                    return results.legacy.result;
                } else {
                    throw new Error('Both loggers failed');
                }
        }
    }
    
    /**
     * Compares outputs from both loggers
     * @private
     * @param {Object} validationItem - Validation item with execution and results
     */
    compareOutputs(validationItem) {
        this.metrics.comparisons++;
        
        const { execution, results } = validationItem;
        const discrepancy = {
            id: execution.id,
            timestamp: execution.timestamp,
            method: execution.method,
            args: execution.args,
            hasDiscrepancy: false,
            details: {}
        };
        
        // Compare success states
        if (results.legacy.success !== results.enhanced.success) {
            discrepancy.hasDiscrepancy = true;
            discrepancy.details.successMismatch = {
                legacy: results.legacy.success,
                enhanced: results.enhanced.success
            };
        }
        
        // Compare errors
        if (results.legacy.error || results.enhanced.error) {
            const legacyError = results.legacy.error ? results.legacy.error.message : null;
            const enhancedError = results.enhanced.error ? results.enhanced.error.message : null;
            
            if (legacyError !== enhancedError) {
                discrepancy.hasDiscrepancy = true;
                discrepancy.details.errorMismatch = {
                    legacy: legacyError,
                    enhanced: enhancedError
                };
            }
        }
        
        // Compare performance
        if (results.legacy.duration && results.enhanced.duration) {
            const performanceRatio = results.enhanced.duration / results.legacy.duration;
            discrepancy.details.performance = {
                legacy: results.legacy.duration,
                enhanced: results.enhanced.duration,
                ratio: performanceRatio
            };
        }
        
        if (discrepancy.hasDiscrepancy) {
            this.metrics.discrepancies++;
            this.discrepancies.push(discrepancy);
            
            // Keep only last 100 discrepancies
            if (this.discrepancies.length > 100) {
                this.discrepancies.shift();
            }
            
            console.warn('DualLogger: Discrepancy detected', discrepancy);
        }
        
        this.validationResults.push({
            id: execution.id,
            timestamp: execution.timestamp,
            method: execution.method,
            hasDiscrepancy: discrepancy.hasDiscrepancy,
            performance: discrepancy.details.performance
        });
        
        // Keep only last 1000 validation results
        if (this.validationResults.length > 1000) {
            this.validationResults.shift();
        }
    }
    
    /**
     * Logs error messages
     * @param {string} message - Error message
     * @param {*} [context] - Additional context information
     */
    async error(message, context) {
        return this.dualExecution('error', [message, context]);
    }
    
    /**
     * Logs warning messages
     * @param {string} message - Warning message
     * @param {*} [context] - Additional context information
     */
    async warn(message, context) {
        return this.dualExecution('warn', [message, context]);
    }
    
    /**
     * Logs info messages
     * @param {string} message - Info message
     * @param {*} [context] - Additional context information
     */
    async info(message, context) {
        return this.dualExecution('info', [message, context]);
    }
    
    /**
     * Logs debug messages
     * @param {string} message - Debug message
     * @param {*} [context] - Additional context information
     */
    async debug(message, context) {
        return this.dualExecution('debug', [message, context]);
    }
    
    /**
     * Logs bot command execution
     * @param {string} username - Username who executed the command
     * @param {string} command - Command name
     * @param {Array|string} [args] - Command arguments
     */
    async command(username, command, args) {
        return this.dualExecution('command', [username, command, args]);
    }
    
    /**
     * Logs user events (join, leave, etc.)
     * @param {string} username - Username
     * @param {string} event - Event type (join, leave, etc.)
     */
    async userEvent(username, event) {
        return this.dualExecution('userEvent', [username, event]);
    }
    
    /**
     * Logs connection events
     * @param {string} event - Connection event type
     * @param {Object} [details={}] - Additional details about the connection event
     */
    async connection(event, details = {}) {
        return this.dualExecution('connection', [event, details]);
    }
    
    /**
     * Creates a child logger with additional metadata
     * @param {Object} [metadata={}] - Additional metadata to include in all logs
     * @returns {Object} Child logger instance
     */
    child(metadata = {}) {
        const legacyChild = this.legacyLogger.child(metadata);
        const enhancedChild = this.enhancedLogger.child(metadata);
        
        return {
            error: async (message, context) => {
                return this.dualExecution('error', [message, { ...metadata, ...context }]);
            },
            warn: async (message, context) => {
                return this.dualExecution('warn', [message, { ...metadata, ...context }]);
            },
            info: async (message, context) => {
                return this.dualExecution('info', [message, { ...metadata, ...context }]);
            },
            debug: async (message, context) => {
                return this.dualExecution('debug', [message, { ...metadata, ...context }]);
            },
            command: async (username, command, args) => {
                return this.dualExecution('command', [username, command, args]);
            },
            userEvent: async (username, event) => {
                return this.dualExecution('userEvent', [username, event]);
            },
            connection: async (event, details) => {
                return this.dualExecution('connection', [event, details]);
            }
        };
    }
    
    /**
     * Gets comprehensive validation report
     * @returns {Object} Validation report with metrics and discrepancies
     */
    getValidationReport() {
        const uptime = Date.now() - this.metrics.startTime;
        
        return {
            summary: {
                uptime,
                totalCalls: this.metrics.totalCalls,
                comparisons: this.metrics.comparisons,
                discrepancies: this.metrics.discrepancies,
                callsPerSecond: this.metrics.totalCalls / (uptime / 1000),
                discrepancyRate: this.metrics.discrepancies / Math.max(this.metrics.comparisons, 1),
                errorRates: {
                    legacy: this.metrics.legacyErrors / Math.max(this.metrics.totalCalls, 1),
                    enhanced: this.metrics.enhancedErrors / Math.max(this.metrics.totalCalls, 1)
                }
            },
            performance: {
                average: {
                    legacy: this.calculateAveragePerformance(this.metrics.performanceData.legacy),
                    enhanced: this.calculateAveragePerformance(this.metrics.performanceData.enhanced)
                },
                samples: {
                    legacy: this.metrics.performanceData.legacy.length,
                    enhanced: this.metrics.performanceData.enhanced.length
                }
            },
            discrepancies: this.discrepancies,
            recentValidations: this.validationResults.slice(-50), // Last 50 validations
            configuration: this.options
        };
    }
    
    /**
     * Switches the primary logger mode
     * @param {string} mode - New mode ('compare', 'legacy-primary', 'enhanced-primary')
     */
    switchMode(mode) {
        const oldMode = this.options.mode;
        this.options.mode = mode;
        
        console.log(`DualLogger: Switched from ${oldMode} to ${mode} mode`);
        
        // Log mode change to both loggers
        this.info('DualLogger mode changed', {
            oldMode,
            newMode: mode,
            timestamp: Date.now()
        });
    }
    
    /**
     * Closes both loggers and validation infrastructure
     */
    async close() {
        if (this.validationInterval) {
            clearInterval(this.validationInterval);
        }
        
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        
        // Process remaining validation queue
        if (this.validationQueue.length > 0) {
            this.processValidationQueue();
        }
        
        // Close enhanced logger
        if (this.enhancedLogger) {
            await this.enhancedLogger.close();
        }
        
        console.log('DualLogger closed');
    }
}

// Singleton instance for easy usage
let dualLoggerInstance = null;

/**
 * Creates or returns singleton dual logger instance
 * @param {Object} [options] - Configuration options
 * @returns {DualLogger} Dual logger instance
 */
export function createDualLogger(options) {
    if (!dualLoggerInstance) {
        dualLoggerInstance = new DualLogger(options);
    }
    return dualLoggerInstance;
}

/**
 * Gets existing dual logger instance or creates new one with default options
 * @returns {DualLogger} Dual logger instance
 */
export function getDualLogger() {
    if (!dualLoggerInstance) {
        dualLoggerInstance = new DualLogger();
    }
    return dualLoggerInstance;
}

/**
 * Resets the singleton instance (useful for testing)
 */
export function resetDualLogger() {
    if (dualLoggerInstance) {
        dualLoggerInstance.close();
        dualLoggerInstance = null;
    }
}

export default DualLogger;