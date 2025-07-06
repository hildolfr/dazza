#!/usr/bin/env node

/**
 * Demonstration of the EnhancedWinstonLogger capabilities
 * Shows all features and how to use them in practice
 */

import { createLogger, getLogger, resetLogger } from './src/utils/EnhancedWinstonLogger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🎯 Enhanced Winston Logger Demonstration');
console.log('=' .repeat(60));

// Demo 1: Basic Logger Creation
console.log('\n📝 Demo 1: Basic Logger Creation');
const logger = createLogger({
    logDir: path.join(__dirname, 'demo-logs'),
    level: 'debug',
    console: true,
    colorize: true
});

console.log('Logger created successfully!');

// Demo 2: Standard Logging Methods
console.log('\n📝 Demo 2: Standard Logging Methods');
logger.info('This is an info message');
logger.warn('This is a warning message');
logger.error('This is an error message');
logger.debug('This is a debug message');

// Demo 3: Logging with Context
console.log('\n📝 Demo 3: Logging with Context');
logger.info('User action performed', {
    user: 'dazza',
    action: 'login',
    timestamp: Date.now(),
    ip: '192.168.1.100'
});

// Demo 4: Bot-Specific Methods
console.log('\n📝 Demo 4: Bot-Specific Methods');
logger.command('dazza', 'bong', ['count']);
logger.userEvent('shazza', 'join');
logger.connection('established', {
    host: 'cytu.be',
    port: 443,
    secure: true
});

// Demo 5: Circular Reference Handling
console.log('\n📝 Demo 5: Circular Reference Handling');
const circularObj = { name: 'test', data: { value: 123 } };
circularObj.self = circularObj;
circularObj.data.parent = circularObj;

logger.info('Handling circular reference', circularObj);
logger.command('testuser', 'circular', circularObj);

// Demo 6: Error Object Handling
console.log('\n📝 Demo 6: Error Object Handling');
try {
    throw new Error('Demonstration error');
} catch (error) {
    error.customProperty = 'custom value';
    logger.error('Caught an error', error);
}

// Demo 7: Child Logger
console.log('\n📝 Demo 7: Child Logger');
const childLogger = logger.child({
    module: 'demo-module',
    version: '1.0.0',
    environment: 'development'
});

childLogger.info('Child logger message');
childLogger.command('dazza', 'child-command', ['arg1', 'arg2']);
childLogger.userEvent('dazza', 'child-event');
childLogger.connection('child-connection', { test: true });

// Demo 8: Log Level Management
console.log('\n📝 Demo 8: Log Level Management');
console.log(`Current log level: ${logger.getLevel()}`);
console.log(`Is debug enabled? ${logger.isLevelEnabled('debug')}`);
console.log(`Is info enabled? ${logger.isLevelEnabled('info')}`);

logger.setLevel('warn');
console.log(`After changing to warn level:`);
console.log(`Is debug enabled? ${logger.isLevelEnabled('debug')}`);
console.log(`Is info enabled? ${logger.isLevelEnabled('info')}`);
console.log(`Is warn enabled? ${logger.isLevelEnabled('warn')}`);

// This debug message should not appear
logger.debug('This debug message should not appear');
logger.warn('This warning message should appear');

// Demo 9: Complex Object Serialization
console.log('\n📝 Demo 9: Complex Object Serialization');
const complexObject = {
    date: new Date(),
    regex: /test/gi,
    buffer: Buffer.from('test data'),
    array: [1, 2, 3, { nested: true }],
    map: new Map([['key1', 'value1'], ['key2', 'value2']]),
    set: new Set([1, 2, 3, 4, 5]),
    undefined: undefined,
    null: null,
    function: function() { return 'test'; },
    nested: {
        deeply: {
            nested: {
                object: {
                    value: 'deep value'
                }
            }
        }
    }
};

logger.info('Complex object serialization', complexObject);

// Demo 10: Logger Statistics
console.log('\n📝 Demo 10: Logger Statistics');
const stats = logger.getStats();
console.log('Logger Statistics:', JSON.stringify(stats, null, 2));

// Demo 11: Multiple Loggers (Singleton Test)
console.log('\n📝 Demo 11: Singleton Behavior');
const logger2 = getLogger();
console.log(`Same instance? ${logger === logger2}`);

// Demo 12: Demonstrating Different Contexts
console.log('\n📝 Demo 12: Different Contexts');

// Bot command context
logger.command('dazza', 'help', []);
logger.command('shazza', 'bong', ['count', '5']);
logger.command('guest123', 'drink', ['beer']);

// User events context
logger.userEvent('dazza', 'join');
logger.userEvent('shazza', 'leave');
logger.userEvent('guest456', 'reconnect');

// Connection events context
logger.connection('connecting', { attempt: 1 });
logger.connection('connected', { latency: 45 });
logger.connection('disconnected', { reason: 'timeout' });
logger.connection('reconnecting', { attempt: 2, delay: 5000 });

// Mixed contexts
logger.info('Bot startup completed', {
    version: '1.0.0',
    uptime: 0,
    memory: process.memoryUsage(),
    pid: process.pid
});

logger.info('Database connection established', {
    host: 'localhost',
    database: 'cytube_stats.db',
    type: 'sqlite'
});

logger.warn('High memory usage detected', {
    current: '150MB',
    threshold: '100MB',
    action: 'cleanup_initiated'
});

// Demo 13: Structured Logging for Analytics
console.log('\n📝 Demo 13: Structured Logging for Analytics');
logger.info('User interaction', {
    type: 'analytics',
    event: 'command_executed',
    user: 'dazza',
    command: 'bong',
    args: ['count'],
    timestamp: Date.now(),
    session_id: 'sess_123456',
    room: 'fatpizza'
});

logger.info('System metric', {
    type: 'metrics',
    metric: 'response_time',
    value: 125,
    unit: 'ms',
    endpoint: '/health',
    timestamp: Date.now()
});

console.log('\n🎉 Demonstration completed!');
console.log('Check the demo-logs directory for generated log files.');
console.log('The logger combines Winston\'s power with bot-specific functionality.');

// Clean up
setTimeout(() => {
    logger.close().then(() => {
        console.log('\n✅ Logger closed successfully');
        process.exit(0);
    });
}, 1000);