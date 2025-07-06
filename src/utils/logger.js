import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helper function to handle circular references in JSON.stringify
function getCircularReplacer() {
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

class Logger {
    constructor(options = {}) {
        this.logDir = options.logDir || path.join(__dirname, '../../logs');
        this.maxFileSize = options.maxFileSize || 200 * 1024; // 200KB
        this.maxFiles = options.maxFiles || 5;
        this.logToConsole = options.console !== false;
        this.logLevel = options.level || process.env.LOG_LEVEL || 'info';
        
        // Debug: Show what level we're actually using
        console.log(`[LOGGER DEBUG] Initialized with level: ${this.logLevel} (options.level: ${options.level})`);
        
        if (this.logLevel === 'warn') {
            console.log('[LOGGER DEBUG] ✅ Logger correctly set to WARN level - INFO messages will be suppressed');
        }
        
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        
        this.ensureLogDirectory();
        this.currentLogFile = this.getLogFileName();
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    getLogFileName() {
        const date = new Date().toISOString().split('T')[0];
        return path.join(this.logDir, `cytube-bot-${date}.log`);
    }

    shouldRotate() {
        try {
            const stats = fs.statSync(this.currentLogFile);
            return stats.size >= this.maxFileSize;
        } catch {
            return false;
        }
    }

    rotateLog() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedName = this.currentLogFile.replace('.log', `-${timestamp}.log`);
        
        fs.renameSync(this.currentLogFile, rotatedName);
        this.cleanOldLogs();
    }

    cleanOldLogs() {
        const files = fs.readdirSync(this.logDir)
            .filter(f => f.startsWith('cytube-bot-') && f.endsWith('.log'))
            .map(f => ({
                name: f,
                path: path.join(this.logDir, f),
                time: fs.statSync(path.join(this.logDir, f)).mtime
            }))
            .sort((a, b) => b.time - a.time);

        while (files.length > this.maxFiles) {
            const oldFile = files.pop();
            fs.unlinkSync(oldFile.path);
        }
    }

    formatMessage(level, message, context = {}) {
        const timestamp = new Date().toISOString();
        let contextStr = '';
        
        if (context instanceof Error) {
            // Handle Error objects specially to capture message and stack
            contextStr = ` ${JSON.stringify({
                message: context.message,
                stack: context.stack,
                ...context // Include any other enumerable properties
            })}`;
        } else if (Object.keys(context).length > 0) {
            try {
                contextStr = ` ${JSON.stringify(context)}`;
            } catch (err) {
                // Handle circular references or other stringify errors
                if (typeof context === 'string') {
                    contextStr = ` "${context}"`;
                } else {
                    contextStr = ` [Complex Object - Cannot Stringify]`;
                }
            }
        }
        
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}\n`;
    }

    write(level, message, context) {
        if (this.levels[level] > this.levels[this.logLevel]) {
            return;
        }

        const formatted = this.formatMessage(level, message, context);
        
        // Console output
        if (this.logToConsole) {
            const consoleMethod = level === 'error' ? console.error : 
                                 level === 'warn' ? console.warn : 
                                 console.log;
            consoleMethod(formatted.trim());
        }

        // File output
        try {
            // Check if we need to rotate
            if (this.shouldRotate()) {
                this.rotateLog();
            }

            // Check if date has changed
            const newLogFile = this.getLogFileName();
            if (newLogFile !== this.currentLogFile) {
                this.currentLogFile = newLogFile;
            }

            fs.appendFileSync(this.currentLogFile, formatted);
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    error(message, context) {
        this.write('error', message, context);
    }

    warn(message, context) {
        this.write('warn', message, context);
    }

    info(message, context) {
        this.write('info', message, context);
    }

    debug(message, context) {
        this.write('debug', message, context);
    }

    // Log bot-specific events
    command(username, command, args) {
        this.info(`Command executed`, {
            user: username,
            command: command,
            args: args
        });
    }

    userEvent(username, event) {
        this.info(`User ${event}`, {
            user: username,
            event: event
        });
    }

    connection(event, details = {}) {
        this.info(`Connection ${event}`, details);
    }

    // Child logger method for module compatibility
    child(metadata = {}) {
        const childLogger = Object.create(this);
        childLogger.metadata = { ...this.metadata, ...metadata };
        return childLogger;
    }
}

// Create singleton instance
let logger = null;

export function createLogger(options) {
    if (!logger) {
        logger = new Logger(options);
    }
    return logger;
}

export function getLogger() {
    if (!logger) {
        logger = new Logger();
    }
    return logger;
}