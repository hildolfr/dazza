#!/usr/bin/env node

/**
 * Test Suite: Infinite Recursion Protection
 * 
 * This test suite validates all recursion protection mechanisms:
 * - EventBus recursion protection with various recursion patterns
 * - Stack overflow detection and emergency shutdown
 * - Circuit breaker functionality under load
 * - Event source filtering and deduplication
 * - Memory pressure monitoring during recursion
 * - Recovery mechanisms after protection activation
 */

import EventBus from './src/core/EventBus.js';
import { performance } from 'perf_hooks';

class InfiniteRecursionProtectionTest {
    constructor() {
        this.testResults = [];
        this.testStartTime = Date.now();
        this.eventBus = null;
        this.testTimeout = null;
        this.protectionEvents = [];
        this.memorySnapshots = [];
        this.originalConsoleError = console.error;
        this.stackOverflowDetected = false;
    }

    async runAllTests() {
        console.log('🔄 Starting Infinite Recursion Protection Tests');
        console.log('━'.repeat(80));
        
        // Setup test environment
        this.setupTestEnvironment();
        
        try {
            // Test 1: Direct recursion detection
            await this.testDirectRecursionDetection();
            
            // Test 2: Indirect recursion detection (A -> B -> A)
            await this.testIndirectRecursionDetection();
            
            // Test 3: Complex chain recursion (A -> B -> C -> A)
            await this.testComplexChainRecursion();
            
            // Test 4: Source loop prevention
            await this.testSourceLoopPrevention();
            
            // Test 5: Rate limiting protection
            await this.testRateLimitingProtection();
            
            // Test 6: Event deduplication
            await this.testEventDeduplication();
            
            // Test 7: Stack depth monitoring
            await this.testStackDepthMonitoring();
            
            // Test 8: Circuit breaker functionality
            await this.testCircuitBreakerFunctionality();
            
            // Test 9: Memory pressure correlation
            await this.testMemoryPressureCorrelation();
            
            // Test 10: Recovery after protection
            await this.testRecoveryAfterProtection();
            
            // Test 11: Multiple simultaneous recursion patterns
            await this.testMultipleSimultaneousPatterns();
            
            // Test 12: Extreme recursion scenarios
            await this.testExtremeRecursionScenarios();
            
        } catch (error) {
            this.addTestResult('RECURSION_PROTECTION_SYSTEM', false, `Unexpected error: ${error.message}`);
        } finally {
            this.cleanup();
        }
        
        this.printTestResults();
        return this.getTestSummary();
    }

    setupTestEnvironment() {
        console.log('🔧 Setting up recursion protection test environment...');
        
        // Create EventBus with aggressive protection settings for testing
        this.eventBus = new EventBus({
            debugMode: true,
            maxStackDepth: 20,  // Very low for testing
            maxEventsPerSecond: 50,
            circuitBreakerThreshold: 5,
            deduplicationWindow: 100,
            stackMonitor: {
                enableDebugLogging: true,
                warningDepth: 15,
                criticalDepth: 25,
                emergencyDepth: 35,
                shutdownDepth: 45,
                monitoringInterval: 50
            }
        });
        
        // Setup protection event tracking
        this.setupProtectionEventTracking();
        
        // Setup test timeout (10 minutes max)
        this.testTimeout = setTimeout(() => {
            this.addTestResult('TIMEOUT_PROTECTION', false, 'Test suite exceeded maximum runtime');
            this.cleanup();
        }, 600000);
        
        console.log('✅ Recursion protection test environment ready');
    }

    setupProtectionEventTracking() {
        const protectionEvents = [
            'eventbus:emergency',
            'eventbus:stack_warning',
            'eventbus:stack_critical',
            'eventbus:stack_emergency',
            'eventbus:recursion_detected',
            'eventbus:recursion_blocked',
            'eventbus:emergency_shutdown',
            'eventbus:error'
        ];
        
        protectionEvents.forEach(event => {
            this.eventBus.on(event, (data) => {
                this.protectionEvents.push({
                    event,
                    data,
                    timestamp: Date.now()
                });
                console.log(`🛡️  Protection event: ${event}`, data.reason || data.message || '');
            });
        });
        
        // Override console.error to catch stack overflow
        console.error = (...args) => {
            const message = args.join(' ');
            if (message.includes('Maximum call stack size exceeded')) {
                this.stackOverflowDetected = true;
                console.log('🛡️  Stack overflow detected and caught!');
            }
            this.originalConsoleError.apply(console, args);
        };
    }

    async testDirectRecursionDetection() {
        console.log('\n📋 Test 1: Direct Recursion Detection');
        
        const testStartTime = performance.now();
        this.resetProtectionEvents();
        
        try {
            this.eventBus.registerModule('DirectRecursionTest', ['test']);
            
            let callCount = 0;
            this.eventBus.subscribe('DirectRecursionTest', 'direct:recursion', (data) => {
                callCount++;
                
                // Direct recursion - function calls itself
                if (callCount < 1000) {
                    this.eventBus.emit('direct:recursion', {
                        _sourceModule: 'DirectRecursionTest',
                        depth: (data.depth || 0) + 1,
                        callCount
                    });
                }
            });
            
            // Start direct recursion
            this.eventBus.emit('direct:recursion', {
                _sourceModule: 'DirectRecursionTest',
                depth: 0
            });
            
            await this.waitForProtectionOrTimeout(2000);
            
            const duration = performance.now() - testStartTime;
            const protectionTriggered = this.protectionEvents.length > 0;
            
            if (protectionTriggered) {
                this.addTestResult('DIRECT_RECURSION_DETECTION', true, 
                    `Direct recursion detected after ${callCount} calls in ${duration.toFixed(2)}ms`);
            } else {
                this.addTestResult('DIRECT_RECURSION_DETECTION', false, 
                    `Direct recursion not detected after ${callCount} calls`);
            }
            
        } catch (error) {
            this.addTestResult('DIRECT_RECURSION_DETECTION', false, 
                `Error during direct recursion test: ${error.message}`);
        }
    }

    async testIndirectRecursionDetection() {
        console.log('\n📋 Test 2: Indirect Recursion Detection (A -> B -> A)');
        
        const testStartTime = performance.now();
        this.resetProtectionEvents();
        
        try {
            this.eventBus.registerModule('IndirectRecursionTest', ['test']);
            
            let callCountA = 0;
            let callCountB = 0;
            
            this.eventBus.subscribe('IndirectRecursionTest', 'indirect:a', (data) => {
                callCountA++;
                
                // A calls B
                if (callCountA < 500) {
                    this.eventBus.emit('indirect:b', {
                        _sourceModule: 'IndirectRecursionTest',
                        depth: (data.depth || 0) + 1,
                        callCountA
                    });
                }
            });
            
            this.eventBus.subscribe('IndirectRecursionTest', 'indirect:b', (data) => {
                callCountB++;
                
                // B calls A back - creating indirect recursion
                if (callCountB < 500) {
                    this.eventBus.emit('indirect:a', {
                        _sourceModule: 'IndirectRecursionTest',
                        depth: (data.depth || 0) + 1,
                        callCountB
                    });
                }
            });
            
            // Start indirect recursion
            this.eventBus.emit('indirect:a', {
                _sourceModule: 'IndirectRecursionTest',
                depth: 0
            });
            
            await this.waitForProtectionOrTimeout(2000);
            
            const duration = performance.now() - testStartTime;
            const totalCalls = callCountA + callCountB;
            const protectionTriggered = this.protectionEvents.length > 0;
            
            if (protectionTriggered) {
                this.addTestResult('INDIRECT_RECURSION_DETECTION', true, 
                    `Indirect recursion detected after ${totalCalls} calls (A:${callCountA}, B:${callCountB}) in ${duration.toFixed(2)}ms`);
            } else {
                this.addTestResult('INDIRECT_RECURSION_DETECTION', false, 
                    `Indirect recursion not detected after ${totalCalls} calls`);
            }
            
        } catch (error) {
            this.addTestResult('INDIRECT_RECURSION_DETECTION', false, 
                `Error during indirect recursion test: ${error.message}`);
        }
    }

    async testComplexChainRecursion() {
        console.log('\n📋 Test 3: Complex Chain Recursion (A -> B -> C -> A)');
        
        const testStartTime = performance.now();
        this.resetProtectionEvents();
        
        try {
            this.eventBus.registerModule('ComplexChainTest', ['test']);
            
            let callCountA = 0;
            let callCountB = 0;
            let callCountC = 0;
            
            // A -> B -> C -> A chain
            this.eventBus.subscribe('ComplexChainTest', 'chain:a', (data) => {
                callCountA++;
                if (callCountA < 300) {
                    this.eventBus.emit('chain:b', {
                        _sourceModule: 'ComplexChainTest',
                        depth: (data.depth || 0) + 1,
                        path: (data.path || '') + 'A'
                    });
                }
            });
            
            this.eventBus.subscribe('ComplexChainTest', 'chain:b', (data) => {
                callCountB++;
                if (callCountB < 300) {
                    this.eventBus.emit('chain:c', {
                        _sourceModule: 'ComplexChainTest',
                        depth: (data.depth || 0) + 1,
                        path: (data.path || '') + 'B'
                    });
                }
            });
            
            this.eventBus.subscribe('ComplexChainTest', 'chain:c', (data) => {
                callCountC++;
                if (callCountC < 300) {
                    this.eventBus.emit('chain:a', {
                        _sourceModule: 'ComplexChainTest',
                        depth: (data.depth || 0) + 1,
                        path: (data.path || '') + 'C'
                    });
                }
            });
            
            // Start complex chain
            this.eventBus.emit('chain:a', {
                _sourceModule: 'ComplexChainTest',
                depth: 0,
                path: ''
            });
            
            await this.waitForProtectionOrTimeout(2000);
            
            const duration = performance.now() - testStartTime;
            const totalCalls = callCountA + callCountB + callCountC;
            const protectionTriggered = this.protectionEvents.length > 0;
            
            if (protectionTriggered) {
                this.addTestResult('COMPLEX_CHAIN_RECURSION', true, 
                    `Complex chain recursion detected after ${totalCalls} calls (A:${callCountA}, B:${callCountB}, C:${callCountC}) in ${duration.toFixed(2)}ms`);
            } else {
                this.addTestResult('COMPLEX_CHAIN_RECURSION', false, 
                    `Complex chain recursion not detected after ${totalCalls} calls`);
            }
            
        } catch (error) {
            this.addTestResult('COMPLEX_CHAIN_RECURSION', false, 
                `Error during complex chain test: ${error.message}`);
        }
    }

    async testSourceLoopPrevention() {
        console.log('\n📋 Test 4: Source Loop Prevention');
        
        const testStartTime = performance.now();
        this.resetProtectionEvents();
        
        try {
            this.eventBus.registerModule('SourceLoopTest', ['test']);
            
            let callCount = 0;
            this.eventBus.subscribe('SourceLoopTest', 'source:loop', (data) => {
                callCount++;
                
                // Try to create a source loop - module processing its own event
                this.eventBus.emit('source:loop', {
                    _sourceModule: 'SourceLoopTest',
                    iteration: callCount,
                    originalSource: data._sourceModule
                });
            });
            
            // Start source loop
            this.eventBus.emit('source:loop', {
                _sourceModule: 'SourceLoopTest',
                iteration: 0
            });
            
            await this.waitForProtectionOrTimeout(1000);
            
            const duration = performance.now() - testStartTime;
            const protectionTriggered = this.protectionEvents.length > 0;
            
            if (protectionTriggered) {
                this.addTestResult('SOURCE_LOOP_PREVENTION', true, 
                    `Source loop prevented after ${callCount} attempts in ${duration.toFixed(2)}ms`);
            } else {
                this.addTestResult('SOURCE_LOOP_PREVENTION', false, 
                    `Source loop not prevented after ${callCount} attempts`);
            }
            
        } catch (error) {
            this.addTestResult('SOURCE_LOOP_PREVENTION', false, 
                `Error during source loop test: ${error.message}`);
        }
    }

    async testRateLimitingProtection() {
        console.log('\n📋 Test 5: Rate Limiting Protection');
        
        const testStartTime = performance.now();
        this.resetProtectionEvents();
        
        try {
            this.eventBus.registerModule('RateLimitTest', ['test']);
            
            let eventCount = 0;
            const maxEvents = 100;
            
            // Try to emit events rapidly to trigger rate limiting
            for (let i = 0; i < maxEvents; i++) {
                setTimeout(() => {
                    eventCount++;
                    this.eventBus.emit('rate:limit', {
                        _sourceModule: 'RateLimitTest',
                        eventNumber: eventCount,
                        timestamp: Date.now()
                    });
                }, 1); // Very fast emission
            }
            
            await this.waitForProtectionOrTimeout(2000);
            
            const duration = performance.now() - testStartTime;
            const protectionTriggered = this.protectionEvents.length > 0;
            
            if (protectionTriggered) {
                this.addTestResult('RATE_LIMITING_PROTECTION', true, 
                    `Rate limiting triggered after ${eventCount} events in ${duration.toFixed(2)}ms`);
            } else {
                this.addTestResult('RATE_LIMITING_PROTECTION', false, 
                    `Rate limiting not triggered after ${eventCount} events`);
            }
            
        } catch (error) {
            this.addTestResult('RATE_LIMITING_PROTECTION', false, 
                `Error during rate limiting test: ${error.message}`);
        }
    }

    async testEventDeduplication() {
        console.log('\n📋 Test 6: Event Deduplication');
        
        const testStartTime = performance.now();
        this.resetProtectionEvents();
        
        try {
            this.eventBus.registerModule('DeduplicationTest', ['test']);
            
            let processedEvents = 0;
            let duplicateEvents = 0;
            
            this.eventBus.subscribe('DeduplicationTest', 'dedup:test', (data) => {
                processedEvents++;
                
                // Emit duplicate events rapidly
                for (let i = 0; i < 10; i++) {
                    setTimeout(() => {
                        duplicateEvents++;
                        this.eventBus.emit('dedup:test', {
                            _sourceModule: 'DeduplicationTest',
                            message: 'duplicate message',
                            room: 'test',
                            username: 'testuser'
                        });
                    }, 1);
                }
            });
            
            // Start deduplication test
            this.eventBus.emit('dedup:test', {
                _sourceModule: 'DeduplicationTest',
                message: 'duplicate message',
                room: 'test',
                username: 'testuser'
            });
            
            await this.waitForProtectionOrTimeout(1000);
            
            const duration = performance.now() - testStartTime;
            const deduplicationWorking = duplicateEvents > processedEvents;
            
            if (deduplicationWorking) {
                this.addTestResult('EVENT_DEDUPLICATION', true, 
                    `Event deduplication working: ${duplicateEvents} duplicates sent, ${processedEvents} processed in ${duration.toFixed(2)}ms`);
            } else {
                this.addTestResult('EVENT_DEDUPLICATION', false, 
                    `Event deduplication not working: ${duplicateEvents} duplicates sent, ${processedEvents} processed`);
            }
            
        } catch (error) {
            this.addTestResult('EVENT_DEDUPLICATION', false, 
                `Error during deduplication test: ${error.message}`);
        }
    }

    async testStackDepthMonitoring() {
        console.log('\n📋 Test 7: Stack Depth Monitoring');
        
        const testStartTime = performance.now();
        this.resetProtectionEvents();
        
        try {
            this.eventBus.registerModule('StackDepthTest', ['test']);
            
            let currentDepth = 0;
            let maxDepthReached = 0;
            
            const deepRecursion = (depth) => {
                currentDepth = depth;
                maxDepthReached = Math.max(maxDepthReached, depth);
                
                if (depth < 100) {
                    this.eventBus.emit('stack:depth', {
                        _sourceModule: 'StackDepthTest',
                        depth: depth + 1
                    });
                }
            };
            
            this.eventBus.subscribe('StackDepthTest', 'stack:depth', (data) => {
                deepRecursion(data.depth);
            });
            
            // Start stack depth test
            this.eventBus.emit('stack:depth', {
                _sourceModule: 'StackDepthTest',
                depth: 0
            });
            
            await this.waitForProtectionOrTimeout(2000);
            
            const duration = performance.now() - testStartTime;
            const protectionTriggered = this.protectionEvents.length > 0;
            
            if (protectionTriggered) {
                this.addTestResult('STACK_DEPTH_MONITORING', true, 
                    `Stack depth monitoring triggered at depth ${maxDepthReached} in ${duration.toFixed(2)}ms`);
            } else {
                this.addTestResult('STACK_DEPTH_MONITORING', false, 
                    `Stack depth monitoring not triggered after reaching depth ${maxDepthReached}`);
            }
            
        } catch (error) {
            this.addTestResult('STACK_DEPTH_MONITORING', false, 
                `Error during stack depth test: ${error.message}`);
        }
    }

    async testCircuitBreakerFunctionality() {
        console.log('\n📋 Test 8: Circuit Breaker Functionality');
        
        const testStartTime = performance.now();
        this.resetProtectionEvents();
        
        try {
            this.eventBus.registerModule('CircuitBreakerTest', ['test']);
            
            let attemptCount = 0;
            let blockedCount = 0;
            
            // Create conditions that should trigger circuit breaker
            const triggerCircuitBreaker = () => {
                attemptCount++;
                
                try {
                    // Create multiple violations to trigger circuit breaker
                    for (let i = 0; i < 10; i++) {
                        this.eventBus.emit('circuit:breaker', {
                            _sourceModule: 'CircuitBreakerTest',
                            attempt: attemptCount,
                            violation: i
                        });
                    }
                } catch (error) {
                    blockedCount++;
                }
                
                if (attemptCount < 20) {
                    setTimeout(triggerCircuitBreaker, 10);
                }
            };
            
            this.eventBus.subscribe('CircuitBreakerTest', 'circuit:breaker', (data) => {
                // Create recursion to trigger circuit breaker
                if (data.violation < 5) {
                    this.eventBus.emit('circuit:breaker', {
                        _sourceModule: 'CircuitBreakerTest',
                        attempt: data.attempt,
                        violation: data.violation + 1
                    });
                }
            });
            
            // Start circuit breaker test
            triggerCircuitBreaker();
            
            await this.waitForProtectionOrTimeout(3000);
            
            const duration = performance.now() - testStartTime;
            const circuitBreakerStats = this.eventBus.getStats().recursionProtection.circuitBreaker;
            
            if (circuitBreakerStats.isOpen || circuitBreakerStats.failureCount > 0) {
                this.addTestResult('CIRCUIT_BREAKER_FUNCTIONALITY', true, 
                    `Circuit breaker activated after ${attemptCount} attempts, ${blockedCount} blocked in ${duration.toFixed(2)}ms`);
            } else {
                this.addTestResult('CIRCUIT_BREAKER_FUNCTIONALITY', false, 
                    `Circuit breaker not activated after ${attemptCount} attempts`);
            }
            
        } catch (error) {
            this.addTestResult('CIRCUIT_BREAKER_FUNCTIONALITY', false, 
                `Error during circuit breaker test: ${error.message}`);
        }
    }

    async testMemoryPressureCorrelation() {
        console.log('\n📋 Test 9: Memory Pressure Correlation');
        
        const testStartTime = performance.now();
        this.resetProtectionEvents();
        const initialMemory = process.memoryUsage();
        
        try {
            this.eventBus.registerModule('MemoryPressureTest', ['test']);
            
            let memoryEventCount = 0;
            const memorySnapshots = [];
            
            this.eventBus.subscribe('MemoryPressureTest', 'memory:pressure', (data) => {
                memoryEventCount++;
                
                // Create memory pressure with large objects
                const largeObject = {
                    _sourceModule: 'MemoryPressureTest',
                    largeArray: new Array(10000).fill(Math.random()),
                    deepNesting: this.createDeepObject(20),
                    timestamp: Date.now(),
                    iteration: memoryEventCount
                };
                
                memorySnapshots.push(process.memoryUsage());
                
                if (memoryEventCount < 50) {
                    this.eventBus.emit('memory:pressure', largeObject);
                }
            });
            
            // Start memory pressure test
            this.eventBus.emit('memory:pressure', {
                _sourceModule: 'MemoryPressureTest',
                iteration: 0
            });
            
            await this.waitForProtectionOrTimeout(2000);
            
            const duration = performance.now() - testStartTime;
            const finalMemory = process.memoryUsage();
            const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
            const protectionTriggered = this.protectionEvents.length > 0;
            
            if (protectionTriggered) {
                this.addTestResult('MEMORY_PRESSURE_CORRELATION', true, 
                    `Memory pressure correlation detected after ${memoryEventCount} events, ${(memoryGrowth/1024/1024).toFixed(2)}MB growth in ${duration.toFixed(2)}ms`);
            } else {
                this.addTestResult('MEMORY_PRESSURE_CORRELATION', false, 
                    `Memory pressure correlation not detected after ${memoryEventCount} events, ${(memoryGrowth/1024/1024).toFixed(2)}MB growth`);
            }
            
        } catch (error) {
            this.addTestResult('MEMORY_PRESSURE_CORRELATION', false, 
                `Error during memory pressure test: ${error.message}`);
        }
    }

    async testRecoveryAfterProtection() {
        console.log('\n📋 Test 10: Recovery After Protection');
        
        const testStartTime = performance.now();
        this.resetProtectionEvents();
        
        try {
            this.eventBus.registerModule('RecoveryTest', ['test']);
            
            let recursionCount = 0;
            let recoveryCount = 0;
            
            // Create recursion that should trigger protection
            this.eventBus.subscribe('RecoveryTest', 'recovery:recursion', (data) => {
                recursionCount++;
                
                if (recursionCount < 100) {
                    this.eventBus.emit('recovery:recursion', {
                        _sourceModule: 'RecoveryTest',
                        depth: (data.depth || 0) + 1
                    });
                }
            });
            
            // Start recursion
            this.eventBus.emit('recovery:recursion', {
                _sourceModule: 'RecoveryTest',
                depth: 0
            });
            
            // Wait for protection to trigger
            await this.waitForProtectionOrTimeout(1000);
            
            // Now test recovery
            setTimeout(() => {
                // Try to emit normal events after protection
                this.eventBus.subscribe('RecoveryTest', 'recovery:normal', (data) => {
                    recoveryCount++;
                });
                
                for (let i = 0; i < 10; i++) {
                    setTimeout(() => {
                        this.eventBus.emit('recovery:normal', {
                            _sourceModule: 'RecoveryTest',
                            recoveryAttempt: i
                        });
                    }, i * 100);
                }
            }, 1000);
            
            await this.waitForProtectionOrTimeout(3000);
            
            const duration = performance.now() - testStartTime;
            const protectionTriggered = this.protectionEvents.length > 0;
            
            if (protectionTriggered && recoveryCount > 0) {
                this.addTestResult('RECOVERY_AFTER_PROTECTION', true, 
                    `Recovery successful: ${recursionCount} recursions triggered protection, ${recoveryCount} normal events processed after recovery in ${duration.toFixed(2)}ms`);
            } else if (protectionTriggered && recoveryCount === 0) {
                this.addTestResult('RECOVERY_AFTER_PROTECTION', false, 
                    `Recovery failed: Protection triggered but no normal events processed after`);
            } else {
                this.addTestResult('RECOVERY_AFTER_PROTECTION', false, 
                    `Recovery test inconclusive: Protection not triggered`);
            }
            
        } catch (error) {
            this.addTestResult('RECOVERY_AFTER_PROTECTION', false, 
                `Error during recovery test: ${error.message}`);
        }
    }

    async testMultipleSimultaneousPatterns() {
        console.log('\n📋 Test 11: Multiple Simultaneous Recursion Patterns');
        
        const testStartTime = performance.now();
        this.resetProtectionEvents();
        
        try {
            this.eventBus.registerModule('MultiplePatternTest', ['test']);
            
            let pattern1Count = 0;
            let pattern2Count = 0;
            let pattern3Count = 0;
            
            // Pattern 1: Simple recursion
            this.eventBus.subscribe('MultiplePatternTest', 'pattern1:event', (data) => {
                pattern1Count++;
                if (pattern1Count < 50) {
                    this.eventBus.emit('pattern1:event', {
                        _sourceModule: 'MultiplePatternTest',
                        count: pattern1Count
                    });
                }
            });
            
            // Pattern 2: Indirect recursion
            this.eventBus.subscribe('MultiplePatternTest', 'pattern2:a', (data) => {
                pattern2Count++;
                if (pattern2Count < 50) {
                    this.eventBus.emit('pattern2:b', {
                        _sourceModule: 'MultiplePatternTest',
                        count: pattern2Count
                    });
                }
            });
            
            this.eventBus.subscribe('MultiplePatternTest', 'pattern2:b', (data) => {
                if (pattern2Count < 50) {
                    this.eventBus.emit('pattern2:a', {
                        _sourceModule: 'MultiplePatternTest',
                        count: pattern2Count
                    });
                }
            });
            
            // Pattern 3: Chain recursion
            this.eventBus.subscribe('MultiplePatternTest', 'pattern3:a', (data) => {
                pattern3Count++;
                if (pattern3Count < 50) {
                    this.eventBus.emit('pattern3:b', {
                        _sourceModule: 'MultiplePatternTest',
                        count: pattern3Count
                    });
                }
            });
            
            this.eventBus.subscribe('MultiplePatternTest', 'pattern3:b', (data) => {
                this.eventBus.emit('pattern3:c', {
                    _sourceModule: 'MultiplePatternTest',
                    count: pattern3Count
                });
            });
            
            this.eventBus.subscribe('MultiplePatternTest', 'pattern3:c', (data) => {
                if (pattern3Count < 50) {
                    this.eventBus.emit('pattern3:a', {
                        _sourceModule: 'MultiplePatternTest',
                        count: pattern3Count
                    });
                }
            });
            
            // Start all patterns simultaneously
            this.eventBus.emit('pattern1:event', { _sourceModule: 'MultiplePatternTest', count: 0 });
            this.eventBus.emit('pattern2:a', { _sourceModule: 'MultiplePatternTest', count: 0 });
            this.eventBus.emit('pattern3:a', { _sourceModule: 'MultiplePatternTest', count: 0 });
            
            await this.waitForProtectionOrTimeout(2000);
            
            const duration = performance.now() - testStartTime;
            const totalEvents = pattern1Count + pattern2Count + pattern3Count;
            const protectionTriggered = this.protectionEvents.length > 0;
            
            if (protectionTriggered) {
                this.addTestResult('MULTIPLE_SIMULTANEOUS_PATTERNS', true, 
                    `Multiple patterns controlled after ${totalEvents} events (P1:${pattern1Count}, P2:${pattern2Count}, P3:${pattern3Count}) in ${duration.toFixed(2)}ms`);
            } else {
                this.addTestResult('MULTIPLE_SIMULTANEOUS_PATTERNS', false, 
                    `Multiple patterns not controlled after ${totalEvents} events`);
            }
            
        } catch (error) {
            this.addTestResult('MULTIPLE_SIMULTANEOUS_PATTERNS', false, 
                `Error during multiple patterns test: ${error.message}`);
        }
    }

    async testExtremeRecursionScenarios() {
        console.log('\n📋 Test 12: Extreme Recursion Scenarios');
        
        const testStartTime = performance.now();
        this.resetProtectionEvents();
        this.stackOverflowDetected = false;
        
        try {
            this.eventBus.registerModule('ExtremeRecursionTest', ['test']);
            
            let extremeCount = 0;
            
            // Create extreme recursion scenario
            const extremeRecursion = (depth) => {
                extremeCount++;
                
                if (depth < 2000) {
                    // Multiple recursive calls to amplify the problem
                    for (let i = 0; i < 3; i++) {
                        this.eventBus.emit('extreme:recursion', {
                            _sourceModule: 'ExtremeRecursionTest',
                            depth: depth + 1,
                            branch: i
                        });
                    }
                }
            };
            
            this.eventBus.subscribe('ExtremeRecursionTest', 'extreme:recursion', (data) => {
                extremeRecursion(data.depth);
            });
            
            // Start extreme recursion
            this.eventBus.emit('extreme:recursion', {
                _sourceModule: 'ExtremeRecursionTest',
                depth: 0,
                branch: 0
            });
            
            await this.waitForProtectionOrTimeout(3000);
            
            const duration = performance.now() - testStartTime;
            const protectionTriggered = this.protectionEvents.length > 0;
            
            if (protectionTriggered && !this.stackOverflowDetected) {
                this.addTestResult('EXTREME_RECURSION_SCENARIOS', true, 
                    `Extreme recursion controlled after ${extremeCount} calls in ${duration.toFixed(2)}ms without stack overflow`);
            } else if (this.stackOverflowDetected) {
                this.addTestResult('EXTREME_RECURSION_SCENARIOS', false, 
                    `Stack overflow occurred during extreme recursion after ${extremeCount} calls`);
            } else {
                this.addTestResult('EXTREME_RECURSION_SCENARIOS', false, 
                    `Extreme recursion not controlled after ${extremeCount} calls`);
            }
            
        } catch (error) {
            this.addTestResult('EXTREME_RECURSION_SCENARIOS', false, 
                `Error during extreme recursion test: ${error.message}`);
        }
    }

    // Helper methods
    createDeepObject(depth) {
        if (depth === 0) return { value: Math.random() };
        return { nested: this.createDeepObject(depth - 1) };
    }

    resetProtectionEvents() {
        this.protectionEvents = [];
        this.stackOverflowDetected = false;
    }

    async waitForProtectionOrTimeout(timeoutMs) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const checkInterval = setInterval(() => {
                if (this.protectionEvents.length > 0 || this.stackOverflowDetected) {
                    clearInterval(checkInterval);
                    resolve();
                }
                
                if (Date.now() - startTime > timeoutMs) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 10);
        });
    }

    addTestResult(testName, passed, details) {
        this.testResults.push({
            testName,
            passed,
            details,
            timestamp: Date.now(),
            protectionEvents: [...this.protectionEvents]
        });
        
        const status = passed ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} ${testName}: ${details}`);
    }

    printTestResults() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 INFINITE RECURSION PROTECTION TEST RESULTS');
        console.log('='.repeat(80));
        
        const passed = this.testResults.filter(r => r.passed).length;
        const total = this.testResults.length;
        const duration = Date.now() - this.testStartTime;
        
        console.log(`\n🎯 Overall Result: ${passed}/${total} tests passed`);
        console.log(`⏱️  Total Duration: ${duration}ms`);
        
        if (passed === total) {
            console.log('🎉 ALL TESTS PASSED - Infinite recursion protection is working!');
        } else {
            console.log('⚠️  Some tests failed - Protection system needs improvement');
        }
        
        console.log('\n📋 Detailed Results:');
        this.testResults.forEach((result, index) => {
            const status = result.passed ? '✅' : '❌';
            console.log(`${index + 1}. ${status} ${result.testName}`);
            console.log(`   ${result.details}`);
            if (result.protectionEvents.length > 0) {
                console.log(`   Protection Events: ${result.protectionEvents.map(e => e.event).join(', ')}`);
            }
        });
        
        // EventBus statistics
        if (this.eventBus) {
            console.log('\n📈 Protection System Statistics:');
            const stats = this.eventBus.getStats();
            console.log(`   Total Events: ${stats.totalEvents}`);
            console.log(`   Circuit Breaker Open: ${stats.recursionProtection.circuitBreaker.isOpen}`);
            console.log(`   Circuit Breaker Failures: ${stats.recursionProtection.circuitBreaker.failureCount}`);
            console.log(`   Current Stack Depth: ${stats.recursionProtection.currentStackDepth}`);
            console.log(`   Active Chains: ${stats.recursionProtection.activeChains}`);
            console.log(`   Recent Events Tracked: ${stats.recursionProtection.recentEvents}`);
            console.log(`   Memory Usage - Event Chains: ${stats.recursionProtection.memoryUsage?.eventChains || 0}`);
            console.log(`   Memory Usage - Event Sources: ${stats.recursionProtection.memoryUsage?.eventSources || 0}`);
        }
        
        // Protection events summary
        if (this.protectionEvents.length > 0) {
            console.log('\n🛡️  Protection Events Summary:');
            const eventCounts = {};
            this.protectionEvents.forEach(event => {
                eventCounts[event.event] = (eventCounts[event.event] || 0) + 1;
            });
            
            for (const [event, count] of Object.entries(eventCounts)) {
                console.log(`   ${event}: ${count} times`);
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
            protectionEvents: this.protectionEvents,
            stackOverflowDetected: this.stackOverflowDetected
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
        
        console.log('🧹 Recursion protection test cleanup completed');
    }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tester = new InfiniteRecursionProtectionTest();
    tester.runAllTests().then((summary) => {
        process.exit(summary.success ? 0 : 1);
    }).catch((error) => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

export default InfiniteRecursionProtectionTest;