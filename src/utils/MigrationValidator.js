import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createLogger as createLegacyLogger } from './logger.js';
import EnhancedWinstonLogger from './EnhancedWinstonLogger.js';
import LoggerCompatibilityLayer from './LoggerCompatibilityLayer.js';
import DualLogger from './DualLogger.js';

/**
 * MigrationValidator provides comprehensive validation tools for the logger migration process.
 * It ensures safe migration by validating API compatibility, log format consistency,
 * performance characteristics, and overall system integrity.
 * 
 * Features:
 * - API compatibility validation
 * - Log format consistency checking
 * - Performance comparison and analysis
 * - File output validation
 * - Configuration validation
 * - Migration readiness assessment
 * - Comprehensive reporting
 */
class MigrationValidator {
    /**
     * Creates a migration validator instance
     * @param {Object} options - Configuration options
     * @param {string} [options.testDir='./test-migration'] - Directory for test files
     * @param {string} [options.logDir='./logs'] - Directory containing log files
     * @param {number} [options.testDuration=60000] - Test duration in milliseconds
     * @param {boolean} [options.verbose=false] - Enable verbose logging
     */
    constructor(options = {}) {
        this.options = {
            testDir: options.testDir || './test-migration',
            logDir: options.logDir || './logs',
            testDuration: options.testDuration || 60000,
            verbose: options.verbose || false,
            ...options
        };
        
        this.results = {
            apiCompatibility: {},
            formatConsistency: {},
            performanceComparison: {},
            fileValidation: {},
            configurationValidation: {},
            overallAssessment: {}
        };
        
        this.testSuite = [];
        this.setupTestEnvironment();
    }
    
    /**
     * Sets up the test environment
     * @private
     */
    setupTestEnvironment() {
        // Ensure test directory exists
        if (!fs.existsSync(this.options.testDir)) {
            fs.mkdirSync(this.options.testDir, { recursive: true });
        }
        
        // Initialize test suite
        this.testSuite = [
            { name: 'API Compatibility Test', method: 'validateApiCompatibility' },
            { name: 'Format Consistency Test', method: 'validateFormatConsistency' },
            { name: 'Performance Comparison Test', method: 'validatePerformance' },
            { name: 'File Output Validation Test', method: 'validateFileOutput' },
            { name: 'Configuration Validation Test', method: 'validateConfiguration' },
            { name: 'Integration Test', method: 'validateIntegration' },
            { name: 'Error Handling Test', method: 'validateErrorHandling' }
        ];
        
        this.log('MigrationValidator initialized');
    }
    
    /**
     * Logs messages with optional verbose mode
     * @private
     * @param {string} message - Message to log
     * @param {string} [level='info'] - Log level
     */
    log(message, level = 'info') {
        if (this.options.verbose || level === 'error') {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
        }
    }
    
    /**
     * Runs the complete migration validation suite
     * @returns {Promise<Object>} Comprehensive validation results
     */
    async validate() {
        this.log('Starting migration validation suite...');
        const startTime = Date.now();
        
        const results = {
            timestamp: startTime,
            duration: 0,
            testResults: {},
            summary: {
                totalTests: this.testSuite.length,
                passed: 0,
                failed: 0,
                warnings: 0
            },
            recommendations: [],
            migrationReadiness: 'unknown'
        };
        
        // Run all tests
        for (const test of this.testSuite) {
            try {
                this.log(`Running ${test.name}...`);
                const testResult = await this[test.method]();
                
                results.testResults[test.name] = {
                    ...testResult,
                    passed: testResult.success,
                    duration: testResult.duration || 0
                };
                
                if (testResult.success) {
                    results.summary.passed++;
                } else {
                    results.summary.failed++;
                }
                
                if (testResult.warnings && testResult.warnings.length > 0) {
                    results.summary.warnings += testResult.warnings.length;
                }
                
                this.log(`${test.name} ${testResult.success ? 'PASSED' : 'FAILED'}`);
                
            } catch (error) {
                this.log(`${test.name} ERROR: ${error.message}`, 'error');
                
                results.testResults[test.name] = {
                    success: false,
                    passed: false,
                    error: error.message,
                    duration: 0
                };
                
                results.summary.failed++;
            }
        }
        
        // Calculate overall assessment
        results.duration = Date.now() - startTime;
        results.migrationReadiness = this.assessMigrationReadiness(results);
        results.recommendations = this.generateRecommendations(results);
        
        // Save results
        await this.saveResults(results);
        
        this.log(`Migration validation completed in ${results.duration}ms`);
        this.log(`Results: ${results.summary.passed} passed, ${results.summary.failed} failed, ${results.summary.warnings} warnings`);
        this.log(`Migration readiness: ${results.migrationReadiness}`);
        
        return results;
    }
    
    /**
     * Validates API compatibility between legacy and enhanced loggers
     * @returns {Promise<Object>} API compatibility test results
     */
    async validateApiCompatibility() {
        const startTime = Date.now();
        const results = {
            success: true,
            methods: {},
            warnings: [],
            errors: []
        };
        
        try {
            // Create test instances
            const legacyLogger = createLegacyLogger();
            const enhancedLogger = new EnhancedWinstonLogger();
            const compatibilityLayer = new LoggerCompatibilityLayer();
            
            // Define expected methods
            const expectedMethods = [
                'error', 'warn', 'info', 'debug',
                'command', 'userEvent', 'connection',
                'child', 'getLevel', 'setLevel'
            ];
            
            // Test method existence
            for (const method of expectedMethods) {
                const legacy = typeof legacyLogger[method] === 'function';
                const enhanced = typeof enhancedLogger[method] === 'function';
                const compatibility = typeof compatibilityLayer[method] === 'function';
                
                results.methods[method] = {
                    legacy,
                    enhanced,
                    compatibility,
                    consistent: legacy && enhanced && compatibility
                };
                
                if (!results.methods[method].consistent) {
                    results.warnings.push(`Method ${method} availability inconsistent`);
                }
            }
            
            // Test method signatures by calling with sample data
            const testCases = [
                { method: 'info', args: ['test message'] },
                { method: 'info', args: ['test message', { key: 'value' }] },
                { method: 'error', args: ['test error', new Error('test')] },
                { method: 'command', args: ['testuser', 'testcommand', ['arg1', 'arg2']] },
                { method: 'userEvent', args: ['testuser', 'join'] },
                { method: 'connection', args: ['connect', { room: 'test' }] }
            ];
            
            for (const testCase of testCases) {
                try {
                    // Test compatibility layer
                    await compatibilityLayer[testCase.method](...testCase.args);
                    results.methods[testCase.method] = results.methods[testCase.method] || {};
                    results.methods[testCase.method].signatureCompatible = true;
                } catch (error) {
                    results.methods[testCase.method] = results.methods[testCase.method] || {};
                    results.methods[testCase.method].signatureCompatible = false;
                    results.warnings.push(`Method ${testCase.method} signature incompatible: ${error.message}`);
                }
            }
            
            // Test child logger
            try {
                const childLogger = compatibilityLayer.child({ module: 'test' });
                await childLogger.info('Child logger test');
                results.methods.child.functional = true;
            } catch (error) {
                results.methods.child.functional = false;
                results.errors.push(`Child logger test failed: ${error.message}`);
            }
            
            // Clean up
            await enhancedLogger.close();
            await compatibilityLayer.close();
            
        } catch (error) {
            results.success = false;
            results.errors.push(error.message);
        }
        
        results.duration = Date.now() - startTime;
        return results;
    }
    
    /**
     * Validates format consistency between loggers
     * @returns {Promise<Object>} Format consistency test results
     */
    async validateFormatConsistency() {
        const startTime = Date.now();
        const results = {
            success: true,
            formats: {},
            warnings: [],
            errors: []
        };
        
        try {
            // Create test log directory
            const testLogDir = path.join(this.options.testDir, 'format-test');
            if (!fs.existsSync(testLogDir)) {
                fs.mkdirSync(testLogDir, { recursive: true });
            }
            
            // Create dual logger for comparison
            const dualLogger = new DualLogger({
                legacy: { logDir: path.join(testLogDir, 'legacy') },
                enhanced: { logDir: path.join(testLogDir, 'enhanced') },
                validateOutput: true,
                comparisonSampling: 1.0
            });
            
            // Generate test log entries
            const testMessages = [
                { level: 'info', message: 'Simple info message' },
                { level: 'error', message: 'Error message', context: new Error('Test error') },
                { level: 'warn', message: 'Warning with context', context: { key: 'value', nested: { prop: 'data' } } },
                { level: 'debug', message: 'Debug message', context: 'string context' }
            ];
            
            for (const test of testMessages) {
                await dualLogger[test.level](test.message, test.context);
            }
            
            // Test bot-specific methods
            await dualLogger.command('testuser', 'testcmd', ['arg1', 'arg2']);
            await dualLogger.userEvent('testuser', 'join');
            await dualLogger.connection('connect', { room: 'test', timestamp: Date.now() });
            
            // Wait for logging to complete
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Get validation report
            const validationReport = dualLogger.getValidationReport();
            
            results.formats = {
                totalComparisons: validationReport.summary.comparisons,
                discrepancies: validationReport.summary.discrepancies,
                discrepancyRate: validationReport.summary.discrepancyRate,
                recentValidations: validationReport.recentValidations
            };
            
            if (validationReport.summary.discrepancyRate > 0.1) {
                results.warnings.push(`High discrepancy rate: ${(validationReport.summary.discrepancyRate * 100).toFixed(2)}%`);
            }
            
            // Clean up
            await dualLogger.close();
            
        } catch (error) {
            results.success = false;
            results.errors.push(error.message);
        }
        
        results.duration = Date.now() - startTime;
        return results;
    }
    
    /**
     * Validates performance characteristics
     * @returns {Promise<Object>} Performance validation results
     */
    async validatePerformance() {
        const startTime = Date.now();
        const results = {
            success: true,
            performance: {},
            warnings: [],
            errors: []
        };
        
        try {
            // Create test instances
            const legacyLogger = createLegacyLogger();
            const enhancedLogger = new EnhancedWinstonLogger();
            const compatibilityLayer = new LoggerCompatibilityLayer();
            
            // Performance test parameters
            const testIterations = 1000;
            const testMessage = 'Performance test message';
            const testContext = { iteration: 0, timestamp: Date.now() };
            
            // Test legacy logger performance
            const legacyStart = process.hrtime.bigint();
            for (let i = 0; i < testIterations; i++) {
                testContext.iteration = i;
                legacyLogger.info(testMessage, testContext);
            }
            const legacyEnd = process.hrtime.bigint();
            const legacyDuration = Number(legacyEnd - legacyStart) / 1000000; // Convert to ms
            
            // Test enhanced logger performance
            const enhancedStart = process.hrtime.bigint();
            for (let i = 0; i < testIterations; i++) {
                testContext.iteration = i;
                enhancedLogger.info(testMessage, testContext);
            }
            const enhancedEnd = process.hrtime.bigint();
            const enhancedDuration = Number(enhancedEnd - enhancedStart) / 1000000; // Convert to ms
            
            // Test compatibility layer performance
            const compatStart = process.hrtime.bigint();
            for (let i = 0; i < testIterations; i++) {
                testContext.iteration = i;
                compatibilityLayer.info(testMessage, testContext);
            }
            const compatEnd = process.hrtime.bigint();
            const compatDuration = Number(compatEnd - compatStart) / 1000000; // Convert to ms
            
            results.performance = {
                iterations: testIterations,
                legacy: {
                    totalTime: legacyDuration,
                    avgPerCall: legacyDuration / testIterations,
                    callsPerSecond: (testIterations / legacyDuration) * 1000
                },
                enhanced: {
                    totalTime: enhancedDuration,
                    avgPerCall: enhancedDuration / testIterations,
                    callsPerSecond: (testIterations / enhancedDuration) * 1000
                },
                compatibility: {
                    totalTime: compatDuration,
                    avgPerCall: compatDuration / testIterations,
                    callsPerSecond: (testIterations / compatDuration) * 1000
                }
            };
            
            // Calculate performance ratios
            results.performance.ratios = {
                enhancedVsLegacy: enhancedDuration / legacyDuration,
                compatibilityVsLegacy: compatDuration / legacyDuration,
                compatibilityVsEnhanced: compatDuration / enhancedDuration
            };
            
            // Generate warnings for significant performance degradation
            if (results.performance.ratios.enhancedVsLegacy > 2) {
                results.warnings.push(`Enhanced logger is ${results.performance.ratios.enhancedVsLegacy.toFixed(2)}x slower than legacy`);
            }
            
            if (results.performance.ratios.compatibilityVsLegacy > 3) {
                results.warnings.push(`Compatibility layer is ${results.performance.ratios.compatibilityVsLegacy.toFixed(2)}x slower than legacy`);
            }
            
            // Clean up
            await enhancedLogger.close();
            await compatibilityLayer.close();
            
        } catch (error) {
            results.success = false;
            results.errors.push(error.message);
        }
        
        results.duration = Date.now() - startTime;
        return results;
    }
    
    /**
     * Validates file output consistency
     * @returns {Promise<Object>} File output validation results
     */
    async validateFileOutput() {
        const startTime = Date.now();
        const results = {
            success: true,
            files: {},
            warnings: [],
            errors: []
        };
        
        try {
            // Create test log directory
            const testLogDir = path.join(this.options.testDir, 'file-output-test');
            if (!fs.existsSync(testLogDir)) {
                fs.mkdirSync(testLogDir, { recursive: true });
            }
            
            // Create loggers with file output
            const legacyLogger = createLegacyLogger({ logDir: path.join(testLogDir, 'legacy') });
            const enhancedLogger = new EnhancedWinstonLogger({ logDir: path.join(testLogDir, 'enhanced') });
            
            // Generate test log entries
            const testEntries = [
                { level: 'info', message: 'Test info message', context: { id: 1 } },
                { level: 'error', message: 'Test error message', context: new Error('Test error') },
                { level: 'warn', message: 'Test warning message', context: { warning: true } },
                { level: 'debug', message: 'Test debug message', context: 'debug context' }
            ];
            
            for (const entry of testEntries) {
                legacyLogger[entry.level](entry.message, entry.context);
                enhancedLogger[entry.level](entry.message, entry.context);
            }
            
            // Wait for file writing to complete
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check file existence and content
            const legacyFiles = fs.readdirSync(path.join(testLogDir, 'legacy'));
            const enhancedFiles = fs.readdirSync(path.join(testLogDir, 'enhanced'));
            
            results.files = {
                legacy: {
                    count: legacyFiles.length,
                    files: legacyFiles,
                    totalSize: this.calculateDirectorySize(path.join(testLogDir, 'legacy'))
                },
                enhanced: {
                    count: enhancedFiles.length,
                    files: enhancedFiles,
                    totalSize: this.calculateDirectorySize(path.join(testLogDir, 'enhanced'))
                }
            };
            
            // Validate file content structure
            for (const file of legacyFiles) {
                const filePath = path.join(testLogDir, 'legacy', file);
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n').filter(line => line.trim());
                
                results.files.legacy.entries = lines.length;
                results.files.legacy.sampleContent = lines.slice(0, 3);
            }
            
            for (const file of enhancedFiles) {
                const filePath = path.join(testLogDir, 'enhanced', file);
                const content = fs.readFileSync(filePath, 'utf8');
                const lines = content.split('\n').filter(line => line.trim());
                
                results.files.enhanced.entries = lines.length;
                results.files.enhanced.sampleContent = lines.slice(0, 3);
            }
            
            // Clean up
            await enhancedLogger.close();
            
        } catch (error) {
            results.success = false;
            results.errors.push(error.message);
        }
        
        results.duration = Date.now() - startTime;
        return results;
    }
    
    /**
     * Calculates directory size
     * @private
     * @param {string} dirPath - Directory path
     * @returns {number} Total size in bytes
     */
    calculateDirectorySize(dirPath) {
        let totalSize = 0;
        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stats = fs.statSync(filePath);
            totalSize += stats.size;
        }
        
        return totalSize;
    }
    
    /**
     * Validates configuration mapping and compatibility
     * @returns {Promise<Object>} Configuration validation results
     */
    async validateConfiguration() {
        const startTime = Date.now();
        const results = {
            success: true,
            configurations: {},
            warnings: [],
            errors: []
        };
        
        try {
            // Test various configuration scenarios
            const testConfigs = [
                { name: 'default', config: {} },
                { name: 'minimal', config: { level: 'error', console: false } },
                { name: 'verbose', config: { level: 'debug', console: true, colorize: true } },
                { name: 'file-only', config: { console: false, logDir: '/tmp/test-logs' } },
                { name: 'custom-rotation', config: { maxFileSize: 1024, maxFiles: 10 } }
            ];
            
            for (const testConfig of testConfigs) {
                try {
                    const compatibilityLayer = new LoggerCompatibilityLayer(testConfig.config);
                    const stats = compatibilityLayer.getStats();
                    
                    results.configurations[testConfig.name] = {
                        success: true,
                        stats,
                        configMapped: true
                    };
                    
                    await compatibilityLayer.close();
                    
                } catch (error) {
                    results.configurations[testConfig.name] = {
                        success: false,
                        error: error.message,
                        configMapped: false
                    };
                    
                    results.warnings.push(`Configuration ${testConfig.name} failed: ${error.message}`);
                }
            }
            
        } catch (error) {
            results.success = false;
            results.errors.push(error.message);
        }
        
        results.duration = Date.now() - startTime;
        return results;
    }
    
    /**
     * Validates integration with existing codebase
     * @returns {Promise<Object>} Integration validation results
     */
    async validateIntegration() {
        const startTime = Date.now();
        const results = {
            success: true,
            integration: {},
            warnings: [],
            errors: []
        };
        
        try {
            // Test drop-in replacement scenario
            const compatibilityLayer = new LoggerCompatibilityLayer();
            
            // Simulate typical usage patterns found in codebase
            const testScenarios = [
                {
                    name: 'database-service',
                    test: async () => {
                        const logger = compatibilityLayer.child({ service: 'database' });
                        logger.info('Database connected');
                        logger.error('Database connection failed', new Error('Connection timeout'));
                    }
                },
                {
                    name: 'bot-commands',
                    test: async () => {
                        compatibilityLayer.command('testuser', 'help', []);
                        compatibilityLayer.userEvent('testuser', 'join');
                        compatibilityLayer.connection('established', { room: 'test' });
                    }
                },
                {
                    name: 'error-handling',
                    test: async () => {
                        try {
                            throw new Error('Test error');
                        } catch (error) {
                            compatibilityLayer.error('Caught error', error);
                        }
                    }
                }
            ];
            
            for (const scenario of testScenarios) {
                try {
                    await scenario.test();
                    results.integration[scenario.name] = { success: true };
                } catch (error) {
                    results.integration[scenario.name] = { success: false, error: error.message };
                    results.warnings.push(`Integration scenario ${scenario.name} failed: ${error.message}`);
                }
            }
            
            await compatibilityLayer.close();
            
        } catch (error) {
            results.success = false;
            results.errors.push(error.message);
        }
        
        results.duration = Date.now() - startTime;
        return results;
    }
    
    /**
     * Validates error handling and fallback mechanisms
     * @returns {Promise<Object>} Error handling validation results
     */
    async validateErrorHandling() {
        const startTime = Date.now();
        const results = {
            success: true,
            errorHandling: {},
            warnings: [],
            errors: []
        };
        
        try {
            // Test fallback mechanisms
            const compatibilityLayer = new LoggerCompatibilityLayer({
                enableFallback: true,
                logDir: '/invalid/path/that/does/not/exist'
            });
            
            // Test error scenarios
            const errorTests = [
                {
                    name: 'invalid-log-directory',
                    test: async () => {
                        compatibilityLayer.info('Test message to invalid directory');
                    }
                },
                {
                    name: 'circular-reference',
                    test: async () => {
                        const circular = { prop: 'value' };
                        circular.self = circular;
                        compatibilityLayer.info('Circular reference test', circular);
                    }
                },
                {
                    name: 'large-object',
                    test: async () => {
                        const largeObj = { data: 'x'.repeat(100000) };
                        compatibilityLayer.info('Large object test', largeObj);
                    }
                }
            ];
            
            for (const test of errorTests) {
                try {
                    await test.test();
                    results.errorHandling[test.name] = { success: true, fallbackUsed: false };
                } catch (error) {
                    results.errorHandling[test.name] = { success: false, error: error.message };
                    results.warnings.push(`Error handling test ${test.name} failed: ${error.message}`);
                }
            }
            
            // Check fallback usage
            const stats = compatibilityLayer.getStats();
            if (stats.fallbackCount > 0) {
                results.errorHandling.fallbackActivated = true;
                results.errorHandling.fallbackUsageCount = stats.fallbackCount;
            }
            
            await compatibilityLayer.close();
            
        } catch (error) {
            results.success = false;
            results.errors.push(error.message);
        }
        
        results.duration = Date.now() - startTime;
        return results;
    }
    
    /**
     * Assesses overall migration readiness
     * @private
     * @param {Object} results - Validation results
     * @returns {string} Migration readiness assessment
     */
    assessMigrationReadiness(results) {
        const { passed, failed, warnings } = results.summary;
        const successRate = passed / (passed + failed);
        
        if (successRate >= 0.95 && warnings < 5) {
            return 'READY';
        } else if (successRate >= 0.85 && warnings < 10) {
            return 'READY_WITH_WARNINGS';
        } else if (successRate >= 0.7) {
            return 'NEEDS_ATTENTION';
        } else {
            return 'NOT_READY';
        }
    }
    
    /**
     * Generates recommendations based on validation results
     * @private
     * @param {Object} results - Validation results
     * @returns {Array} Array of recommendations
     */
    generateRecommendations(results) {
        const recommendations = [];
        
        // Check API compatibility
        if (results.testResults['API Compatibility Test'] && !results.testResults['API Compatibility Test'].passed) {
            recommendations.push({
                priority: 'HIGH',
                category: 'API',
                message: 'Fix API compatibility issues before migration',
                action: 'Review and fix method signature mismatches'
            });
        }
        
        // Check performance
        if (results.testResults['Performance Comparison Test'] && results.testResults['Performance Comparison Test'].passed) {
            const perfTest = results.testResults['Performance Comparison Test'];
            if (perfTest.performance && perfTest.performance.ratios.compatibilityVsLegacy > 2) {
                recommendations.push({
                    priority: 'MEDIUM',
                    category: 'PERFORMANCE',
                    message: 'Consider performance optimization',
                    action: 'Profile and optimize compatibility layer overhead'
                });
            }
        }
        
        // Check format consistency
        if (results.testResults['Format Consistency Test'] && results.testResults['Format Consistency Test'].passed) {
            const formatTest = results.testResults['Format Consistency Test'];
            if (formatTest.formats && formatTest.formats.discrepancyRate > 0.1) {
                recommendations.push({
                    priority: 'MEDIUM',
                    category: 'FORMAT',
                    message: 'Address format discrepancies',
                    action: 'Review and align log format differences'
                });
            }
        }
        
        // Check error handling
        if (results.testResults['Error Handling Test'] && results.testResults['Error Handling Test'].warnings.length > 0) {
            recommendations.push({
                priority: 'LOW',
                category: 'ERROR_HANDLING',
                message: 'Improve error handling robustness',
                action: 'Test and strengthen fallback mechanisms'
            });
        }
        
        return recommendations;
    }
    
    /**
     * Saves validation results to file
     * @private
     * @param {Object} results - Validation results
     * @returns {Promise<void>}
     */
    async saveResults(results) {
        const resultsPath = path.join(this.options.testDir, `migration-validation-${Date.now()}.json`);
        
        try {
            await fs.promises.writeFile(resultsPath, JSON.stringify(results, null, 2));
            this.log(`Results saved to ${resultsPath}`);
        } catch (error) {
            this.log(`Failed to save results: ${error.message}`, 'error');
        }
    }
    
    /**
     * Generates a human-readable report
     * @param {Object} results - Validation results
     * @returns {string} Human-readable report
     */
    generateReport(results) {
        const lines = [];
        
        lines.push('='.repeat(60));
        lines.push('LOGGER MIGRATION VALIDATION REPORT');
        lines.push('='.repeat(60));
        lines.push('');
        
        lines.push(`Timestamp: ${new Date(results.timestamp).toISOString()}`);
        lines.push(`Duration: ${results.duration}ms`);
        lines.push(`Migration Readiness: ${results.migrationReadiness}`);
        lines.push('');
        
        lines.push('SUMMARY');
        lines.push('-'.repeat(30));
        lines.push(`Total Tests: ${results.summary.totalTests}`);
        lines.push(`Passed: ${results.summary.passed}`);
        lines.push(`Failed: ${results.summary.failed}`);
        lines.push(`Warnings: ${results.summary.warnings}`);
        lines.push(`Success Rate: ${((results.summary.passed / results.summary.totalTests) * 100).toFixed(1)}%`);
        lines.push('');
        
        lines.push('TEST RESULTS');
        lines.push('-'.repeat(30));
        for (const [testName, result] of Object.entries(results.testResults)) {
            const status = result.passed ? 'PASS' : 'FAIL';
            lines.push(`${testName}: ${status} (${result.duration}ms)`);
            
            if (result.warnings && result.warnings.length > 0) {
                result.warnings.forEach(warning => {
                    lines.push(`  WARNING: ${warning}`);
                });
            }
            
            if (result.errors && result.errors.length > 0) {
                result.errors.forEach(error => {
                    lines.push(`  ERROR: ${error}`);
                });
            }
        }
        lines.push('');
        
        if (results.recommendations && results.recommendations.length > 0) {
            lines.push('RECOMMENDATIONS');
            lines.push('-'.repeat(30));
            results.recommendations.forEach(rec => {
                lines.push(`[${rec.priority}] ${rec.category}: ${rec.message}`);
                lines.push(`  Action: ${rec.action}`);
            });
            lines.push('');
        }
        
        lines.push('='.repeat(60));
        
        return lines.join('\n');
    }
}

export default MigrationValidator;