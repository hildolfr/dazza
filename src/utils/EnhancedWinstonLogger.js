import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Enhanced Winston Logger that combines Winston's professional logging capabilities
 * with bot-specific functionality and circular reference handling.
 * 
 * This logger provides:
 * - Bot-specific convenience methods (command, userEvent, connection)
 * - Circular reference handling for complex objects
 * - Daily log file rotation with size-based rotation
 * - Console and file output with proper formatting
 * - Winston's structured logging capabilities
 * - Error handling with stack traces
 * - Configurable log levels and outputs
 */
class EnhancedWinstonLogger {
    /**
     * Creates an enhanced Winston logger instance
     * @param {Object} options - Configuration options
     * @param {string} [options.logDir='../../logs'] - Directory for log files
     * @param {number} [options.maxFileSize=204800] - Maximum file size in bytes (200KB)
     * @param {number} [options.maxFiles=5] - Maximum number of log files to retain
     * @param {boolean} [options.console=true] - Enable console output
     * @param {string} [options.level='info'] - Log level (error, warn, info, debug)
     * @param {boolean} [options.colorize=true] - Enable colorized console output
     * @param {boolean} [options.timestamp=true] - Include timestamps in logs
     * @param {string} [options.format='combined'] - Log format ('json', 'simple', 'combined')
     */
    constructor(options = {}) {
        // Configuration with defaults
        this.config = {
            logDir: options.logDir || path.join(__dirname, '../../logs'),
            maxFileSize: options.maxFileSize || 204800, // 200KB to match legacy
            maxFiles: options.maxFiles || 5,
            console: options.console !== false,
            level: options.level || process.env.LOG_LEVEL || 'info',
            colorize: options.colorize !== false,
            timestamp: options.timestamp !== false,
            format: options.format || 'combined'
        };

        // Ensure log directory exists
        this.ensureLogDirectory();

        // Create Winston logger instance
        this.winston = this.createWinstonLogger();

        // Set up circular reference handling
        this.circularReplacer = this.createCircularReplacer();

        // Create convenience method bindings
        this.bindMethods();

        // Log initialization
        this.winston.info('EnhancedWinstonLogger initialized', {
            level: this.config.level,
            logDir: this.config.logDir,
            maxFileSize: this.config.maxFileSize,
            maxFiles: this.config.maxFiles,
            console: this.config.console,
            format: this.config.format
        });
    }

    /**
     * Ensures the log directory exists
     * @private
     */
    ensureLogDirectory() {
        if (!fs.existsSync(this.config.logDir)) {
            fs.mkdirSync(this.config.logDir, { recursive: true });
        }
    }

    /**
     * Creates the Winston logger instance with proper configuration
     * @private
     * @returns {winston.Logger} Configured Winston logger
     */
    createWinstonLogger() {
        const transports = [];

        // Console transport
        if (this.config.console) {
            transports.push(new winston.transports.Console({
                level: this.config.level,
                format: winston.format.combine(
                    winston.format.errors({ stack: true }),
                    winston.format.timestamp(),
                    this.config.colorize ? winston.format.colorize() : winston.format.uncolorize(),
                    winston.format.printf(({ timestamp, level, message, ...meta }) => {
                        const metaStr = Object.keys(meta).length > 0 ? 
                            ` ${JSON.stringify(meta, this.circularReplacer)}` : '';
                        return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
                    })
                )
            }));
        }

        // Daily rotating file transport (matches legacy naming: cytube-bot-YYYY-MM-DD.log)
        const dailyLogFile = this.getDailyLogFileName();
        transports.push(new winston.transports.File({
            filename: dailyLogFile,
            level: this.config.level,
            maxsize: this.config.maxFileSize,
            maxFiles: this.config.maxFiles,
            format: winston.format.combine(
                winston.format.errors({ stack: true }),
                winston.format.timestamp(),
                winston.format.json({ replacer: this.circularReplacer })
            ),
            options: { flags: 'a' } // append mode
        }));

        // Error-only log file
        transports.push(new winston.transports.File({
            filename: path.join(this.config.logDir, 'error.log'),
            level: 'error',
            maxsize: this.config.maxFileSize,
            maxFiles: this.config.maxFiles,
            format: winston.format.combine(
                winston.format.errors({ stack: true }),
                winston.format.timestamp(),
                winston.format.json({ replacer: this.circularReplacer })
            )
        }));

        // Create logger
        const logger = winston.createLogger({
            level: this.config.level,
            format: winston.format.combine(
                winston.format.errors({ stack: true }),
                winston.format.timestamp(),
                winston.format.json({ replacer: this.circularReplacer })
            ),
            transports,
            exitOnError: false,
            silent: false
        });

        return logger;
    }

    /**
     * Gets the daily log file name based on current date
     * @private
     * @returns {string} Full path to daily log file
     */
    getDailyLogFileName() {
        const date = new Date().toISOString().split('T')[0];
        return path.join(this.config.logDir, `cytube-bot-${date}.log`);
    }

    /**
     * Creates a circular reference replacer for JSON serialization
     * @private
     * @returns {Function} Circular reference replacer function
     */
    createCircularReplacer() {
        const seen = new WeakSet();
        return (key, value) => {
            if (typeof value === "object" && value !== null) {
                if (seen.has(value)) {
                    return "[Circular]";
                }
                seen.add(value);
            }
            return value;
        };
    }

    /**
     * Sanitizes context objects to handle circular references and complex objects
     * @private
     * @param {*} context - Context object to sanitize
     * @returns {*} Sanitized context object
     */
    sanitizeContext(context) {
        if (context === null || context === undefined) {
            return context;
        }

        if (context instanceof Error) {
            // Handle Error objects specially to capture message and stack
            return {
                message: context.message,
                stack: context.stack,
                name: context.name,
                ...context // Include any other enumerable properties
            };
        }

        if (typeof context === 'object') {
            try {
                // Test if object can be JSON stringified
                JSON.stringify(context);
                return context;
            } catch (err) {
                // If stringify fails, try to create a safe representation
                try {
                    return JSON.parse(JSON.stringify(context, this.circularReplacer));
                } catch (innerErr) {
                    return { 
                        _note: 'Complex object could not be serialized',
                        _type: Object.prototype.toString.call(context),
                        _keys: Object.keys(context).slice(0, 10) // First 10 keys only
                    };
                }
            }
        }

        return context;
    }

    /**
     * Binds methods to preserve 'this' context
     * @private
     */
    bindMethods() {
        // Bind standard logging methods
        this.error = this.error.bind(this);
        this.warn = this.warn.bind(this);
        this.info = this.info.bind(this);
        this.debug = this.debug.bind(this);

        // Bind bot-specific methods
        this.command = this.command.bind(this);
        this.userEvent = this.userEvent.bind(this);
        this.connection = this.connection.bind(this);
    }

    /**
     * Logs error messages
     * @param {string} message - Error message
     * @param {*} [context] - Additional context information
     */
    error(message, context) {
        const sanitizedContext = this.sanitizeContext(context);
        this.winston.error(message, sanitizedContext);
    }

    /**
     * Logs warning messages
     * @param {string} message - Warning message
     * @param {*} [context] - Additional context information
     */
    warn(message, context) {
        const sanitizedContext = this.sanitizeContext(context);
        this.winston.warn(message, sanitizedContext);
    }

    /**
     * Logs info messages
     * @param {string} message - Info message
     * @param {*} [context] - Additional context information
     */
    info(message, context) {
        const sanitizedContext = this.sanitizeContext(context);
        this.winston.info(message, sanitizedContext);
    }

    /**
     * Logs debug messages
     * @param {string} message - Debug message
     * @param {*} [context] - Additional context information
     */
    debug(message, context) {
        const sanitizedContext = this.sanitizeContext(context);
        this.winston.debug(message, sanitizedContext);
    }

    /**
     * Logs bot command execution
     * @param {string} username - Username who executed the command
     * @param {string} command - Command name
     * @param {Array|string} [args] - Command arguments
     */
    command(username, command, args) {
        this.winston.info('Command executed', {
            type: 'command',
            user: username,
            command: command,
            args: args || [],
            timestamp: Date.now()
        });
    }

    /**
     * Logs user events (join, leave, etc.)
     * @param {string} username - Username
     * @param {string} event - Event type (join, leave, etc.)
     */
    userEvent(username, event) {
        this.winston.info(`User ${event}`, {
            type: 'user_event',
            user: username,
            event: event,
            timestamp: Date.now()
        });
    }

    /**
     * Logs connection events
     * @param {string} event - Connection event type
     * @param {Object} [details={}] - Additional details about the connection event
     */
    connection(event, details = {}) {
        this.winston.info(`Connection ${event}`, {
            type: 'connection',
            event: event,
            ...details,
            timestamp: Date.now()
        });
    }

    /**
     * Creates a child logger with additional metadata
     * @param {Object} [metadata={}] - Additional metadata to include in all logs
     * @returns {Object} Child logger instance
     */
    child(metadata = {}) {
        const childLogger = {
            // Create bound methods that include the metadata
            error: (message, context) => {
                const mergedContext = { ...metadata, ...this.sanitizeContext(context) };
                this.winston.error(message, mergedContext);
            },
            warn: (message, context) => {
                const mergedContext = { ...metadata, ...this.sanitizeContext(context) };
                this.winston.warn(message, mergedContext);
            },
            info: (message, context) => {
                const mergedContext = { ...metadata, ...this.sanitizeContext(context) };
                this.winston.info(message, mergedContext);
            },
            debug: (message, context) => {
                const mergedContext = { ...metadata, ...this.sanitizeContext(context) };
                this.winston.debug(message, mergedContext);
            },
            command: (username, command, args) => {
                this.winston.info('Command executed', {
                    ...metadata,
                    type: 'command',
                    user: username,
                    command: command,
                    args: args || [],
                    timestamp: Date.now()
                });
            },
            userEvent: (username, event) => {
                this.winston.info(`User ${event}`, {
                    ...metadata,
                    type: 'user_event',
                    user: username,
                    event: event,
                    timestamp: Date.now()
                });
            },
            connection: (event, details = {}) => {
                this.winston.info(`Connection ${event}`, {
                    ...metadata,
                    type: 'connection',
                    event: event,
                    ...details,
                    timestamp: Date.now()
                });
            }
        };

        return childLogger;
    }

    /**
     * Rotates log files manually (Winston handles this automatically, but provided for compatibility)
     * @deprecated Winston handles rotation automatically
     */
    rotate() {
        this.winston.info('Manual log rotation requested (Winston handles this automatically)');
    }

    /**
     * Closes the logger and all transports
     */
    close() {
        return new Promise((resolve) => {
            this.winston.info('Closing logger...');
            this.winston.close(() => {
                resolve();
            });
        });
    }

    /**
     * Gets the current log level
     * @returns {string} Current log level
     */
    getLevel() {
        return this.winston.level;
    }

    /**
     * Sets the log level
     * @param {string} level - New log level (error, warn, info, debug)
     */
    setLevel(level) {
        this.winston.level = level;
        
        // Update all transports to the new level
        this.winston.transports.forEach(transport => {
            if (transport.level !== 'error') { // Don't change error-only transport
                transport.level = level;
            }
        });
        
        this.winston.info(`Log level changed to: ${level}`);
    }

    /**
     * Checks if a log level is enabled
     * @param {string} level - Log level to check
     * @returns {boolean} True if level is enabled
     */
    isLevelEnabled(level) {
        return this.winston.isLevelEnabled(level);
    }

    /**
     * Gets logger statistics
     * @returns {Object} Logger statistics
     */
    getStats() {
        return {
            level: this.winston.level,
            transports: this.winston.transports.length,
            logDir: this.config.logDir,
            maxFileSize: this.config.maxFileSize,
            maxFiles: this.config.maxFiles,
            console: this.config.console,
            format: this.config.format
        };
    }
}

// Singleton instance for backward compatibility
let loggerInstance = null;

/**
 * Creates or returns singleton logger instance
 * @param {Object} [options] - Configuration options
 * @returns {EnhancedWinstonLogger} Logger instance
 */
export function createLogger(options) {
    if (!loggerInstance) {
        loggerInstance = new EnhancedWinstonLogger(options);
    }
    return loggerInstance;
}

/**
 * Gets existing logger instance or creates new one with default options
 * @returns {EnhancedWinstonLogger} Logger instance
 */
export function getLogger() {
    if (!loggerInstance) {
        loggerInstance = new EnhancedWinstonLogger();
    }
    return loggerInstance;
}

/**
 * Resets the singleton instance (useful for testing)
 */
export function resetLogger() {
    if (loggerInstance) {
        loggerInstance.close();
        loggerInstance = null;
    }
}

export default EnhancedWinstonLogger;