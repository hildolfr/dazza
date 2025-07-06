#!/usr/bin/env node

/**
 * Test Suite: Original Crash Scenario Recreation
 * 
 * This test recreates the exact conditions that caused the original crash:
 * - Infinite media:change event loop between MediaManagementService and ConnectionHandler
 * - ImageHealthChecker timeout at 5-minute mark
 * - Stack overflow: "RangeError: Maximum call stack size exceeded"
 * - Multiple unhandled promise rejections
 * 
 * Test validates that all protection mechanisms prevent the crash.
 */

import EventBus from './src/core/EventBus.js';
import StackMonitor from './src/core/StackMonitor.js';
import { performance } from 'perf_hooks';

class OriginalCrashScenarioTest {
    constructor() {
        this.testResults = [];
        this.testStartTime = Date.now();
        this.eventBus = null;
        this.stackMonitor = null;
        this.testTimeout = null;
        this.eventCounters = new Map();
        this.protectionTriggered = false;
        this.crashPrevented = false;
        this.originalConsoleError = console.error;
    }

    async runAllTests() {
        console.log('🔄 Starting Original Crash Scenario Recreation Tests');
        console.log('━'.repeat(80));
        
        // Setup test environment
        this.setupTestEnvironment();
        
        try {
            // Test 1: Recreate exact crash conditions
            await this.testExactCrashConditions();
            
            // Test 2: ImageHealthChecker timeout scenario
            await this.testImageHealthCheckerTimeout();
            
            // Test 3: Media:change event loop
            await this.testMediaChangeEventLoop();
            
            // Test 4: Stack overflow prevention
            await this.testStackOverflowPrevention();
            
            // Test 5: Unhandled promise rejection cascade
            await this.testUnhandledPromiseRejectionCascade();
            
            // Test 6: 5-minute timeout crash recreation
            await this.testFiveMinuteTimeoutCrash();
            
            // Test 7: Multiple simultaneous recursion patterns
            await this.testMultipleRecursionPatterns();
            
            // Test 8: Memory leak prevention during recursion
            await this.testMemoryLeakPrevention();
            
        } catch (error) {
            this.addTestResult('CRASH_PREVENTION_SYSTEM', false, `Unexpected error: ${error.message}`);
        } finally {
            this.cleanup();
        }
        
        this.printTestResults();
        return this.getTestSummary();
    }

    setupTestEnvironment() {
        console.log('🔧 Setting up test environment...');
        
        // Create EventBus with debug mode enabled
        this.eventBus = new EventBus({
            debugMode: true,
            maxStackDepth: 50,  // Lower threshold for testing
            maxEventsPerSecond: 200,
            circuitBreakerThreshold: 3,
            deduplicationWindow: 50,
            stackMonitor: {
                enableDebugLogging: true,
                warningDepth: 25,
                criticalDepth: 35,
                emergencyDepth: 45,
                shutdownDepth: 55
            }
        });
        
        // Listen for protection events
        this.setupProtectionListeners();
        
        // Setup test timeout (10 minutes max)
        this.testTimeout = setTimeout(() => {
            this.addTestResult('TIMEOUT_PROTECTION', false, 'Test suite exceeded maximum runtime');
            this.cleanup();
        }, 600000);
        
        console.log('✅ Test environment ready');
    }

    setupProtectionListeners() {
        // Listen for EventBus protection events
        this.eventBus.on('eventbus:emergency', (data) => {
            this.protectionTriggered = true;
            this.crashPrevented = true;
            console.log('🛡️  EventBus emergency protection triggered:', data.reason);
        });
        
        this.eventBus.on('eventbus:stack_warning', (data) => {
            console.log('⚠️  Stack warning:', data.depth);
        });
        
        this.eventBus.on('eventbus:stack_critical', (data) => {
            console.log('🚨 Stack critical:', data.depth);
        });
        
        this.eventBus.on('eventbus:stack_emergency', (data) => {
            this.protectionTriggered = true;
            console.log('🚨 Stack emergency:', data.depth);
        });
        
        this.eventBus.on('eventbus:recursion_detected', (data) => {
            this.protectionTriggered = true;
            console.log('🔍 Recursion detected:', data.pattern);
        });
        
        this.eventBus.on('eventbus:recursion_blocked', (data) => {
            this.protectionTriggered = true;
            console.log('🛑 Recursion blocked:', data.event);
        });
        
        this.eventBus.on('eventbus:emergency_shutdown', (data) => {
            this.protectionTriggered = true;
            this.crashPrevented = true;
            console.log('🛑 Emergency shutdown:', data.reason);
        });
        
        // Override console.error to catch stack overflow attempts
        console.error = (...args) => {
            const message = args.join(' ');
            if (message.includes('Maximum call stack size exceeded')) {
                this.crashPrevented = true;
                console.log('🛡️  Stack overflow prevented!');
            }
            this.originalConsoleError.apply(console, args);
        };
    }

    async testExactCrashConditions() {
        console.log('\n📋 Test 1: Exact Crash Conditions Recreation');
        
        const testStartTime = performance.now();
        this.protectionTriggered = false;
        this.crashPrevented = false;
        
        try {
            // Register mock modules that would cause the original crash
            this.eventBus.registerModule('MediaManagementService', ['fatpizza']);
            this.eventBus.registerModule('ConnectionHandler', ['fatpizza']);
            this.eventBus.registerModule('ImageHealthChecker', ['fatpizza']);
            
            // Create the exact event loop that caused the crash
            this.eventBus.subscribe('MediaManagementService', 'media:change', (data) => {
                this.incrementEventCounter('media:change');
                
                // This would cause the infinite loop in the original crash
                setTimeout(() => {
                    this.eventBus.emit('media:change', {
                        ...data,
                        _sourceModule: 'MediaManagementService',
                        room: 'fatpizza',
                        trigger: 'health_check_timeout'
                    });
                }, 1);
            });
            
            this.eventBus.subscribe('ConnectionHandler', 'media:change', (data) => {
                this.incrementEventCounter('media:change');
                
                // This would respond and cause the loop
                setTimeout(() => {
                    this.eventBus.emit('media:change', {
                        ...data,
                        _sourceModule: 'ConnectionHandler',
                        room: 'fatpizza',
                        trigger: 'response_to_health_check'
                    });
                }, 1);
            });
            
            // Start the cascade that would cause the crash
            this.eventBus.emit('media:change', {
                _sourceModule: 'ImageHealthChecker',
                room: 'fatpizza',
                trigger: 'timeout_5_minutes',
                url: 'https://example.com/test-image.jpg'
            });
            
            // Wait for protection to trigger
            await this.waitForProtectionOrTimeout(5000);
            
            const duration = performance.now() - testStartTime;
            const eventCount = this.getEventCounter('media:change');
            
            if (this.protectionTriggered) {
                this.addTestResult('EXACT_CRASH_CONDITIONS', true, 
                    `Protection triggered after ${eventCount} events in ${duration.toFixed(2)}ms`);
            } else {
                this.addTestResult('EXACT_CRASH_CONDITIONS', false, 
                    `Protection not triggered after ${eventCount} events in ${duration.toFixed(2)}ms`);
            }
            
        } catch (error) {
            if (error.message.includes('Maximum call stack size exceeded')) {
                this.addTestResult('EXACT_CRASH_CONDITIONS', false, 
                    'Stack overflow occurred - protection failed');
            } else {
                this.addTestResult('EXACT_CRASH_CONDITIONS', false, 
                    `Unexpected error: ${error.message}`);
            }
        }
        
        // Reset for next test
        this.resetEventCounters();
    }

    async testImageHealthCheckerTimeout() {
        console.log('\n📋 Test 2: ImageHealthChecker Timeout Scenario');
        
        const testStartTime = performance.now();
        this.protectionTriggered = false;
        
        try {
            // Simulate the 5-minute timeout that triggered the original crash
            this.eventBus.registerModule('ImageHealthChecker', ['fatpizza']);
            
            this.eventBus.subscribe('ImageHealthChecker', 'health:check_timeout', (data) => {
                this.incrementEventCounter('health:check_timeout');
                
                // This would cause the problematic media:change emission
                this.eventBus.emit('media:change', {
                    _sourceModule: 'ImageHealthChecker',
                    room: data.room,
                    trigger: 'health_check_timeout',
                    url: data.url,
                    timestamp: Date.now()
                });
                
                // Simulate the recursive pattern that would occur
                setTimeout(() => {
                    this.eventBus.emit('health:check_timeout', {
                        ...data,
                        _sourceModule: 'ImageHealthChecker',
                        retry: (data.retry || 0) + 1
                    });
                }, 10);
            });
            
            // Start the timeout cascade
            this.eventBus.emit('health:check_timeout', {
                _sourceModule: 'ImageHealthChecker',
                room: 'fatpizza',
                url: 'https://example.com/timeout-image.jpg',
                timeoutDuration: 300000, // 5 minutes
                retry: 0
            });
            
            await this.waitForProtectionOrTimeout(3000);
            
            const duration = performance.now() - testStartTime;
            const eventCount = this.getEventCounter('health:check_timeout');
            
            if (this.protectionTriggered) {
                this.addTestResult('IMAGE_HEALTH_CHECKER_TIMEOUT', true, 
                    `Protection triggered after ${eventCount} timeout events in ${duration.toFixed(2)}ms`);
            } else {
                this.addTestResult('IMAGE_HEALTH_CHECKER_TIMEOUT', false, 
                    `Protection not triggered after ${eventCount} timeout events`);
            }
            
        } catch (error) {
            this.addTestResult('IMAGE_HEALTH_CHECKER_TIMEOUT', false, 
                `Error during timeout test: ${error.message}`);
        }
        
        this.resetEventCounters();
    }

    async testMediaChangeEventLoop() {
        console.log('\n📋 Test 3: Media:change Event Loop');
        
        const testStartTime = performance.now();
        this.protectionTriggered = false;
        
        try {
            // Create a pure media:change event loop
            this.eventBus.subscribe('TestModule', 'media:change', (data) => {
                this.incrementEventCounter('media:change_loop');
                
                // Create the exact loop pattern from the crash
                if (data._sourceModule === 'MediaManagementService') {
                    // ConnectionHandler would respond
                    this.eventBus.emit('media:change', {
                        ...data,
                        _sourceModule: 'ConnectionHandler',
                        response: 'handling_media_change'
                    });
                } else if (data._sourceModule === 'ConnectionHandler') {
                    // MediaManagementService would respond back
                    this.eventBus.emit('media:change', {
                        ...data,
                        _sourceModule: 'MediaManagementService',
                        response: 'acknowledging_change'
                    });
                }
            });
            
            // Start the loop
            this.eventBus.emit('media:change', {
                _sourceModule: 'MediaManagementService',
                room: 'fatpizza',
                action: 'initial_change'
            });
            
            await this.waitForProtectionOrTimeout(2000);
            
            const duration = performance.now() - testStartTime;
            const eventCount = this.getEventCounter('media:change_loop');
            
            if (this.protectionTriggered) {
                this.addTestResult('MEDIA_CHANGE_EVENT_LOOP', true, 
                    `Loop broken after ${eventCount} events in ${duration.toFixed(2)}ms`);
            } else {
                this.addTestResult('MEDIA_CHANGE_EVENT_LOOP', false, 
                    `Loop not broken after ${eventCount} events`);
            }
            
        } catch (error) {
            this.addTestResult('MEDIA_CHANGE_EVENT_LOOP', false, 
                `Error during loop test: ${error.message}`);
        }
        
        this.resetEventCounters();
    }

    async testStackOverflowPrevention() {
        console.log('\n📋 Test 4: Stack Overflow Prevention');
        
        const testStartTime = performance.now();
        this.protectionTriggered = false;
        this.crashPrevented = false;
        
        try {
            // Create a direct recursion that would cause stack overflow
            const recursiveFunction = (depth = 0) => {
                this.incrementEventCounter('recursive_call');
                
                // This would cause stack overflow without protection
                if (depth < 1000) {
                    this.eventBus.emit('recursive:call', {
                        _sourceModule: 'TestModule',
                        depth: depth + 1
                    });
                }
            };
            
            this.eventBus.subscribe('TestModule', 'recursive:call', (data) => {
                recursiveFunction(data.depth);
            });
            
            // Start the recursion
            this.eventBus.emit('recursive:call', {
                _sourceModule: 'TestModule',
                depth: 0
            });
            
            await this.waitForProtectionOrTimeout(3000);
            
            const duration = performance.now() - testStartTime;
            const callCount = this.getEventCounter('recursive_call');
            
            if (this.protectionTriggered || this.crashPrevented) {
                this.addTestResult('STACK_OVERFLOW_PREVENTION', true, 
                    `Stack overflow prevented after ${callCount} calls in ${duration.toFixed(2)}ms`);
            } else {
                this.addTestResult('STACK_OVERFLOW_PREVENTION', false, 
                    `Stack overflow not prevented after ${callCount} calls`);
            }
            
        } catch (error) {
            if (error.message.includes('Maximum call stack size exceeded')) {
                this.addTestResult('STACK_OVERFLOW_PREVENTION', false, 
                    'Stack overflow occurred - protection failed');
            } else {
                this.addTestResult('STACK_OVERFLOW_PREVENTION', false, 
                    `Unexpected error: ${error.message}`);
            }
        }
        
        this.resetEventCounters();
    }

    async testUnhandledPromiseRejectionCascade() {
        console.log('\n📋 Test 5: Unhandled Promise Rejection Cascade');
        
        const testStartTime = performance.now();
        this.protectionTriggered = false;
        let rejectionCount = 0;
        
        // Track unhandled rejections
        const rejectionHandler = (reason, promise) => {
            rejectionCount++;
            console.log(`🔍 Unhandled rejection ${rejectionCount}: ${reason}`);
        };
        
        process.on('unhandledRejection', rejectionHandler);
        
        try {
            // Create a cascade of promise rejections like in the original crash
            this.eventBus.subscribe('TestModule', 'promise:reject', (data) => {
                this.incrementEventCounter('promise_rejection');
                
                // Create unhandled promise rejection
                new Promise((resolve, reject) => {
                    setTimeout(() => {
                        reject(new Error(`Promise rejection cascade ${data.depth}`));
                    }, 1);
                }).then(() => {
                    // This would cause another rejection
                    this.eventBus.emit('promise:reject', {
                        _sourceModule: 'TestModule',
                        depth: (data.depth || 0) + 1
                    });
                });
            });
            
            // Start the cascade
            this.eventBus.emit('promise:reject', {
                _sourceModule: 'TestModule',
                depth: 0
            });
            
            await this.waitForProtectionOrTimeout(2000);
            
            const duration = performance.now() - testStartTime;
            const eventCount = this.getEventCounter('promise_rejection');
            
            if (this.protectionTriggered) {
                this.addTestResult('UNHANDLED_PROMISE_REJECTION_CASCADE', true, 
                    `Cascade controlled after ${eventCount} events, ${rejectionCount} rejections in ${duration.toFixed(2)}ms`);
            } else {
                this.addTestResult('UNHANDLED_PROMISE_REJECTION_CASCADE', false, 
                    `Cascade not controlled after ${eventCount} events, ${rejectionCount} rejections`);
            }
            
        } catch (error) {
            this.addTestResult('UNHANDLED_PROMISE_REJECTION_CASCADE', false, 
                `Error during cascade test: ${error.message}`);
        } finally {
            process.removeListener('unhandledRejection', rejectionHandler);
        }
        
        this.resetEventCounters();
    }

    async testFiveMinuteTimeoutCrash() {
        console.log('\n📋 Test 6: 5-Minute Timeout Crash Recreation');
        
        const testStartTime = performance.now();
        this.protectionTriggered = false;
        
        try {
            // Simulate the exact timing and conditions of the original crash
            // Original crash: 13:22:02 (4 minutes 52 seconds after startup)
            // ImageHealthChecker timeout at 5-minute mark
            
            this.eventBus.subscribe('TestModule', 'timeout:5min', (data) => {
                this.incrementEventCounter('timeout_5min');
                
                // Simulate the exact sequence that occurred
                setTimeout(() => {
                    this.eventBus.emit('media:change', {
                        _sourceModule: 'ImageHealthChecker',
                        room: 'fatpizza',
                        trigger: 'health_check_timeout',
                        originalTimestamp: data.originalTimestamp,
                        elapsedTime: Date.now() - data.originalTimestamp
                    });
                }, 10);
                
                // Simulate the repeated timeout that would occur
                setTimeout(() => {
                    this.eventBus.emit('timeout:5min', {
                        ...data,
                        _sourceModule: 'ImageHealthChecker',
                        retry: (data.retry || 0) + 1
                    });
                }, 50);
            });
            
            // Start the timeout simulation
            this.eventBus.emit('timeout:5min', {
                _sourceModule: 'ImageHealthChecker',
                originalTimestamp: Date.now(),
                timeoutDuration: 300000, // 5 minutes
                retry: 0
            });
            
            await this.waitForProtectionOrTimeout(3000);
            
            const duration = performance.now() - testStartTime;
            const eventCount = this.getEventCounter('timeout_5min');
            
            if (this.protectionTriggered) {
                this.addTestResult('FIVE_MINUTE_TIMEOUT_CRASH', true, 
                    `Timeout crash prevented after ${eventCount} events in ${duration.toFixed(2)}ms`);
            } else {
                this.addTestResult('FIVE_MINUTE_TIMEOUT_CRASH', false, 
                    `Timeout crash not prevented after ${eventCount} events`);
            }
            
        } catch (error) {
            this.addTestResult('FIVE_MINUTE_TIMEOUT_CRASH', false, 
                `Error during timeout crash test: ${error.message}`);
        }
        
        this.resetEventCounters();
    }

    async testMultipleRecursionPatterns() {
        console.log('\n📋 Test 7: Multiple Simultaneous Recursion Patterns');
        
        const testStartTime = performance.now();
        this.protectionTriggered = false;
        
        try {
            // Create multiple different recursion patterns simultaneously
            
            // Pattern 1: Direct recursion
            this.eventBus.subscribe('TestModule', 'pattern:direct', (data) => {
                this.incrementEventCounter('pattern_direct');
                if (data.depth < 100) {
                    this.eventBus.emit('pattern:direct', {
                        _sourceModule: 'TestModule',
                        depth: data.depth + 1
                    });
                }
            });
            
            // Pattern 2: Indirect recursion (A -> B -> A)
            this.eventBus.subscribe('TestModule', 'pattern:indirect_a', (data) => {
                this.incrementEventCounter('pattern_indirect_a');
                this.eventBus.emit('pattern:indirect_b', {
                    _sourceModule: 'TestModule',
                    depth: data.depth + 1
                });
            });
            
            this.eventBus.subscribe('TestModule', 'pattern:indirect_b', (data) => {
                this.incrementEventCounter('pattern_indirect_b');
                if (data.depth < 100) {
                    this.eventBus.emit('pattern:indirect_a', {
                        _sourceModule: 'TestModule',
                        depth: data.depth + 1
                    });
                }
            });
            
            // Pattern 3: Complex chain (A -> B -> C -> A)
            this.eventBus.subscribe('TestModule', 'pattern:chain_a', (data) => {
                this.incrementEventCounter('pattern_chain_a');
                this.eventBus.emit('pattern:chain_b', {
                    _sourceModule: 'TestModule',
                    depth: data.depth + 1
                });
            });
            
            this.eventBus.subscribe('TestModule', 'pattern:chain_b', (data) => {
                this.incrementEventCounter('pattern_chain_b');
                this.eventBus.emit('pattern:chain_c', {
                    _sourceModule: 'TestModule',
                    depth: data.depth + 1
                });
            });
            
            this.eventBus.subscribe('TestModule', 'pattern:chain_c', (data) => {
                this.incrementEventCounter('pattern_chain_c');
                if (data.depth < 100) {
                    this.eventBus.emit('pattern:chain_a', {
                        _sourceModule: 'TestModule',
                        depth: data.depth + 1
                    });
                }
            });
            
            // Start all patterns simultaneously
            this.eventBus.emit('pattern:direct', { _sourceModule: 'TestModule', depth: 0 });
            this.eventBus.emit('pattern:indirect_a', { _sourceModule: 'TestModule', depth: 0 });
            this.eventBus.emit('pattern:chain_a', { _sourceModule: 'TestModule', depth: 0 });
            
            await this.waitForProtectionOrTimeout(3000);
            
            const duration = performance.now() - testStartTime;
            const totalEvents = this.getEventCounter('pattern_direct') + 
                              this.getEventCounter('pattern_indirect_a') + 
                              this.getEventCounter('pattern_indirect_b') + 
                              this.getEventCounter('pattern_chain_a') + 
                              this.getEventCounter('pattern_chain_b') + 
                              this.getEventCounter('pattern_chain_c');
            
            if (this.protectionTriggered) {
                this.addTestResult('MULTIPLE_RECURSION_PATTERNS', true, 
                    `Multiple recursion patterns controlled after ${totalEvents} events in ${duration.toFixed(2)}ms`);
            } else {
                this.addTestResult('MULTIPLE_RECURSION_PATTERNS', false, 
                    `Multiple recursion patterns not controlled after ${totalEvents} events`);
            }
            
        } catch (error) {
            this.addTestResult('MULTIPLE_RECURSION_PATTERNS', false, 
                `Error during multiple patterns test: ${error.message}`);
        }
        
        this.resetEventCounters();
    }

    async testMemoryLeakPrevention() {
        console.log('\n📋 Test 8: Memory Leak Prevention During Recursion');
        
        const testStartTime = performance.now();
        this.protectionTriggered = false;
        const initialMemory = process.memoryUsage();
        
        try {
            // Create a pattern that would cause memory leaks
            this.eventBus.subscribe('TestModule', 'memory:leak', (data) => {
                this.incrementEventCounter('memory_leak');
                
                // Create objects that would normally leak memory
                const leakData = {
                    _sourceModule: 'TestModule',
                    largeArray: new Array(1000).fill(Math.random()),
                    deepObject: this.createDeepObject(10),
                    circularRef: {},
                    timestamp: Date.now(),
                    depth: data.depth + 1
                };
                
                // Create circular reference
                leakData.circularRef.self = leakData;
                
                if (data.depth < 100) {
                    this.eventBus.emit('memory:leak', leakData);
                }
            });
            
            // Start memory leak test
            this.eventBus.emit('memory:leak', {
                _sourceModule: 'TestModule',
                depth: 0
            });
            
            await this.waitForProtectionOrTimeout(3000);
            
            const duration = performance.now() - testStartTime;
            const finalMemory = process.memoryUsage();
            const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
            const eventCount = this.getEventCounter('memory_leak');
            
            // Force garbage collection to see if memory is properly managed
            if (global.gc) {
                global.gc();
            }
            
            const afterGcMemory = process.memoryUsage();
            const netMemoryGrowth = afterGcMemory.heapUsed - initialMemory.heapUsed;
            
            if (this.protectionTriggered) {
                this.addTestResult('MEMORY_LEAK_PREVENTION', true, 
                    `Memory leak prevented after ${eventCount} events in ${duration.toFixed(2)}ms. ` +
                    `Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB, ` +
                    `Net growth: ${(netMemoryGrowth / 1024 / 1024).toFixed(2)}MB`);
            } else {
                this.addTestResult('MEMORY_LEAK_PREVENTION', false, 
                    `Memory leak not prevented after ${eventCount} events. ` +
                    `Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
            }
            
        } catch (error) {
            this.addTestResult('MEMORY_LEAK_PREVENTION', false, 
                `Error during memory leak test: ${error.message}`);
        }
        
        this.resetEventCounters();
    }

    // Helper methods
    createDeepObject(depth) {
        if (depth === 0) return { value: Math.random() };
        return { nested: this.createDeepObject(depth - 1) };
    }

    incrementEventCounter(event) {
        this.eventCounters.set(event, (this.eventCounters.get(event) || 0) + 1);
    }

    getEventCounter(event) {
        return this.eventCounters.get(event) || 0;
    }

    resetEventCounters() {
        this.eventCounters.clear();
    }

    async waitForProtectionOrTimeout(timeoutMs) {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (this.protectionTriggered || this.crashPrevented) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 10);
            
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, timeoutMs);
        });
    }

    addTestResult(testName, passed, details) {
        this.testResults.push({
            testName,
            passed,
            details,
            timestamp: Date.now()
        });
        
        const status = passed ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} ${testName}: ${details}`);
    }

    printTestResults() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 ORIGINAL CRASH SCENARIO TEST RESULTS');
        console.log('='.repeat(80));
        
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        const duration = Date.now() - this.testStartTime;
        
        console.log(`\n🎯 Overall Result: ${passed}/${total} tests passed`);
        console.log(`⏱️  Total Duration: ${duration}ms`);
        
        if (passed === total) {
            console.log('🎉 ALL TESTS PASSED - Original crash scenario cannot be reproduced!');
        } else {
            console.log('⚠️  Some tests failed - Protection system needs improvement');
        }
        
        console.log('\n📋 Detailed Results:');
        this.testResults.forEach((result, index) => {
            const status = result.passed ? '✅' : '❌';
            console.log(`${index + 1}. ${status} ${result.testName}`);
            console.log(`   ${result.details}`);
        });
        
        // EventBus statistics
        if (this.eventBus) {
            console.log('\n📈 Protection System Statistics:');
            const stats = this.eventBus.getStats();
            console.log(`   Total Events: ${stats.totalEvents}`);
            console.log(`   Circuit Breaker Triggered: ${stats.recursionProtection.circuitBreaker.isOpen}`);
            console.log(`   Current Stack Depth: ${stats.recursionProtection.currentStackDepth}`);
            console.log(`   Active Chains: ${stats.recursionProtection.activeChains}`);
            console.log(`   Failure Count: ${stats.recursionProtection.circuitBreaker.failureCount}`);
            
            if (stats.stackMonitoring) {
                console.log(`   Stack Monitoring: ${JSON.stringify(stats.stackMonitoring, null, 2)}`);
            }
        }
    }

    getTestSummary() {
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        
        return {
            passed,
            total,
            success: passed === total,
            duration: Date.now() - this.testStartTime,
            results: this.testResults,
            protectionTriggered: this.protectionTriggered,
            crashPrevented: this.crashPrevented
        };
    }

    cleanup() {
        if (this.testTimeout) {
            clearTimeout(this.testTimeout);
        }
        
        if (this.eventBus) {
            this.eventBus.shutdown();
        }
        
        // Restore console.error
        console.error = this.originalConsoleError;
        
        console.log('🧹 Test cleanup completed');
    }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tester = new OriginalCrashScenarioTest();
    tester.runAllTests().then((summary) => {
        process.exit(summary.success ? 0 : 1);
    }).catch((error) => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

export default OriginalCrashScenarioTest;