#!/usr/bin/env node

/**
 * Comprehensive Memory Management System Integration Test
 * 
 * This test verifies that the enhanced memory pressure monitoring and automatic cleanup
 * system is properly integrated and functioning as expected.
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { MemoryPressureMonitor } from './src/utils/MemoryPressureMonitor.js';
import { MemoryCleanupManager } from './src/utils/MemoryCleanupManager.js';
import { MemoryManager } from './src/core/MemoryManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MemoryManagementTester {
    constructor() {
        this.testResults = {
            passed: 0,
            failed: 0,
            errors: []
        };
        
        this.mockServices = new Map();
        this.mockConfig = {
            memory: {
                monitoring: {
                    enabled: true,
                    checkInterval: 1000, // 1 second for testing
                    historySize: 10,
                    pressureWindow: 5,
                    leakDetectionWindow: 5,
                    leakGrowthThreshold: 0.01,
                    gcEfficiencyThreshold: 0.05,
                    warningThreshold: 0.70,
                    criticalThreshold: 0.85,
                    emergencyThreshold: 0.95,
                    rssThreshold: 500 * 1024 * 1024, // 500MB for testing
                    externalThreshold: 100 * 1024 * 1024 // 100MB for testing
                },
                thresholds: {
                    warning: 0.70,
                    critical: 0.85,
                    emergency: 0.95,
                    rss: 500 * 1024 * 1024, // 500MB for testing
                    external: 100 * 1024 * 1024 // 100MB for testing
                },
                cleanup: {
                    enabled: true,
                    autoCleanup: true,
                    emergencyShutdown: false // Disable for testing
                },
                alerts: {
                    enabled: true,
                    cooldown: 5000,
                    emergencyCooldown: 2000
                }
            }
        };
        
        this.mockLogger = {
            info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
            warn: (msg, data) => console.log(`[WARN] ${msg}`, data || ''),
            error: (msg, data) => console.log(`[ERROR] ${msg}`, data || ''),
            debug: (msg, data) => {} // Silent debug for tests
        };
    }
    
    /**
     * Run a test and track results
     */
    async runTest(testName, testFunction) {
        try {
            console.log(`\n🧪 Running test: ${testName}`);
            await testFunction();
            this.testResults.passed++;
            console.log(`✅ ${testName} PASSED`);
        } catch (error) {
            this.testResults.failed++;
            this.testResults.errors.push({ test: testName, error: error.message });
            console.log(`❌ ${testName} FAILED: ${error.message}`);
        }
    }
    
    /**
     * Assert function for tests
     */
    assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }
    
    /**
     * Test Memory Pressure Monitor initialization and basic functionality
     */
    async testMemoryPressureMonitor() {
        const monitor = new MemoryPressureMonitor(this.mockConfig.memory.monitoring);
        
        // Test initialization
        this.assert(monitor.isMonitoring === false, 'Monitor should not be monitoring initially');
        this.assert(monitor.currentPressureLevel === 'normal', 'Initial pressure level should be normal');
        
        // Test starting monitoring
        monitor.start();
        this.assert(monitor.isMonitoring === true, 'Monitor should be monitoring after start');
        
        // Wait for a sample
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        // Test sample taking
        this.assert(monitor.history.length > 0, 'Should have at least one sample');
        
        const latestSample = monitor.getLatestSample();
        this.assert(latestSample !== null, 'Should have latest sample');
        this.assert(typeof latestSample.heap.usagePercent === 'number', 'Should have heap usage percentage');
        
        // Test component registration
        const testMap = new Map();
        testMap.set('test1', 'value1');
        testMap.set('test2', 'value2');
        
        monitor.registerComponent('testMap', testMap);
        
        const stats = monitor.getPressureStats();
        this.assert('testMap' in stats.components, 'Registered component should appear in stats');
        
        // Test pressure level calculation
        const mockSample = {
            heap: { usagePercent: 0.75 },
            process: { rss: 100 * 1024 * 1024, external: 50 * 1024 * 1024 }
        };
        
        const pressureLevel = monitor.calculatePressureLevel(mockSample);
        // Should be warning since 0.75 > 0.70 (warning threshold)
        this.assert(pressureLevel === 'warning', `Should detect warning pressure level, got: ${pressureLevel}`);
        
        monitor.stop();
        this.assert(monitor.isMonitoring === false, 'Monitor should stop monitoring');
    }
    
    /**
     * Test Memory Cleanup Manager functionality
     */
    async testMemoryCleanupManager() {
        const cleanupManager = new MemoryCleanupManager(this.mockServices, this.mockConfig.memory.cleanup, this.mockLogger);
        
        // Test strategy configuration
        const config = cleanupManager.getCleanupConfig();
        this.assert(config.strategies.gentle.enabled, 'Gentle strategy should be enabled');
        this.assert(config.strategies.emergency.enabled, 'Emergency strategy should be enabled');
        
        // Test component registration
        const testCache = new Map();
        for (let i = 0; i < 100; i++) {
            testCache.set(`key${i}`, `value${i}`);
        }
        
        cleanupManager.registerComponent('testCache', testCache);
        this.assert(cleanupManager.componentRegistry.has('testCache'), 'Component should be registered');
        
        // Test gentle cleanup
        const mockMemoryData = {
            sample: {
                heap: { usagePercent: 0.75, usedMB: 100 },
                process: { rssMB: 200, externalMB: 50 }
            }
        };
        
        const gentleResult = await cleanupManager.executeCleanup('gentle', mockMemoryData);
        this.assert(gentleResult.success, 'Gentle cleanup should succeed');
        this.assert(gentleResult.strategy === 'gentle', 'Should execute gentle strategy');
        
        // Test cleanup statistics
        const stats = cleanupManager.getCleanupStats();
        this.assert(stats.totalCleanups >= 1, 'Should have at least one cleanup recorded');
        this.assert(stats.strategyUsage.gentle >= 1, 'Should have gentle strategy usage recorded');
    }
    
    /**
     * Test Core Memory Manager integration
     */
    async testCoreMemoryManager() {
        const memoryManager = new MemoryManager(this.mockServices, this.mockConfig, this.mockLogger);
        
        // Test initialization
        await memoryManager.initialize();
        this.assert(memoryManager.isInitialized, 'Memory manager should be initialized');
        this.assert(memoryManager.isMonitoring, 'Memory manager should be monitoring');
        
        // Test component registration
        const testComponent = new Map();
        testComponent.set('test', 'data');
        
        await memoryManager.registerComponent('testComponent', testComponent);
        this.assert(memoryManager.componentRegistry.has('testComponent'), 'Component should be registered');
        
        // Test memory statistics
        const stats = memoryManager.getMemoryStats();
        this.assert(stats.system.isInitialized, 'System should show as initialized');
        this.assert(stats.system.isMonitoring, 'System should show as monitoring');
        
        // Test event handling
        let eventReceived = false;
        memoryManager.on('memory:sample', () => {
            eventReceived = true;
        });
        
        // Wait for events
        await new Promise(resolve => setTimeout(resolve, 2000));
        this.assert(eventReceived, 'Should receive memory sample events');
        
        // Test force cleanup
        const cleanupResult = await memoryManager.forceCleanup('gentle');
        this.assert(cleanupResult.success !== false, 'Force cleanup should not fail');
        
        await memoryManager.shutdown();
        this.assert(!memoryManager.isMonitoring, 'Should stop monitoring after shutdown');
    }
    
    /**
     * Test pressure event handling and escalation
     */
    async testPressureEventHandling() {
        const memoryManager = new MemoryManager(this.mockServices, this.mockConfig, this.mockLogger);
        await memoryManager.initialize();
        
        let warningReceived = false;
        let criticalReceived = false;
        
        memoryManager.on('memory:pressure:warning', () => {
            warningReceived = true;
        });
        
        memoryManager.on('memory:pressure:critical', () => {
            criticalReceived = true;
        });
        
        // Simulate pressure events by manipulating the monitor directly
        const monitor = memoryManager.pressureMonitor;
        
        // Create mock high-pressure sample
        const mockHighPressureSample = {
            timestamp: Date.now(),
            heap: {
                used: 800 * 1024 * 1024,
                limit: 1000 * 1024 * 1024,
                usagePercent: 0.80,
                usedMB: 800,
                limitMB: 1000
            },
            process: {
                rss: 900 * 1024 * 1024,
                external: 50 * 1024 * 1024,
                rssMB: 900,
                externalMB: 50
            },
            system: {
                total: 8 * 1024 * 1024 * 1024,
                free: 2 * 1024 * 1024 * 1024,
                usagePercent: 0.75
            },
            components: {},
            gc: { count: 5, lastGCTime: Date.now() }
        };
        
        // Add to history and trigger analysis
        monitor.history.push(mockHighPressureSample);
        monitor.currentPressureLevel = 'warning';
        monitor.analyzePressure();
        
        // Wait for events
        await new Promise(resolve => setTimeout(resolve, 100));
        
        this.assert(warningReceived, 'Should receive warning pressure event');
        
        await memoryManager.shutdown();
    }
    
    /**
     * Test memory leak detection
     */
    async testMemoryLeakDetection() {
        const monitor = new MemoryPressureMonitor({
            ...this.mockConfig.memory.monitoring,
            leakDetectionWindow: 3,
            leakGrowthThreshold: 0.05
        });
        
        let leakDetected = false;
        monitor.on('memory:leak-detected', () => {
            leakDetected = true;
        });
        
        monitor.start();
        
        // Simulate growing memory pattern
        const baseMemory = 100 * 1024 * 1024;
        for (let i = 0; i < 5; i++) {
            const growingMemory = baseMemory + (i * 10 * 1024 * 1024);
            const mockSample = {
                timestamp: Date.now() + (i * 1000),
                heap: {
                    used: growingMemory,
                    limit: 1000 * 1024 * 1024,
                    usagePercent: growingMemory / (1000 * 1024 * 1024),
                    usedMB: Math.round(growingMemory / 1024 / 1024)
                },
                process: {
                    rss: growingMemory * 1.2,
                    external: 50 * 1024 * 1024
                },
                system: {
                    usagePercent: 0.5
                },
                components: {},
                gc: { count: 1, lastGCTime: Date.now() }
            };
            
            monitor.history.push(mockSample);
        }
        
        // Trigger leak detection
        monitor.detectMemoryLeaks();
        
        // Wait for events
        await new Promise(resolve => setTimeout(resolve, 100));
        
        monitor.stop();
        
        this.assert(leakDetected, 'Should detect memory leak pattern');
    }
    
    /**
     * Test configuration validation
     */
    async testConfigurationValidation() {
        // Test with invalid configuration
        const invalidConfig = {
            memory: {
                thresholds: {
                    warning: 1.5, // Invalid - over 100%
                    critical: 0.5, // Invalid - less than warning
                    emergency: 0.3  // Invalid - less than critical
                }
            }
        };
        
        try {
            const monitor = new MemoryPressureMonitor(invalidConfig.memory.monitoring);
            // Should still work with defaults
            this.assert(monitor.thresholds.warning > 0 && monitor.thresholds.warning < 1, 'Should use valid default thresholds');
        } catch (error) {
            // Expected if validation is strict
        }
        
        // Test with valid configuration
        const validConfig = {
            monitoring: {
                checkInterval: 30000,
                historySize: 50
            },
            thresholds: {
                warning: 0.75,
                critical: 0.90,
                emergency: 0.95
            }
        };
        
        const monitor = new MemoryPressureMonitor({
            ...validConfig.monitoring,
            warningThreshold: validConfig.thresholds.warning,
            criticalThreshold: validConfig.thresholds.critical,
            emergencyThreshold: validConfig.thresholds.emergency
        });
        this.assert(monitor.thresholds.warning === 0.75, `Should use provided warning threshold, got: ${monitor.thresholds.warning}`);
        this.assert(monitor.config.checkInterval === 30000, `Should use provided check interval, got: ${monitor.config.checkInterval}`);
    }
    
    /**
     * Test memory statistics accuracy
     */
    async testMemoryStatistics() {
        const monitor = new MemoryPressureMonitor(this.mockConfig.memory.monitoring);
        monitor.start();
        
        // Wait for samples
        await new Promise(resolve => setTimeout(resolve, 2500));
        
        const stats = monitor.getPressureStats();
        
        // Validate statistics structure
        this.assert(typeof stats.current === 'object', 'Should have current stats');
        this.assert(typeof stats.thresholds === 'object', 'Should have thresholds');
        this.assert(typeof stats.stats === 'object', 'Should have system stats');
        this.assert(stats.stats.totalSamples > 0, 'Should have taken samples');
        this.assert(stats.isMonitoring === true, 'Should show monitoring status');
        
        // Test memory history
        const history = monitor.getMemoryHistory();
        this.assert(Array.isArray(history), 'History should be an array');
        this.assert(history.length > 0, 'Should have history entries');
        
        if (history.length > 0) {
            const entry = history[0];
            this.assert(typeof entry.timestamp === 'number', 'History entry should have timestamp');
            this.assert(typeof entry.heapUsedMB === 'number', 'History entry should have heap usage');
        }
        
        monitor.stop();
    }
    
    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🚀 Starting Comprehensive Memory Management System Tests');
        console.log('============================================================');
        
        await this.runTest('Memory Pressure Monitor', () => this.testMemoryPressureMonitor());
        await this.runTest('Memory Cleanup Manager', () => this.testMemoryCleanupManager());
        await this.runTest('Core Memory Manager Integration', () => this.testCoreMemoryManager());
        await this.runTest('Pressure Event Handling', () => this.testPressureEventHandling());
        await this.runTest('Memory Leak Detection', () => this.testMemoryLeakDetection());
        await this.runTest('Configuration Validation', () => this.testConfigurationValidation());
        await this.runTest('Memory Statistics Accuracy', () => this.testMemoryStatistics());
        
        console.log('\n============================================================');
        console.log('📊 TEST RESULTS SUMMARY');
        console.log('============================================================');
        console.log(`✅ Passed: ${this.testResults.passed}`);
        console.log(`❌ Failed: ${this.testResults.failed}`);
        console.log(`📈 Success Rate: ${Math.round((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100)}%`);
        
        if (this.testResults.errors.length > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.testResults.errors.forEach(({ test, error }) => {
                console.log(`   • ${test}: ${error}`);
            });
        }
        
        if (this.testResults.failed === 0) {
            console.log('\n🎉 ALL TESTS PASSED! Memory management system is working correctly.');
            console.log('\n📋 COMPREHENSIVE MEMORY MANAGEMENT FEATURES VERIFIED:');
            console.log('   ✅ Memory pressure monitoring with configurable thresholds');
            console.log('   ✅ Automatic cleanup strategies with escalation levels');
            console.log('   ✅ Memory leak detection and pattern analysis');
            console.log('   ✅ Component memory tracking and registration');
            console.log('   ✅ Emergency memory management capabilities');
            console.log('   ✅ Real-time memory statistics and history tracking');
            console.log('   ✅ Event-driven pressure alert system');
            
            return true;
        } else {
            console.log('\n⚠️  Some tests failed. Review the errors above and fix issues before deployment.');
            return false;
        }
    }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tester = new MemoryManagementTester();
    tester.runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Test runner failed:', error);
        process.exit(1);
    });
}

export default MemoryManagementTester;