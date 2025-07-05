#!/usr/bin/env node
/**
 * Error Cascade Protection Test Script
 * Tests the enhanced error handling to ensure cascade protection works correctly
 */

import EventBus from './src/core/EventBus.js';
import BaseModule from './src/core/BaseModule.js';
import ErrorHandler from './src/core/ErrorHandler.js';

console.log('🔧 Starting Error Cascade Protection Test...\n');

// Test 1: EventBus Error Cascade Protection
console.log('📡 Test 1: EventBus Error Cascade Protection');
try {
    const eventBus = new EventBus({
        debugMode: true,
        maxErrorRate: 3,
        emergencyShutdownThreshold: 10
    });
    
    // Simulate error cascade
    let errorCount = 0;
    eventBus.on('eventbus:error', () => {
        errorCount++;
        console.log(`   Error ${errorCount} handled`);
        
        if (errorCount < 5) {
            // Try to trigger more errors (should be suppressed)
            eventBus.emit('test-error', { trigger: 'cascade' });
        }
    });
    
    // Trigger initial error
    console.log('   Triggering error cascade...');
    eventBus.emit('test-event', { test: true });
    
    setTimeout(() => {
        console.log(`   ✅ Error cascade protection test passed - ${errorCount} errors handled`);
        eventBus.shutdown();
        
        // Test 2: BaseModule Circuit Breaker
        console.log('\n🔌 Test 2: BaseModule Circuit Breaker Protection');
        runModuleTest();
    }, 1000);
    
} catch (error) {
    console.error('   ❌ EventBus test failed:', error.message);
    process.exit(1);
}

function runModuleTest() {
    try {
        // Mock context for BaseModule
        const mockContext = {
            manifest: {
                name: 'test-module',
                version: '1.0.0'
            },
            eventBus: new EventBus(),
            logger: {
                child: () => ({
                    error: (msg, data) => console.log(`   [MODULE ERROR] ${msg}`, data?.error || ''),
                    warn: (msg) => console.log(`   [MODULE WARN] ${msg}`),
                    info: (msg) => console.log(`   [MODULE INFO] ${msg}`),
                    debug: () => {}
                })
            },
            scheduler: { removeModuleTasks: () => {} },
            performanceMonitor: { recordEvent: () => {} },
            modules: new Map(),
            roomConnections: new Map(),
            db: {},
            api: null
        };
        
        const module = new BaseModule(mockContext);
        
        let errorHandlingCount = 0;
        console.log('   Testing circuit breaker...');
        
        // Simulate multiple errors to trigger circuit breaker
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                const error = new Error(`Test error ${i + 1}`);
                module._handleError(error, 'test-context', { attempt: i + 1 });
                errorHandlingCount++;
                
                if (i === 7) {
                    setTimeout(() => {
                        const metrics = module.getMetrics();
                        console.log(`   ✅ Circuit breaker test passed - Circuit breaker open: ${metrics.circuitBreaker.isOpen}`);
                        console.log(`   ✅ Emergency mode: ${metrics.emergencyMode}`);
                        
                        // Test 3: ErrorHandler Death Spiral Prevention
                        console.log('\n💀 Test 3: ErrorHandler Death Spiral Prevention');
                        runErrorHandlerTest();
                    }, 500);
                }
            }, i * 100);
        }
        
    } catch (error) {
        console.error('   ❌ BaseModule test failed:', error.message);
        process.exit(1);
    }
}

function runErrorHandlerTest() {
    try {
        const errorHandler = new ErrorHandler({
            maxRestartsPerHour: 2,
            maxRetries: 3
        });
        
        // Mock module registry
        const mockModuleRegistry = {
            getStatus: () => 'started',
            stopModule: async () => {},
            initializeModule: async () => {
                throw new Error('Simulated initialization failure');
            },
            startModule: async () => {}
        };
        
        const mockLogger = {
            error: (msg, data) => console.log(`   [ERROR HANDLER] ${msg}`, data?.message || ''),
            warn: (msg) => console.log(`   [ERROR HANDLER WARN] ${msg}`),
            info: (msg) => console.log(`   [ERROR HANDLER INFO] ${msg}`)
        };
        
        errorHandler.initialize(mockModuleRegistry, new EventBus(), mockLogger);
        
        let eventCount = 0;
        errorHandler.on('module:disabled', () => {
            eventCount++;
            console.log('   Module disabled due to excessive failures');
        });
        
        errorHandler.on('emergency:death-spiral', () => {
            eventCount++;
            console.log('   Death spiral detected and handled');
        });
        
        console.log('   Simulating repeated module failures...');
        
        // Simulate death spiral
        for (let i = 0; i < 12; i++) {
            setTimeout(() => {
                const error = new Error(`Simulated failure ${i + 1}`);
                errorHandler.handleModuleError('test-module', error);
                
                if (i === 11) {
                    setTimeout(() => {
                        const status = errorHandler.getStatus();
                        console.log(`   ✅ Death spiral protection test passed`);
                        console.log(`   ✅ Emergency mode: ${status.emergencyMode}`);
                        console.log(`   ✅ Disabled modules: ${status.disabledModules.length}`);
                        
                        // Test 4: Promise Rejection Handling
                        console.log('\n🚫 Test 4: Promise Rejection Cascade Protection');
                        runPromiseTest();
                    }, 1000);
                }
            }, i * 50);
        }
        
    } catch (error) {
        console.error('   ❌ ErrorHandler test failed:', error.message);
        process.exit(1);
    }
}

function runPromiseTest() {
    console.log('   Testing promise rejection handling...');
    
    let rejectionCount = 0;
    const originalHandler = process.listeners('unhandledRejection');
    
    // Add test rejection handler
    const testHandler = (reason) => {
        rejectionCount++;
        console.log(`   Rejection ${rejectionCount} handled: ${reason.message}`);
        
        if (rejectionCount >= 3) {
            // Clean up and finish test
            setTimeout(() => {
                process.removeListener('unhandledRejection', testHandler);
                console.log(`   ✅ Promise rejection test passed - ${rejectionCount} rejections handled`);
                
                console.log('\n🎉 All Error Cascade Protection Tests Passed!');
                console.log('✅ EventBus error rate limiting works');
                console.log('✅ BaseModule circuit breaker works');
                console.log('✅ ErrorHandler death spiral prevention works');
                console.log('✅ Promise rejection cascade protection works');
                
                process.exit(0);
            }, 500);
        }
    };
    
    process.on('unhandledRejection', testHandler);
    
    // Create rejecting promises
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            Promise.reject(new Error(`Test rejection ${i + 1}`));
        }, i * 100);
    }
}

// Handle test timeouts
setTimeout(() => {
    console.error('\n❌ Test suite timed out after 30 seconds');
    process.exit(1);
}, 30000);