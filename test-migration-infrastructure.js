#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import LoggerCompatibilityLayer from './src/utils/LoggerCompatibilityLayer.js';
import DualLogger from './src/utils/DualLogger.js';
import MigrationValidator from './src/utils/MigrationValidator.js';
import LoggerRollback from './src/utils/LoggerRollback.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Comprehensive test suite for logger migration infrastructure
 * Tests all components for zero-downtime migration capability
 */
class MigrationInfrastructureTest {
    constructor() {
        this.testResults = [];
        this.totalTests = 0;
        this.passedTests = 0;
        this.failedTests = 0;
    }
    
    /**
     * Runs a test and records results
     * @param {string} testName - Name of the test
     * @param {Function} testFunction - Test function to execute
     * @returns {Promise<boolean>} Test success status
     */
    async runTest(testName, testFunction) {
        console.log(`\n🧪 Running test: ${testName}`);
        this.totalTests++;
        
        const startTime = Date.now();
        
        try {
            await testFunction();
            const duration = Date.now() - startTime;
            
            console.log(`✅ PASSED: ${testName} (${duration}ms)`);
            this.passedTests++;
            
            this.testResults.push({
                name: testName,
                status: 'PASSED',
                duration,
                timestamp: new Date().toISOString()
            });
            
            return true;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            console.error(`❌ FAILED: ${testName} (${duration}ms)`);
            console.error(`   Error: ${error.message}`);
            
            this.failedTests++;
            
            this.testResults.push({
                name: testName,
                status: 'FAILED',
                duration,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            
            return false;
        }
    }
    
    /**
     * Tests LoggerCompatibilityLayer functionality
     */
    async testCompatibilityLayer() {
        await this.runTest('LoggerCompatibilityLayer - Basic Initialization', async () => {
            const compatLayer = new LoggerCompatibilityLayer();
            
            // Test basic methods exist
            if (typeof compatLayer.info !== 'function') {
                throw new Error('info method missing');
            }
            
            if (typeof compatLayer.error !== 'function') {
                throw new Error('error method missing');
            }
            
            if (typeof compatLayer.child !== 'function') {
                throw new Error('child method missing');
            }
            
            await compatLayer.close();
        });
        
        await this.runTest('LoggerCompatibilityLayer - Configuration Mapping', async () => {
            const legacyConfig = {
                level: 'debug',
                logToConsole: true,
                logDir: './test-logs',
                maxFileSize: 1024,
                maxFiles: 3
            };
            
            const compatLayer = new LoggerCompatibilityLayer(legacyConfig);
            const stats = compatLayer.getStats();
            
            if (!stats.compatibility || stats.compatibility !== 'legacy-to-enhanced') {
                throw new Error('Configuration mapping failed');
            }
            
            await compatLayer.close();
        });
        
        await this.runTest('LoggerCompatibilityLayer - Fallback Mechanism', async () => {
            const compatLayer = new LoggerCompatibilityLayer({
                enableFallback: true,
                logDir: '/invalid/path/that/does/not/exist'
            });
            
            // This should not throw an error due to fallback
            compatLayer.info('Test message with fallback');
            
            const stats = compatLayer.getStats();
            if (stats.fallbackCount === 0) {
                throw new Error('Fallback mechanism not activated');
            }
            
            await compatLayer.close();
        });
        
        await this.runTest('LoggerCompatibilityLayer - Child Logger', async () => {
            const compatLayer = new LoggerCompatibilityLayer();
            const childLogger = compatLayer.child({ module: 'test' });
            
            // Test child logger methods
            childLogger.info('Child logger test');
            childLogger.error('Child logger error test');
            
            await compatLayer.close();
        });
    }
    
    /**
     * Tests DualLogger functionality
     */
    async testDualLogger() {
        await this.runTest('DualLogger - Dual Execution', async () => {
            const dualLogger = new DualLogger({
                validateOutput: true,
                comparisonSampling: 1.0
            });
            
            // Test dual execution
            await dualLogger.info('Dual logger test message');
            await dualLogger.error('Dual logger error test', new Error('Test error'));
            
            // Wait for validation to process
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const report = dualLogger.getValidationReport();
            if (report.summary.totalCalls === 0) {
                throw new Error('Dual execution not working');
            }
            
            await dualLogger.close();
        });
        
        await this.runTest('DualLogger - Mode Switching', async () => {
            const dualLogger = new DualLogger({
                mode: 'legacy-primary'
            });
            
            await dualLogger.info('Legacy primary mode test');
            
            // Switch to enhanced primary
            dualLogger.switchMode('enhanced-primary');
            await dualLogger.info('Enhanced primary mode test');
            
            // Switch to compare mode
            dualLogger.switchMode('compare');
            await dualLogger.info('Compare mode test');
            
            await dualLogger.close();
        });
        
        await this.runTest('DualLogger - Performance Monitoring', async () => {
            const dualLogger = new DualLogger({
                enableMetrics: true,
                validateOutput: true
            });
            
            // Generate some load
            for (let i = 0; i < 10; i++) {
                await dualLogger.info(`Performance test ${i}`);
            }
            
            const report = dualLogger.getValidationReport();
            if (!report.performance || !report.performance.average) {
                throw new Error('Performance monitoring not working');
            }
            
            await dualLogger.close();
        });
        
        await this.runTest('DualLogger - Child Logger', async () => {
            const dualLogger = new DualLogger();
            const childLogger = dualLogger.child({ module: 'test' });
            
            await childLogger.info('Child logger dual test');
            await childLogger.error('Child logger dual error test');
            
            await dualLogger.close();
        });
    }
    
    /**
     * Tests MigrationValidator functionality
     */
    async testMigrationValidator() {
        await this.runTest('MigrationValidator - Initialization', async () => {
            const validator = new MigrationValidator({
                testDir: './test-validation',
                testDuration: 5000,
                verbose: false
            });
            
            // Test initialization
            if (!validator.testSuite || validator.testSuite.length === 0) {
                throw new Error('Test suite not initialized');
            }
        });
        
        await this.runTest('MigrationValidator - API Compatibility Test', async () => {
            const validator = new MigrationValidator({
                testDir: './test-validation',
                verbose: false
            });
            
            const result = await validator.validateApiCompatibility();
            
            if (!result.success) {
                throw new Error('API compatibility validation failed');
            }
            
            if (!result.methods || Object.keys(result.methods).length === 0) {
                throw new Error('No methods validated');
            }
        });
        
        await this.runTest('MigrationValidator - Performance Test', async () => {
            const validator = new MigrationValidator({
                testDir: './test-validation',
                verbose: false
            });
            
            const result = await validator.validatePerformance();
            
            if (!result.success) {
                throw new Error('Performance validation failed');
            }
            
            if (!result.performance || !result.performance.legacy) {
                throw new Error('Performance metrics not collected');
            }
        });
    }
    
    /**
     * Tests LoggerRollback functionality
     */
    async testLoggerRollback() {
        await this.runTest('LoggerRollback - Initialization', async () => {
            const rollback = new LoggerRollback({
                configFile: './test-rollback-config.json',
                backupDir: './test-backup',
                enableMonitoring: false
            });
            
            const status = rollback.getStatus();
            if (status.state.currentLogger !== 'legacy') {
                throw new Error('Initial logger not set to legacy');
            }
            
            await rollback.shutdown();
        });
        
        await this.runTest('LoggerRollback - Logger Switching', async () => {
            const rollback = new LoggerRollback({
                configFile: './test-rollback-config.json',
                backupDir: './test-backup',
                enableMonitoring: false
            });
            
            // Switch to compatibility layer
            const success = await rollback.switchLogger('compatibility');
            
            if (!success) {
                throw new Error('Logger switching failed');
            }
            
            const status = rollback.getStatus();
            if (status.state.currentLogger !== 'compatibility') {
                throw new Error('Logger not switched correctly');
            }
            
            await rollback.shutdown();
        });
        
        await this.runTest('LoggerRollback - Emergency Rollback', async () => {
            const rollback = new LoggerRollback({
                configFile: './test-rollback-config.json',
                backupDir: './test-backup',
                enableMonitoring: false
            });
            
            // Simulate failure scenario
            const rollbackSuccess = await rollback.emergencyRollback('test-emergency');
            
            if (!rollbackSuccess) {
                throw new Error('Emergency rollback failed');
            }
            
            const status = rollback.getStatus();
            if (status.state.rollbackCount === 0) {
                throw new Error('Rollback count not incremented');
            }
            
            await rollback.shutdown();
        });
        
        await this.runTest('LoggerRollback - Rollback Validation', async () => {
            const rollback = new LoggerRollback({
                configFile: './test-rollback-config.json',
                backupDir: './test-backup',
                enableMonitoring: false
            });
            
            const validationResult = await rollback.validateRollback();
            
            if (!validationResult.success) {
                throw new Error('Rollback validation failed');
            }
            
            await rollback.shutdown();
        });
    }
    
    /**
     * Tests integration scenarios
     */
    async testIntegration() {
        await this.runTest('Integration - Zero-Downtime Migration Simulation', async () => {
            console.log('   📊 Simulating zero-downtime migration...');
            
            // Phase 1: Start with legacy logger
            const rollback = new LoggerRollback({
                configFile: './test-integration-config.json',
                backupDir: './test-integration-backup',
                enableMonitoring: false
            });
            
            let activeLogger = rollback.getLogger();
            activeLogger.info('Phase 1: Legacy logger active');
            
            // Phase 2: Switch to dual logger for validation
            const dualLogger = new DualLogger({
                mode: 'legacy-primary',
                validateOutput: true
            });
            
            await dualLogger.info('Phase 2: Dual logger active (legacy primary)');
            
            // Phase 3: Switch to enhanced primary
            dualLogger.switchMode('enhanced-primary');
            await dualLogger.info('Phase 3: Enhanced logger primary');
            
            // Phase 4: Switch to compatibility layer
            const compatLayer = new LoggerCompatibilityLayer();
            compatLayer.info('Phase 4: Compatibility layer active');
            
            // Phase 5: Final migration complete
            await rollback.switchLogger('compatibility');
            activeLogger = rollback.getLogger();
            activeLogger.info('Phase 5: Migration complete');
            
            // Cleanup
            await dualLogger.close();
            await compatLayer.close();
            await rollback.shutdown();
            
            console.log('   ✅ Zero-downtime migration simulation completed');
        });
        
        await this.runTest('Integration - End-to-End Migration', async () => {
            console.log('   🔄 Running end-to-end migration test...');
            
            // Run full migration validation
            const validator = new MigrationValidator({
                testDir: './test-e2e-migration',
                testDuration: 10000,
                verbose: false
            });
            
            const validationResults = await validator.validate();
            
            if (validationResults.migrationReadiness === 'NOT_READY') {
                throw new Error('Migration not ready according to validator');
            }
            
            console.log(`   📊 Migration readiness: ${validationResults.migrationReadiness}`);
            console.log(`   📊 Test results: ${validationResults.summary.passed}/${validationResults.summary.totalTests} passed`);
            
            if (validationResults.summary.failed > 0) {
                throw new Error(`${validationResults.summary.failed} validation tests failed`);
            }
        });
    }
    
    /**
     * Tests error handling and recovery
     */
    async testErrorHandling() {
        await this.runTest('Error Handling - Circular Reference', async () => {
            const compatLayer = new LoggerCompatibilityLayer();
            
            const circular = { name: 'test' };
            circular.self = circular;
            
            // This should not throw an error
            compatLayer.info('Circular reference test', circular);
            
            await compatLayer.close();
        });
        
        await this.runTest('Error Handling - Large Objects', async () => {
            const compatLayer = new LoggerCompatibilityLayer();
            
            const largeObject = {
                data: 'x'.repeat(100000),
                nested: {
                    array: new Array(1000).fill('test')
                }
            };
            
            // This should not throw an error
            compatLayer.info('Large object test', largeObject);
            
            await compatLayer.close();
        });
        
        await this.runTest('Error Handling - Invalid Configuration', async () => {
            // Test with invalid configuration
            const compatLayer = new LoggerCompatibilityLayer({
                enableFallback: true,
                logDir: '/root/invalid/path'
            });
            
            // Should fall back gracefully
            compatLayer.info('Invalid config test');
            
            const stats = compatLayer.getStats();
            if (!stats.isUsingFallback && stats.fallbackCount === 0) {
                throw new Error('Fallback not activated for invalid config');
            }
            
            await compatLayer.close();
        });
    }
    
    /**
     * Runs all tests
     */
    async runAllTests() {
        console.log('🚀 Starting Migration Infrastructure Test Suite');
        console.log('=' + '='.repeat(60));
        
        const startTime = Date.now();
        
        try {
            await this.testCompatibilityLayer();
            await this.testDualLogger();
            await this.testMigrationValidator();
            await this.testLoggerRollback();
            await this.testIntegration();
            await this.testErrorHandling();
            
        } catch (error) {
            console.error('❌ Test suite encountered critical error:', error);
        }
        
        const totalTime = Date.now() - startTime;
        
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUITE RESULTS');
        console.log('=' + '='.repeat(60));
        console.log(`Total Tests: ${this.totalTests}`);
        console.log(`Passed: ${this.passedTests}`);
        console.log(`Failed: ${this.failedTests}`);
        console.log(`Success Rate: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`);
        console.log(`Total Time: ${totalTime}ms`);
        console.log(`Average Time: ${(totalTime / this.totalTests).toFixed(1)}ms per test`);
        
        if (this.failedTests === 0) {
            console.log('\n🎉 ALL TESTS PASSED - Migration infrastructure is ready!');
        } else {
            console.log(`\n⚠️  ${this.failedTests} tests failed - Review issues before migration`);
        }
        
        // Clean up test files
        await this.cleanup();
        
        return {
            totalTests: this.totalTests,
            passedTests: this.passedTests,
            failedTests: this.failedTests,
            successRate: (this.passedTests / this.totalTests) * 100,
            duration: totalTime,
            results: this.testResults
        };
    }
    
    /**
     * Clean up test files and directories
     */
    async cleanup() {
        console.log('\n🧹 Cleaning up test files...');
        
        const testDirs = [
            './test-validation',
            './test-backup',
            './test-integration-backup',
            './test-e2e-migration',
            './test-logs'
        ];
        
        const testFiles = [
            './test-rollback-config.json',
            './test-integration-config.json',
            './logger-config.json'
        ];
        
        for (const dir of testDirs) {
            try {
                await import('fs').then(fs => fs.promises.rm(dir, { recursive: true, force: true }));
            } catch (error) {
                // Ignore cleanup errors
            }
        }
        
        for (const file of testFiles) {
            try {
                await import('fs').then(fs => fs.promises.unlink(file));
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const testSuite = new MigrationInfrastructureTest();
    
    testSuite.runAllTests().then((results) => {
        process.exit(results.failedTests === 0 ? 0 : 1);
    }).catch((error) => {
        console.error('Test suite failed:', error);
        process.exit(1);
    });
}

export default MigrationInfrastructureTest;