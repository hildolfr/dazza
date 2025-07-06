#!/usr/bin/env node

/**
 * Comprehensive test suite for EnhancedWinstonLogger
 * Tests all functionality including bot-specific methods, circular reference handling,
 * Winston integration, and API compatibility.
 */

import { createLogger, getLogger, resetLogger } from './src/utils/EnhancedWinstonLogger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test configuration
const testConfig = {
    logDir: path.join(__dirname, 'test-logs'),
    maxFileSize: 1024, // 1KB for faster testing
    maxFiles: 3,
    console: true,
    level: 'debug',
    colorize: false // Disable colors for cleaner test output
};

// Test utilities
function createTestDirectory() {
    if (!fs.existsSync(testConfig.logDir)) {
        fs.mkdirSync(testConfig.logDir, { recursive: true });
    }
}

function cleanupTestDirectory() {
    if (fs.existsSync(testConfig.logDir)) {
        const files = fs.readdirSync(testConfig.logDir);
        files.forEach(file => {
            fs.unlinkSync(path.join(testConfig.logDir, file));
        });
        fs.rmdirSync(testConfig.logDir);
    }
}

function createCircularObject() {
    const obj = { name: 'test', data: { value: 123 } };
    obj.self = obj;
    obj.data.parent = obj;
    return obj;
}

// Test runner
class TestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
        this.errors = [];
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log('🚀 Starting EnhancedWinstonLogger Test Suite');
        console.log('=' .repeat(60));

        for (const { name, fn } of this.tests) {
            try {
                console.log(`\n🧪 Testing: ${name}`);
                await fn();
                console.log(`✅ PASSED: ${name}`);
                this.passed++;
            } catch (error) {
                console.log(`❌ FAILED: ${name}`);
                console.log(`   Error: ${error.message}`);
                this.errors.push({ test: name, error });
                this.failed++;
            }
        }

        this.printSummary();
    }

    printSummary() {
        console.log('\n' + '=' .repeat(60));
        console.log('📊 Test Results Summary');
        console.log('=' .repeat(60));
        console.log(`✅ Passed: ${this.passed}`);
        console.log(`❌ Failed: ${this.failed}`);
        console.log(`📈 Total: ${this.tests.length}`);
        console.log(`🎯 Success Rate: ${((this.passed / this.tests.length) * 100).toFixed(1)}%`);

        if (this.errors.length > 0) {
            console.log('\n🔍 Error Details:');
            this.errors.forEach(({ test, error }) => {
                console.log(`\n❌ ${test}:`);
                console.log(`   ${error.message}`);
                if (error.stack) {
                    console.log(`   Stack: ${error.stack.split('\n')[1]?.trim()}`);
                }
            });
        }

        console.log('\n' + '=' .repeat(60));
    }

    assert(condition, message) {
        if (!condition) {
            throw new Error(message || 'Assertion failed');
        }
    }

    assertExists(value, message) {
        this.assert(value !== undefined && value !== null, message || 'Value should exist');
    }

    assertType(value, type, message) {
        this.assert(typeof value === type, message || `Expected type ${type}, got ${typeof value}`);
    }

    assertIncludes(container, value, message) {
        this.assert(container.includes(value), message || `Container should include ${value}`);
    }
}

// Initialize test runner
const runner = new TestRunner();

// Test 1: Basic Logger Creation and Initialization
runner.test('Logger Creation and Initialization', async () => {
    resetLogger();
    createTestDirectory();
    
    const logger = createLogger(testConfig);
    
    runner.assertExists(logger, 'Logger should be created');
    runner.assertType(logger.info, 'function', 'Logger should have info method');
    runner.assertType(logger.error, 'function', 'Logger should have error method');
    runner.assertType(logger.warn, 'function', 'Logger should have warn method');
    runner.assertType(logger.debug, 'function', 'Logger should have debug method');
    
    // Test singleton behavior
    const logger2 = getLogger();
    runner.assert(logger === logger2, 'getLogger should return same instance');
    
    cleanupTestDirectory();
});

// Test 2: Bot-Specific Methods
runner.test('Bot-Specific Methods', async () => {
    resetLogger();
    createTestDirectory();
    
    const logger = createLogger(testConfig);
    
    // Test command method
    runner.assertType(logger.command, 'function', 'Logger should have command method');
    logger.command('testuser', 'bong', ['arg1', 'arg2']);
    
    // Test userEvent method
    runner.assertType(logger.userEvent, 'function', 'Logger should have userEvent method');
    logger.userEvent('testuser', 'join');
    
    // Test connection method
    runner.assertType(logger.connection, 'function', 'Logger should have connection method');
    logger.connection('established', { host: 'example.com', port: 443 });
    
    cleanupTestDirectory();
});

// Test 3: Circular Reference Handling
runner.test('Circular Reference Handling', async () => {
    resetLogger();
    createTestDirectory();
    
    const logger = createLogger(testConfig);
    const circularObj = createCircularObject();
    
    // Should not throw error
    logger.info('Testing circular reference', circularObj);
    logger.error('Error with circular reference', circularObj);
    
    // Test with circular reference as context
    const complexContext = {
        user: 'testuser',
        data: circularObj,
        metadata: { nested: { circular: circularObj } }
    };
    
    logger.command('testuser', 'complex', complexContext);
    
    cleanupTestDirectory();
});

// Test 4: Error Object Handling
runner.test('Error Object Handling', async () => {
    resetLogger();
    createTestDirectory();
    
    const logger = createLogger(testConfig);
    
    // Test with Error object
    const error = new Error('Test error message');
    error.code = 'TEST_ERROR';
    error.details = { custom: 'data' };
    
    logger.error('Error occurred', error);
    
    // Test with custom error
    const customError = {
        name: 'CustomError',
        message: 'Custom error message',
        stack: 'fake stack trace'
    };
    
    logger.error('Custom error', customError);
    
    cleanupTestDirectory();
});

// Test 5: Child Logger Functionality
runner.test('Child Logger Functionality', async () => {
    resetLogger();
    createTestDirectory();
    
    const logger = createLogger(testConfig);
    
    // Test child logger creation
    const childLogger = logger.child({ module: 'test-module', version: '1.0' });
    
    runner.assertExists(childLogger, 'Child logger should be created');
    runner.assertType(childLogger.info, 'function', 'Child logger should have info method');
    runner.assertType(childLogger.command, 'function', 'Child logger should have command method');
    
    // Test child logger methods
    childLogger.info('Child logger test message');
    childLogger.command('testuser', 'child-command', ['arg1']);
    childLogger.userEvent('testuser', 'child-event');
    childLogger.connection('child-connection', { test: true });
    
    cleanupTestDirectory();
});

// Test 6: Log Level Configuration
runner.test('Log Level Configuration', async () => {
    resetLogger();
    createTestDirectory();
    
    const logger = createLogger({ ...testConfig, level: 'warn' });
    
    runner.assert(logger.getLevel() === 'warn', 'Logger should have correct initial level');
    
    // Test level checking
    runner.assert(logger.isLevelEnabled('error'), 'Error level should be enabled');
    runner.assert(logger.isLevelEnabled('warn'), 'Warn level should be enabled');
    runner.assert(!logger.isLevelEnabled('info'), 'Info level should be disabled');
    runner.assert(!logger.isLevelEnabled('debug'), 'Debug level should be disabled');
    
    // Test level changing
    logger.setLevel('debug');
    runner.assert(logger.getLevel() === 'debug', 'Logger level should be updated');
    runner.assert(logger.isLevelEnabled('debug'), 'Debug level should now be enabled');
    
    cleanupTestDirectory();
});

// Test 7: File Output Generation
runner.test('File Output Generation', async () => {
    resetLogger();
    createTestDirectory();
    
    const logger = createLogger(testConfig);
    
    // Generate some log messages
    logger.info('Test info message');
    logger.error('Test error message');
    logger.warn('Test warn message');
    logger.debug('Test debug message');
    
    // Generate bot-specific logs
    logger.command('testuser', 'test-command', ['arg1', 'arg2']);
    logger.userEvent('testuser', 'join');
    logger.connection('established', { host: 'test.com' });
    
    // Wait a bit for file writes
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if log files were created
    const logFiles = fs.readdirSync(testConfig.logDir);
    runner.assert(logFiles.length > 0, 'Log files should be created');
    
    // Check if daily log file exists
    const dailyLogExists = logFiles.some(file => file.includes('cytube-bot-'));
    runner.assert(dailyLogExists, 'Daily log file should exist');
    
    // Check if error log exists
    const errorLogExists = logFiles.some(file => file === 'error.log');
    runner.assert(errorLogExists, 'Error log file should exist');
    
    cleanupTestDirectory();
});

// Test 8: Logger Statistics
runner.test('Logger Statistics', async () => {
    resetLogger();
    createTestDirectory();
    
    const logger = createLogger(testConfig);
    const stats = logger.getStats();
    
    runner.assertExists(stats, 'Stats should be available');
    runner.assert(stats.level === testConfig.level, 'Stats should show correct level');
    runner.assert(stats.logDir === testConfig.logDir, 'Stats should show correct log directory');
    runner.assert(stats.maxFileSize === testConfig.maxFileSize, 'Stats should show correct max file size');
    runner.assert(stats.maxFiles === testConfig.maxFiles, 'Stats should show correct max files');
    runner.assert(stats.console === testConfig.console, 'Stats should show correct console setting');
    runner.assert(stats.transports > 0, 'Stats should show transport count');
    
    cleanupTestDirectory();
});

// Test 9: Complex Object Serialization
runner.test('Complex Object Serialization', async () => {
    resetLogger();
    createTestDirectory();
    
    const logger = createLogger(testConfig);
    
    // Test with various complex objects
    const complexObjects = [
        { date: new Date(), regex: /test/g, buffer: Buffer.from('test') },
        { function: () => 'test', undefined: undefined, null: null },
        { nested: { deeply: { nested: { object: { value: 'test' } } } } },
        [1, 2, 3, { array: true, nested: [4, 5, 6] }],
        new Map([['key1', 'value1'], ['key2', 'value2']]),
        new Set([1, 2, 3, 4, 5])
    ];
    
    complexObjects.forEach((obj, index) => {
        logger.info(`Complex object test ${index}`, obj);
    });
    
    cleanupTestDirectory();
});

// Test 10: API Compatibility with Legacy Logger
runner.test('API Compatibility with Legacy Logger', async () => {
    resetLogger();
    createTestDirectory();
    
    const logger = createLogger(testConfig);
    
    // Test all legacy logger methods exist
    const legacyMethods = ['error', 'warn', 'info', 'debug', 'command', 'userEvent', 'connection', 'child'];
    
    legacyMethods.forEach(method => {
        runner.assertType(logger[method], 'function', `Legacy method ${method} should exist`);
    });
    
    // Test legacy usage patterns
    logger.error('Legacy error message', { context: 'test' });
    logger.warn('Legacy warn message');
    logger.info('Legacy info message', { user: 'testuser' });
    logger.debug('Legacy debug message', { debug: true });
    
    // Test legacy bot methods
    logger.command('testuser', 'legacy-command', ['arg1', 'arg2']);
    logger.userEvent('testuser', 'legacy-event');
    logger.connection('legacy-connection', { legacy: true });
    
    // Test legacy child logger
    const childLogger = logger.child({ legacy: true });
    childLogger.info('Legacy child logger message');
    
    cleanupTestDirectory();
});

// Test 11: Configuration Validation
runner.test('Configuration Validation', async () => {
    resetLogger();
    createTestDirectory();
    
    // Test with minimal config
    const minimalLogger = createLogger({ logDir: testConfig.logDir });
    runner.assertExists(minimalLogger, 'Logger should work with minimal config');
    
    // Test with no config
    resetLogger();
    const defaultLogger = createLogger();
    runner.assertExists(defaultLogger, 'Logger should work with no config');
    
    // Test with all options
    resetLogger();
    const fullConfigLogger = createLogger({
        logDir: testConfig.logDir,
        maxFileSize: 2048,
        maxFiles: 10,
        console: false,
        level: 'error',
        colorize: true,
        timestamp: true,
        format: 'json'
    });
    runner.assertExists(fullConfigLogger, 'Logger should work with full config');
    
    cleanupTestDirectory();
});

// Test 12: Concurrent Logging
runner.test('Concurrent Logging', async () => {
    resetLogger();
    createTestDirectory();
    
    const logger = createLogger(testConfig);
    
    // Generate concurrent logs
    const promises = [];
    for (let i = 0; i < 10; i++) {
        promises.push(
            Promise.resolve().then(() => {
                logger.info(`Concurrent message ${i}`, { thread: i });
                logger.command(`user${i}`, `command${i}`, [`arg${i}`]);
                logger.userEvent(`user${i}`, 'concurrent-event');
                logger.connection(`connection${i}`, { concurrent: true });
            })
        );
    }
    
    await Promise.all(promises);
    
    // Wait for file writes
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Check if files were created
    const logFiles = fs.readdirSync(testConfig.logDir);
    runner.assert(logFiles.length > 0, 'Log files should be created from concurrent logging');
    
    cleanupTestDirectory();
});

// Run all tests
async function runTests() {
    console.log('🔧 Setting up test environment...');
    
    try {
        await runner.run();
        
        // Clean up any remaining test files
        try {
            cleanupTestDirectory();
        } catch (error) {
            console.log('⚠️  Warning: Could not clean up test directory completely');
        }
        
        console.log('\n🏁 Test suite completed');
        process.exit(runner.failed > 0 ? 1 : 0);
    } catch (error) {
        console.error('💥 Test suite failed with error:', error);
        process.exit(1);
    }
}

// Start tests
runTests().catch(console.error);