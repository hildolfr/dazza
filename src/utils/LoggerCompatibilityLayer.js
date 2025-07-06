import EnhancedWinstonLogger from './EnhancedWinstonLogger.js';

/**
 * Compatibility layer that provides the exact same API as the legacy custom logger
 * but uses the EnhancedWinstonLogger as the backend. This enables seamless migration
 * from the dual logging system to the unified enhanced Winston logger.
 * 
 * Features:
 * - 100% API compatibility with legacy logger
 * - Transparent configuration mapping
 * - Error handling and fallback mechanisms
 * - Performance monitoring and metrics
 * - Seamless drop-in replacement capability
 */
class LoggerCompatibilityLayer {
    /**
     * Creates a compatibility layer instance
     * @param {Object} options - Configuration options (legacy format)
     * @param {Object} [options.fallback] - Fallback configuration
     * @param {boolean} [options.enableMetrics=true] - Enable performance metrics
     * @param {boolean} [options.enableFallback=true] - Enable fallback mechanisms
     */
    constructor(options = {}) {
        this.options = options;
        this.metrics = {
            callCount: 0,
            errorCount: 0,
            fallbackCount: 0,
            startTime: Date.now()
        };
        
        this.enableMetrics = options.enableMetrics !== false;
        this.enableFallback = options.enableFallback !== false;
        
        try {
            // Map legacy configuration to enhanced Winston configuration
            const enhancedConfig = this.mapLegacyConfig(options);
            
            // Create enhanced Winston logger instance
            this.enhancedLogger = new EnhancedWinstonLogger(enhancedConfig);
            
            // Set up fallback if enabled
            if (this.enableFallback) {
                this.setupFallback();
            }
            
            // Initialize metrics if enabled
            if (this.enableMetrics) {
                this.initializeMetrics();
            }
            
            this.enhancedLogger.info('LoggerCompatibilityLayer initialized successfully', {
                compatibility: 'legacy-to-enhanced',
                fallbackEnabled: this.enableFallback,
                metricsEnabled: this.enableMetrics
            });
            
        } catch (error) {
            console.error('Failed to initialize LoggerCompatibilityLayer:', error);
            
            if (this.enableFallback) {
                this.activateFallback();
            } else {
                throw error;
            }
        }
    }
    
    /**
     * Maps legacy logger configuration to enhanced Winston configuration
     * @private
     * @param {Object} legacyConfig - Legacy logger configuration
     * @returns {Object} Enhanced Winston configuration
     */
    mapLegacyConfig(legacyConfig) {
        const enhancedConfig = {
            // Map basic options
            level: legacyConfig.level || legacyConfig.logLevel || 'info',
            console: legacyConfig.console !== false && legacyConfig.logToConsole !== false,
            
            // Map file configuration
            logDir: legacyConfig.logDir || (legacyConfig.file && legacyConfig.file.path) || './logs',
            maxFileSize: legacyConfig.maxFileSize || (legacyConfig.file && legacyConfig.file.maxSize) || 204800,
            maxFiles: legacyConfig.maxFiles || (legacyConfig.file && legacyConfig.file.maxFiles) || 5,
            
            // Map display options
            colorize: legacyConfig.colorize !== false && (legacyConfig.console && legacyConfig.console.colorize !== false),
            timestamp: legacyConfig.timestamp !== false,
            
            // Default format
            format: legacyConfig.format || 'combined'
        };
        
        return enhancedConfig;
    }
    
    /**
     * Sets up fallback mechanisms
     * @private
     */
    setupFallback() {
        this.fallbackLogger = {
            error: (message, context) => {
                console.error(`[ERROR] ${message}`, context || '');
                this.metrics.fallbackCount++;
            },
            warn: (message, context) => {
                console.warn(`[WARN] ${message}`, context || '');
                this.metrics.fallbackCount++;
            },
            info: (message, context) => {
                console.log(`[INFO] ${message}`, context || '');
                this.metrics.fallbackCount++;
            },
            debug: (message, context) => {
                console.log(`[DEBUG] ${message}`, context || '');
                this.metrics.fallbackCount++;
            },
            command: (username, command, args) => {
                console.log(`[COMMAND] User: ${username}, Command: ${command}, Args:`, args);
                this.metrics.fallbackCount++;
            },
            userEvent: (username, event) => {
                console.log(`[USER_EVENT] User: ${username}, Event: ${event}`);
                this.metrics.fallbackCount++;
            },
            connection: (event, details) => {
                console.log(`[CONNECTION] Event: ${event}, Details:`, details);
                this.metrics.fallbackCount++;
            },
            child: (metadata) => {
                return this.fallbackLogger; // Return self for simplicity
            }
        };
    }
    
    /**
     * Activates fallback logging
     * @private
     */
    activateFallback() {
        console.warn('LoggerCompatibilityLayer: Activating fallback logging mode');
        this.isUsingFallback = true;
        this.activeLogger = this.fallbackLogger;
    }
    
    /**
     * Initializes performance metrics
     * @private
     */
    initializeMetrics() {
        // Set up metrics collection interval
        this.metricsInterval = setInterval(() => {
            this.collectMetrics();
        }, 60000); // Collect metrics every minute
    }
    
    /**
     * Collects and logs performance metrics
     * @private
     */
    collectMetrics() {
        if (!this.enableMetrics) return;
        
        const uptime = Date.now() - this.metrics.startTime;
        const metricsData = {
            ...this.metrics,
            uptime,
            isUsingFallback: this.isUsingFallback || false,
            averageCallsPerSecond: this.metrics.callCount / (uptime / 1000),
            errorRate: this.metrics.errorCount / Math.max(this.metrics.callCount, 1)
        };
        
        // Log metrics using the active logger
        if (this.enhancedLogger && !this.isUsingFallback) {
            this.enhancedLogger.debug('LoggerCompatibilityLayer metrics', metricsData);
        }
    }
    
    /**
     * Wraps logger method calls with error handling and metrics
     * @private
     * @param {string} method - Method name
     * @param {Function} fn - Function to wrap
     * @returns {Function} Wrapped function
     */
    wrapMethod(method, fn) {
        return (...args) => {
            if (this.enableMetrics) {
                this.metrics.callCount++;
            }
            
            try {
                return fn.apply(this.enhancedLogger, args);
            } catch (error) {
                if (this.enableMetrics) {
                    this.metrics.errorCount++;
                }
                
                if (this.enableFallback && this.fallbackLogger) {
                    console.error(`LoggerCompatibilityLayer: ${method} failed, using fallback:`, error);
                    return this.fallbackLogger[method](...args);
                } else {
                    throw error;
                }
            }
        };
    }
    
    /**
     * Logs error messages
     * @param {string} message - Error message
     * @param {*} [context] - Additional context information
     */
    error(message, context) {
        if (this.isUsingFallback) {
            return this.fallbackLogger.error(message, context);
        }
        return this.wrapMethod('error', this.enhancedLogger.error)(message, context);
    }
    
    /**
     * Logs warning messages
     * @param {string} message - Warning message
     * @param {*} [context] - Additional context information
     */
    warn(message, context) {
        if (this.isUsingFallback) {
            return this.fallbackLogger.warn(message, context);
        }
        return this.wrapMethod('warn', this.enhancedLogger.warn)(message, context);
    }
    
    /**
     * Logs info messages
     * @param {string} message - Info message
     * @param {*} [context] - Additional context information
     */
    info(message, context) {
        if (this.isUsingFallback) {
            return this.fallbackLogger.info(message, context);
        }
        return this.wrapMethod('info', this.enhancedLogger.info)(message, context);
    }
    
    /**
     * Logs debug messages
     * @param {string} message - Debug message
     * @param {*} [context] - Additional context information
     */
    debug(message, context) {
        if (this.isUsingFallback) {
            return this.fallbackLogger.debug(message, context);
        }
        return this.wrapMethod('debug', this.enhancedLogger.debug)(message, context);
    }
    
    /**
     * Logs bot command execution
     * @param {string} username - Username who executed the command
     * @param {string} command - Command name
     * @param {Array|string} [args] - Command arguments
     */
    command(username, command, args) {
        if (this.isUsingFallback) {
            return this.fallbackLogger.command(username, command, args);
        }
        return this.wrapMethod('command', this.enhancedLogger.command)(username, command, args);
    }
    
    /**
     * Logs user events (join, leave, etc.)
     * @param {string} username - Username
     * @param {string} event - Event type (join, leave, etc.)
     */
    userEvent(username, event) {
        if (this.isUsingFallback) {
            return this.fallbackLogger.userEvent(username, event);
        }
        return this.wrapMethod('userEvent', this.enhancedLogger.userEvent)(username, event);
    }
    
    /**
     * Logs connection events
     * @param {string} event - Connection event type
     * @param {Object} [details={}] - Additional details about the connection event
     */
    connection(event, details = {}) {
        if (this.isUsingFallback) {
            return this.fallbackLogger.connection(event, details);
        }
        return this.wrapMethod('connection', this.enhancedLogger.connection)(event, details);
    }
    
    /**
     * Creates a child logger with additional metadata
     * @param {Object} [metadata={}] - Additional metadata to include in all logs
     * @returns {Object} Child logger instance
     */
    child(metadata = {}) {
        if (this.isUsingFallback) {
            return this.fallbackLogger.child(metadata);
        }
        
        try {
            const childLogger = this.enhancedLogger.child(metadata);
            
            // Wrap child logger methods with the same error handling
            return {
                error: this.wrapMethod('error', childLogger.error),
                warn: this.wrapMethod('warn', childLogger.warn),
                info: this.wrapMethod('info', childLogger.info),
                debug: this.wrapMethod('debug', childLogger.debug),
                command: this.wrapMethod('command', childLogger.command),
                userEvent: this.wrapMethod('userEvent', childLogger.userEvent),
                connection: this.wrapMethod('connection', childLogger.connection)
            };
        } catch (error) {
            if (this.enableMetrics) {
                this.metrics.errorCount++;
            }
            
            if (this.enableFallback) {
                console.error('LoggerCompatibilityLayer: child() failed, using fallback:', error);
                return this.fallbackLogger.child(metadata);
            } else {
                throw error;
            }
        }
    }
    
    /**
     * Gets the current log level
     * @returns {string} Current log level
     */
    getLevel() {
        if (this.isUsingFallback) {
            return this.options.level || 'info';
        }
        return this.enhancedLogger.getLevel();
    }
    
    /**
     * Sets the log level
     * @param {string} level - New log level (error, warn, info, debug)
     */
    setLevel(level) {
        if (this.isUsingFallback) {
            this.options.level = level;
            console.log(`LoggerCompatibilityLayer: Log level set to ${level} (fallback mode)`);
            return;
        }
        return this.enhancedLogger.setLevel(level);
    }
    
    /**
     * Checks if a log level is enabled
     * @param {string} level - Log level to check
     * @returns {boolean} True if level is enabled
     */
    isLevelEnabled(level) {
        if (this.isUsingFallback) {
            const levels = { error: 0, warn: 1, info: 2, debug: 3 };
            const currentLevel = this.options.level || 'info';
            return levels[level] <= levels[currentLevel];
        }
        return this.enhancedLogger.isLevelEnabled(level);
    }
    
    /**
     * Gets compatibility layer statistics
     * @returns {Object} Statistics including metrics and status
     */
    getStats() {
        const baseStats = {
            compatibility: 'legacy-to-enhanced',
            isUsingFallback: this.isUsingFallback || false,
            enableMetrics: this.enableMetrics,
            enableFallback: this.enableFallback,
            ...this.metrics
        };
        
        if (this.enhancedLogger && !this.isUsingFallback) {
            return {
                ...baseStats,
                enhanced: this.enhancedLogger.getStats()
            };
        }
        
        return baseStats;
    }
    
    /**
     * Closes the logger and all transports
     */
    async close() {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        
        if (this.enhancedLogger && !this.isUsingFallback) {
            await this.enhancedLogger.close();
        }
        
        console.log('LoggerCompatibilityLayer closed');
    }
}

// Singleton instance for backward compatibility
let compatibilityLayerInstance = null;

/**
 * Creates or returns singleton compatibility layer logger instance
 * @param {Object} [options] - Configuration options (legacy format)
 * @returns {LoggerCompatibilityLayer} Compatibility layer logger instance
 */
export function createLogger(options) {
    if (!compatibilityLayerInstance) {
        compatibilityLayerInstance = new LoggerCompatibilityLayer(options);
    }
    return compatibilityLayerInstance;
}

/**
 * Gets existing compatibility layer logger instance or creates new one with default options
 * @returns {LoggerCompatibilityLayer} Compatibility layer logger instance
 */
export function getLogger() {
    if (!compatibilityLayerInstance) {
        compatibilityLayerInstance = new LoggerCompatibilityLayer();
    }
    return compatibilityLayerInstance;
}

/**
 * Resets the singleton instance (useful for testing)
 */
export function resetLogger() {
    if (compatibilityLayerInstance) {
        compatibilityLayerInstance.close();
        compatibilityLayerInstance = null;
    }
}

export default LoggerCompatibilityLayer;