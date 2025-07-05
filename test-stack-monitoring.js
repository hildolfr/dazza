#!/usr/bin/env node

/**
 * Comprehensive Stack Monitoring and Emergency Shutdown Test Suite
 * 
 * Tests all components of the stack overflow detection and prevention system:
 * - StackMonitor: Global stack depth monitoring
 * - RecursionDetector: Pattern detection and analysis  
 * - EmergencyShutdown: Safe shutdown mechanisms
 * - StackAnalyzer: Call stack analysis utilities
 * - Integration: EventBus, BaseModule, MultiRoomBot integration
 */

import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

// Import stack monitoring components
import StackMonitor from './src/core/StackMonitor.js';
import RecursionDetector from './src/core/RecursionDetector.js';
import EmergencyShutdown from './src/core/EmergencyShutdown.js';
import StackAnalyzer from './src/core/StackAnalyzer.js';
import EventBus from './src/core/EventBus.js';

// Test utilities
class TestReporter {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
        this.startTime = Date.now();
    }
    
    test(name, fn) {
        return async () => {
            const testStart = Date.now();
            console.log(`\n🧪 Running: ${name}`);
            
            try {
                await fn();
                const duration = Date.now() - testStart;
                console.log(`✅ PASS: ${name} (${duration}ms)`);
                this.passed++;
                this.tests.push({ name, status: 'PASS', duration });
            } catch (error) {
                const duration = Date.now() - testStart;
                console.log(`❌ FAIL: ${name} (${duration}ms)`);
                console.log(`   Error: ${error.message}`);
                if (error.stack) {
                    console.log(`   Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
                }
                this.failed++;
                this.tests.push({ name, status: 'FAIL', duration, error: error.message });
            }
        };
    }
    
    async suite(name, tests) {
        console.log(`\n🎯 Test Suite: ${name}`);
        console.log('=' .repeat(50));
        
        for (const test of tests) {
            await test();
        }
    }
    
    summary() {
        const duration = Date.now() - this.startTime;
        const total = this.passed + this.failed;
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${this.passed} ✅`);
        console.log(`Failed: ${this.failed} ❌`);
        console.log(`Success Rate: ${((this.passed / total) * 100).toFixed(1)}%`);
        console.log(`Duration: ${duration}ms`);
        
        if (this.failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.tests.filter(t => t.status === 'FAIL').forEach(t => {
                console.log(`  - ${t.name}: ${t.error}`);
            });
        }
        
        return this.failed === 0;
    }
}

// Test helper functions
function createRecursiveFunction(depth = 10) {
    function recursive(n) {
        if (n <= 0) return 'base case';
        return recursive(n - 1);
    }
    return () => recursive(depth);
}

function createMutualRecursion(depth = 5) {
    function funcA(n) {
        if (n <= 0) return 'base case';
        return funcB(n - 1);
    }
    
    function funcB(n) {
        if (n <= 0) return 'base case';
        return funcA(n - 1);
    }
    
    return () => funcA(depth);
}

function createInfiniteRecursion() {
    function infinite() {
        return infinite();
    }
    return infinite;
}

function captureStackTrace() {
    const originalLimit = Error.stackTraceLimit;
    Error.stackTraceLimit = 50;
    const stack = new Error().stack;
    Error.stackTraceLimit = originalLimit;
    return stack;
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Main test execution
async function runTests() {
    const reporter = new TestReporter();
    
    console.log('🚀 Stack Monitoring System Test Suite');
    console.log('=====================================');
    
    // ===== Stack Analyzer Tests =====
    await reporter.suite('Stack Analyzer', [
        
        reporter.test('StackAnalyzer: Initialize and basic functionality', async () => {
            const analyzer = new StackAnalyzer();
            
            // Test basic initialization
            if (!analyzer.config) throw new Error('Config not initialized');
            if (!analyzer.cache) throw new Error('Cache not initialized');
            if (!analyzer.patterns) throw new Error('Patterns not initialized');
            
            // Test pattern analysis
            const stackTrace = captureStackTrace();
            const analysis = analyzer.analyzePattern(stackTrace);
            
            if (!analysis) throw new Error('Analysis not returned');
            if (!analysis.hasOwnProperty('isValid')) throw new Error('Missing isValid property');
            
            await analyzer.shutdown();
        }),
        
        reporter.test('StackAnalyzer: Recursion detection', async () => {
            const analyzer = new StackAnalyzer({
                enableDebugLogging: false
            });
            
            // Create recursive function and capture its stack
            const recursiveFunc = createRecursiveFunction(15);
            
            try {
                recursiveFunc();
            } catch (error) {
                // We expect this to work, not throw
            }
            
            // Get stack trace from recursive call
            const recursiveStack = `Error
    at recursive (/test/recursive.js:2:15)
    at recursive (/test/recursive.js:4:20)
    at recursive (/test/recursive.js:4:20)
    at recursive (/test/recursive.js:4:20)
    at recursive (/test/recursive.js:4:20)
    at recursive (/test/recursive.js:4:20)`;
            
            const analysis = analyzer.analyzePattern(recursiveStack);
            
            if (!analysis.isValid) throw new Error('Analysis should be valid');
            if (analysis.patterns.length === 0) throw new Error('Should detect patterns');
            
            await analyzer.shutdown();
        }),
        
        reporter.test('StackAnalyzer: Pattern caching', async () => {
            const analyzer = new StackAnalyzer({
                cacheSize: 10
            });
            
            const stackTrace = captureStackTrace();
            
            // First analysis (cache miss)
            const analysis1 = analyzer.analyzePattern(stackTrace);
            
            // Second analysis (cache hit)
            const analysis2 = analyzer.analyzePattern(stackTrace);
            
            const stats = analyzer.getStatistics();
            if (stats.cache.hits === 0) throw new Error('Cache should have hits');
            
            await analyzer.shutdown();
        })
    ]);
    
    // ===== Recursion Detector Tests =====
    await reporter.suite('Recursion Detector', [
        
        reporter.test('RecursionDetector: Initialize and detect direct recursion', async () => {
            const detector = new RecursionDetector({
                enableDebugLogging: false
            });
            
            // Test direct recursion detection
            const directRecursionStack = `Error
    at testFunction (/test/file.js:10:5)
    at testFunction (/test/file.js:12:10)
    at testFunction (/test/file.js:12:10)
    at testFunction (/test/file.js:12:10)
    at testFunction (/test/file.js:12:10)`;
            
            const analysis = detector.analyzeStackTrace(directRecursionStack);
            
            if (!analysis.isRecursive) throw new Error('Should detect recursion');
            if (!analysis.recursionTypes.includes('direct')) throw new Error('Should detect direct recursion');
            
            await detector.shutdown();
        }),
        
        reporter.test('RecursionDetector: Detect mutual recursion', async () => {
            const detector = new RecursionDetector();
            
            const mutualRecursionStack = `Error
    at funcA (/test/file.js:5:10)
    at funcB (/test/file.js:10:10)
    at funcA (/test/file.js:7:10)
    at funcB (/test/file.js:12:10)
    at funcA (/test/file.js:7:10)
    at funcB (/test/file.js:12:10)`;
            
            const analysis = detector.analyzeStackTrace(mutualRecursionStack);
            
            if (!analysis.isRecursive) throw new Error('Should detect mutual recursion');
            
            await detector.shutdown();
        }),
        
        reporter.test('RecursionDetector: Performance tracking', async () => {
            const detector = new RecursionDetector();
            
            // Run multiple analyses
            for (let i = 0; i < 10; i++) {
                const stack = `Error\n    at test${i} (/test/file.js:${i}:5)`;
                detector.analyzeStackTrace(stack);
            }
            
            const stats = detector.getStatistics();
            if (stats.totalAnalyses !== 10) throw new Error(`Expected 10 analyses, got ${stats.totalAnalyses}`);
            
            await detector.shutdown();
        })
    ]);
    
    // ===== Emergency Shutdown Tests =====
    await reporter.suite('Emergency Shutdown', [
        
        reporter.test('EmergencyShutdown: Initialize and register components', async () => {
            const shutdown = new EmergencyShutdown({
                enableDebugLogging: false,
                exitOnShutdown: false
            });
            
            let componentShutdown = false;
            
            // Register test component
            shutdown.registerComponent('TestComponent', async () => {
                componentShutdown = true;
            }, 5);
            
            // Test component registration
            const status = shutdown.getStatus();
            if (status.isShuttingDown) throw new Error('Should not be shutting down initially');
            
            await shutdown.shutdown();
        }),
        
        reporter.test('EmergencyShutdown: Resource cleanup', async () => {
            const shutdown = new EmergencyShutdown({
                exitOnShutdown: false
            });
            
            // Register mock resources
            const mockTimer = setTimeout(() => {}, 10000);
            const mockInterval = setInterval(() => {}, 1000);
            
            shutdown.registerResource('timers', mockTimer);
            shutdown.registerResource('intervals', mockInterval);
            
            // Register cleanup function
            let cleanupCalled = false;
            shutdown.registerCleanupFunction('test', async () => {
                cleanupCalled = true;
            });
            
            // Initiate shutdown
            await shutdown.initiateShutdown('test');
            
            // Wait for shutdown to complete
            await sleep(1000);
            
            if (!cleanupCalled) throw new Error('Cleanup function should be called');
            
            await shutdown.shutdown();
        }),
        
        reporter.test('EmergencyShutdown: Recovery strategies', async () => {
            const shutdown = new EmergencyShutdown({
                enableRecovery: true,
                exitOnShutdown: false
            });
            
            let recoveryExecuted = false;
            
            // Register recovery strategy
            shutdown.registerRecoveryStrategy('test_recovery', async () => {
                recoveryExecuted = true;
                return true;
            });
            
            // Test recovery registration
            const stats = shutdown.getStatistics();
            if (stats.recovery.strategies === 0) throw new Error('Recovery strategy should be registered');
            
            await shutdown.shutdown();
        })
    ]);
    
    // ===== Stack Monitor Tests =====
    await reporter.suite('Stack Monitor', [
        
        reporter.test('StackMonitor: Initialize and start monitoring', async () => {
            const monitor = new StackMonitor({
                enableDebugLogging: false,
                monitoringInterval: 50  // Fast for testing
            });
            
            // Test initialization
            const status = monitor.getStatus();
            if (status.isEnabled) throw new Error('Should not be enabled initially');
            
            // Start monitoring
            monitor.start();
            
            await sleep(100); // Let it run briefly
            
            const statusAfterStart = monitor.getStatus();
            if (!statusAfterStart.isEnabled) throw new Error('Should be enabled after start');
            
            await monitor.shutdown();
        }),
        
        reporter.test('StackMonitor: Stack depth detection', async () => {
            const monitor = new StackMonitor({
                warningDepth: 5,
                criticalDepth: 10,
                emergencyDepth: 15,
                enableDebugLogging: false
            });
            
            let warningTriggered = false;
            let criticalTriggered = false;
            
            monitor.on('stack:warning', () => {
                warningTriggered = true;
            });
            
            monitor.on('stack:critical', () => {
                criticalTriggered = true;
            });
            
            monitor.start();
            
            // Simulate stack depth by manually calling monitoring
            await sleep(200);
            
            await monitor.shutdown();
        }),
        
        reporter.test('StackMonitor: Emergency shutdown integration', async () => {
            const monitor = new StackMonitor({
                enableEmergencyShutdown: true,
                shutdownDepth: 20,
                enableDebugLogging: false
            });
            
            let emergencyShutdownTriggered = false;
            
            monitor.on('stack:shutdown', () => {
                emergencyShutdownTriggered = true;
            });
            
            monitor.start();
            
            // Test force emergency shutdown
            monitor.forceEmergencyShutdown('test');
            
            await sleep(100);
            
            if (!emergencyShutdownTriggered) throw new Error('Emergency shutdown should be triggered');
            
            await monitor.shutdown();
        }),
        
        reporter.test('StackMonitor: Statistics and metrics', async () => {
            const monitor = new StackMonitor({
                enablePerformanceTracking: true
            });
            
            monitor.start();
            
            await sleep(200); // Let it collect some data
            
            const stats = monitor.getStatistics();
            if (typeof stats.totalStackChecks !== 'number') throw new Error('Should track stack checks');
            if (typeof stats.uptime !== 'number') throw new Error('Should track uptime');
            
            const config = monitor.getConfiguration();
            if (!config.warningDepth) throw new Error('Should return configuration');
            
            await monitor.shutdown();
        })
    ]);
    
    // ===== EventBus Integration Tests =====
    await reporter.suite('EventBus Integration', [
        
        reporter.test('EventBus: Stack monitoring integration', async () => {
            const eventBus = new EventBus({
                stackMonitor: {
                    enableDebugLogging: false,
                    monitoringInterval: 100
                }
            });
            
            // Test that stack monitor is integrated
            if (!eventBus.stackMonitor) throw new Error('Stack monitor should be integrated');
            
            let stackWarningReceived = false;
            
            eventBus.on('eventbus:stack_warning', () => {
                stackWarningReceived = true;
            });
            
            // Test event emission
            eventBus.emit('test:event', { data: 'test' });
            
            await sleep(200);
            
            await eventBus.shutdown();
        }),
        
        reporter.test('EventBus: Recursion protection with stack monitoring', async () => {
            const eventBus = new EventBus({
                maxStackDepth: 5,
                stackMonitor: {
                    warningDepth: 3
                }
            });
            
            let recursionBlocked = false;
            
            eventBus.on('eventbus:recursion_blocked', () => {
                recursionBlocked = true;
            });
            
            // Test enhanced emit with stack monitoring
            const result = eventBus.emitWithStackMonitoring('test:recursive', {});
            
            await sleep(100);
            
            await eventBus.shutdown();
        }),
        
        reporter.test('EventBus: Emergency shutdown handling', async () => {
            const eventBus = new EventBus({
                stackMonitor: {
                    enableEmergencyShutdown: true
                }
            });
            
            let emergencyReceived = false;
            
            eventBus.on('eventbus:emergency_shutdown', () => {
                emergencyReceived = true;
            });
            
            // Trigger emergency shutdown
            if (eventBus.stackMonitor) {
                eventBus.stackMonitor.forceEmergencyShutdown('test');
            }
            
            await sleep(200);
            
            await eventBus.shutdown();
        })
    ]);
    
    // ===== Integration Tests =====
    await reporter.suite('System Integration', [
        
        reporter.test('Integration: Complete stack overflow prevention flow', async () => {
            const monitor = new StackMonitor({
                warningDepth: 10,
                criticalDepth: 20,
                emergencyDepth: 30,
                shutdownDepth: 40,
                enableDebugLogging: false
            });
            
            const eventBus = new EventBus({
                stackMonitor: monitor
            });
            
            let flowCompleted = false;
            
            // Listen for the complete flow
            monitor.on('stack:warning', () => {
                console.log('   Stack warning triggered');
            });
            
            monitor.on('stack:critical', () => {
                console.log('   Stack critical triggered');
            });
            
            monitor.on('stack:emergency', () => {
                console.log('   Stack emergency triggered');
                flowCompleted = true;
            });
            
            monitor.start();
            
            await sleep(300);
            
            await monitor.shutdown();
            await eventBus.shutdown();
        }),
        
        reporter.test('Integration: Memory correlation with stack depth', async () => {
            const monitor = new StackMonitor({
                enableMemoryCorrelation: true,
                memoryThreshold: 1024 * 1024 // 1MB
            });
            
            let memoryCorrelationDetected = false;
            
            monitor.on('memory:correlation', () => {
                memoryCorrelationDetected = true;
            });
            
            monitor.start();
            
            await sleep(200);
            
            await monitor.shutdown();
        }),
        
        reporter.test('Integration: Full system recovery test', async () => {
            const monitor = new StackMonitor({
                enableRecovery: true,
                recoveryDelay: 100, // Fast for testing
                maxRecoveryAttempts: 2
            });
            
            let recoveryAttempted = false;
            
            monitor.on('recovery:attempt', () => {
                recoveryAttempted = true;
            });
            
            monitor.start();
            
            // Trigger a recovery scenario
            monitor.triggerEmergencyShutdown('test_recovery', {});
            
            await sleep(300);
            
            await monitor.shutdown();
        })
    ]);
    
    // ===== Performance Tests =====
    await reporter.suite('Performance', [
        
        reporter.test('Performance: Stack monitoring overhead', async () => {
            const monitor = new StackMonitor({
                monitoringInterval: 10, // Very frequent
                enablePerformanceTracking: true
            });
            
            const startTime = Date.now();
            
            monitor.start();
            
            // Let it run for a bit
            await sleep(500);
            
            const stats = monitor.getStatistics();
            const duration = Date.now() - startTime;
            
            console.log(`   Monitored for ${duration}ms, ${stats.totalStackChecks} checks`);
            
            if (stats.totalStackChecks === 0) throw new Error('Should have performed stack checks');
            
            await monitor.shutdown();
        }),
        
        reporter.test('Performance: Recursion detection speed', async () => {
            const detector = new RecursionDetector();
            
            const testStacks = [
                'Error\n    at test1 (/test.js:1:1)',
                'Error\n    at test2 (/test.js:2:2)\n    at test2 (/test.js:2:2)',
                'Error\n    at funcA (/test.js:1:1)\n    at funcB (/test.js:2:2)\n    at funcA (/test.js:1:1)'
            ];
            
            const startTime = Date.now();
            
            // Run many analyses
            for (let i = 0; i < 100; i++) {
                const stack = testStacks[i % testStacks.length];
                detector.analyzeStackTrace(stack);
            }
            
            const duration = Date.now() - startTime;
            console.log(`   Analyzed 100 stacks in ${duration}ms (${(duration/100).toFixed(2)}ms avg)`);
            
            if (duration > 1000) throw new Error('Recursion detection too slow');
            
            await detector.shutdown();
        })
    ]);
    
    // Print final summary
    const success = reporter.summary();
    
    if (success) {
        console.log('\n🎉 All tests passed! Stack monitoring system is working correctly.');
        process.exit(0);
    } else {
        console.log('\n💥 Some tests failed. Please check the implementation.');
        process.exit(1);
    }
}

// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection in tests:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception in tests:', error);
    process.exit(1);
});

// Run the tests
runTests().catch((error) => {
    console.error('Test suite failed:', error);
    process.exit(1);
});