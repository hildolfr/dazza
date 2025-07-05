import winston from 'winston';
import path from 'path';
import { promises as fs } from 'fs';

async function createLogger(config = {}) {
    // Default configuration
    const defaultConfig = {
        level: 'info',
        console: {
            enabled: true,
            colorize: true
        },
        file: {
            enabled: true,
            path: './logs',
            maxSize: 10485760, // 10MB
            maxFiles: 5
        }
    };
    
    // Merge with provided config
    const logConfig = { ...defaultConfig, ...config };
    
    // Ensure log directory exists
    if (logConfig.file.enabled) {
        await fs.mkdir(logConfig.file.path, { recursive: true });
    }
    
    // Create transports
    const transports = [];
    
    // Console transport
    if (logConfig.console.enabled) {
        transports.push(new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize({ all: logConfig.console.colorize }),
                winston.format.timestamp(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
                    return `${timestamp} [${level}]: ${message} ${metaStr}`;
                })
            )
        }));
    }
    
    // File transport
    if (logConfig.file.enabled) {
        transports.push(new winston.transports.File({
            filename: path.join(logConfig.file.path, 'error.log'),
            level: 'error',
            maxsize: logConfig.file.maxSize,
            maxFiles: logConfig.file.maxFiles,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }));
        
        transports.push(new winston.transports.File({
            filename: path.join(logConfig.file.path, 'combined.log'),
            maxsize: logConfig.file.maxSize,
            maxFiles: logConfig.file.maxFiles,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        }));
    }
    
    // Create logger
    const logger = winston.createLogger({
        level: logConfig.level,
        format: winston.format.combine(
            winston.format.errors({ stack: true }),
            winston.format.timestamp(),
            winston.format.json()
        ),
        transports,
        exitOnError: false
    });
    
    // Add convenience methods
    logger.child = (meta) => {
        return {
            info: (message, data) => logger.info(message, { ...meta, ...data }),
            error: (message, data) => logger.error(message, { ...meta, ...data }),
            warn: (message, data) => logger.warn(message, { ...meta, ...data }),
            debug: (message, data) => logger.debug(message, { ...meta, ...data })
        };
    };
    
    return logger;
}

export default createLogger;