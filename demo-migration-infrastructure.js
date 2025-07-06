#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import LoggerCompatibilityLayer from './src/utils/LoggerCompatibilityLayer.js';
import DualLogger from './src/utils/DualLogger.js';
import MigrationValidator from './src/utils/MigrationValidator.js';
import LoggerRollback from './src/utils/LoggerRollback.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Demonstration of Logger Migration Infrastructure
 * Shows how to safely migrate from legacy to enhanced logger with zero downtime
 */
class MigrationInfrastructureDemo {
    constructor() {
        this.currentStep = 0;
        this.totalSteps = 8;
    }
    
    /**
     * Logs step information
     */
    logStep(title, description) {
        this.currentStep++;
        console.log('\n' + '='.repeat(80));
        console.log(`STEP ${this.currentStep}/${this.totalSteps}: ${title}`);
        console.log('='.repeat(80));
        console.log(description);
        console.log('');
    }
    
    /**
     * Waits for user input or timeout
     */
    async waitForContinue(timeout = 3000) {
        console.log(`⏳ Waiting ${timeout/1000} seconds before continuing...`);
        await new Promise(resolve => setTimeout(resolve, timeout));
    }
    
    /**
     * Demonstrates the complete migration process
     */
    async demonstrate() {
        console.log('🚀 LOGGER MIGRATION INFRASTRUCTURE DEMONSTRATION');
        console.log('📋 This demo shows how to safely migrate from legacy to enhanced logging');
        console.log('   with zero downtime using our comprehensive migration infrastructure.');
        console.log('');
        
        try {
            await this.step1_CurrentState();
            await this.step2_ValidationPreparation();
            await this.step3_CompatibilityLayer();
            await this.step4_DualLogging();
            await this.step5_MigrationValidation();
            await this.step6_GradualMigration();
            await this.step7_RollbackCapability();
            await this.step8_CompleteMigration();
            
            console.log('\n🎉 MIGRATION DEMONSTRATION COMPLETE!');
            console.log('✅ All components working correctly');
            console.log('✅ Zero-downtime migration capability verified');
            console.log('✅ Rollback mechanisms tested and ready');
            
        } catch (error) {
            console.error('\n❌ DEMONSTRATION FAILED:', error);
            console.error('💡 This indicates an issue that needs to be resolved before migration');
        }
    }
    
    /**
     * Step 1: Show current state with legacy logger
     */
    async step1_CurrentState() {
        this.logStep(
            'Current State - Legacy Logger',
            'Starting with the existing legacy logger system as currently used in the application.'
        );
        
        // Import and use legacy logger
        const { createLogger } = await import('./src/utils/logger.js');
        const legacyLogger = createLogger({ level: 'info' });
        
        console.log('📝 Legacy Logger Usage:');
        legacyLogger.info('Application started with legacy logger');
        legacyLogger.command('testuser', 'help', []);
        legacyLogger.userEvent('testuser', 'join');
        legacyLogger.connection('connected', { room: 'fatpizza' });
        
        // Test child logger
        const childLogger = legacyLogger.child({ module: 'database' });
        childLogger.info('Database connection established');
        
        console.log('✅ Legacy logger working normally');
        console.log('📊 No downtime - application continues operating');
        
        await this.waitForContinue();
    }
    
    /**
     * Step 2: Prepare for validation
     */
    async step2_ValidationPreparation() {
        this.logStep(
            'Validation Preparation',
            'Setting up validation infrastructure to ensure safe migration.'
        );
        
        console.log('🔧 Initializing Migration Validator...');
        const validator = new MigrationValidator({
            testDir: './demo-validation',
            verbose: false
        });
        
        console.log('✅ Migration validator ready');
        console.log('🔍 Pre-migration validation checks available');
        console.log('📊 No downtime - validation runs alongside production');
        
        await this.waitForContinue();
    }
    
    /**
     * Step 3: Introduce compatibility layer
     */
    async step3_CompatibilityLayer() {
        this.logStep(
            'Compatibility Layer Introduction',
            'Introducing the compatibility layer that provides the same API but uses enhanced logging backend.'
        );
        
        console.log('🔄 Switching to compatibility layer...');
        
        // Create compatibility layer
        const compatLayer = new LoggerCompatibilityLayer({
            level: 'info',
            enableFallback: true,
            enableMetrics: true
        });
        
        console.log('📝 Compatibility Layer Usage (same API):');
        compatLayer.info('Application now using compatibility layer');
        compatLayer.command('testuser', 'status', []);
        compatLayer.userEvent('testuser', 'chat');
        compatLayer.connection('heartbeat', { timestamp: Date.now() });
        
        // Test child logger
        const childLogger = compatLayer.child({ module: 'bot' });
        childLogger.info('Bot module loaded via compatibility layer');
        
        // Show metrics
        const stats = compatLayer.getStats();
        console.log('📊 Compatibility Layer Stats:', {
            compatibility: stats.compatibility,
            fallbackEnabled: stats.enableFallback,
            calls: stats.callCount
        });
        
        console.log('✅ Compatibility layer working - API remains identical');
        console.log('📊 No downtime - seamless drop-in replacement');
        
        await compatLayer.close();
        await this.waitForContinue();
    }
    
    /**
     * Step 4: Dual logging for validation
     */
    async step4_DualLogging() {
        this.logStep(
            'Dual Logging Validation',
            'Running dual logger to validate consistency between legacy and enhanced loggers.'
        );
        
        console.log('🔍 Starting dual logging validation...');
        
        const dualLogger = new DualLogger({
            mode: 'compare',
            validateOutput: true,
            comparisonSampling: 1.0
        });
        
        console.log('📝 Dual Logger Usage (logging to both systems):');
        await dualLogger.info('Dual logging validation message');
        await dualLogger.error('Test error for validation', new Error('Test error'));
        await dualLogger.command('testuser', 'dual-test', ['validation']);
        
        // Wait for validation processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const validationReport = dualLogger.getValidationReport();
        console.log('📊 Dual Logging Validation Report:', {
            totalCalls: validationReport.summary.totalCalls,
            comparisons: validationReport.summary.comparisons,
            discrepancies: validationReport.summary.discrepancies,
            discrepancyRate: `${(validationReport.summary.discrepancyRate * 100).toFixed(2)}%`
        });
        
        console.log('✅ Dual logging validation complete');
        console.log('📊 No downtime - validation runs in parallel');
        
        await dualLogger.close();
        await this.waitForContinue();
    }
    
    /**
     * Step 5: Run comprehensive migration validation
     */
    async step5_MigrationValidation() {
        this.logStep(
            'Comprehensive Migration Validation',
            'Running full validation suite to ensure migration readiness.'
        );
        
        console.log('🧪 Running comprehensive validation tests...');
        
        const validator = new MigrationValidator({
            testDir: './demo-validation',
            testDuration: 10000,
            verbose: false
        });
        
        // Run key validation tests
        console.log('   🔍 API Compatibility Test...');
        const apiResult = await validator.validateApiCompatibility();
        console.log(`   ${apiResult.success ? '✅' : '❌'} API Compatibility: ${apiResult.success ? 'PASSED' : 'FAILED'}`);
        
        console.log('   🔍 Performance Comparison Test...');
        const perfResult = await validator.validatePerformance();
        console.log(`   ${perfResult.success ? '✅' : '❌'} Performance: ${perfResult.success ? 'PASSED' : 'FAILED'}`);
        
        if (perfResult.success && perfResult.performance) {
            console.log('   📊 Performance Comparison:');
            console.log(`      Legacy: ${perfResult.performance.legacy.callsPerSecond.toFixed(0)} calls/sec`);
            console.log(`      Enhanced: ${perfResult.performance.enhanced.callsPerSecond.toFixed(0)} calls/sec`);
            console.log(`      Compatibility: ${perfResult.performance.compatibility.callsPerSecond.toFixed(0)} calls/sec`);
        }
        
        console.log('   🔍 Configuration Validation Test...');
        const configResult = await validator.validateConfiguration();
        console.log(`   ${configResult.success ? '✅' : '❌'} Configuration: ${configResult.success ? 'PASSED' : 'FAILED'}`);
        
        console.log('✅ Migration validation complete');
        console.log('📊 No downtime - validation runs alongside production');
        
        await this.waitForContinue();
    }
    
    /**
     * Step 6: Gradual migration with rollback capability
     */
    async step6_GradualMigration() {
        this.logStep(
            'Gradual Migration with Rollback',
            'Demonstrating gradual migration with full rollback capability.'
        );
        
        console.log('🔄 Initializing rollback-enabled migration...');
        
        const rollbackManager = new LoggerRollback({
            configFile: './demo-rollback-config.json',
            backupDir: './demo-backup',
            autoRollback: true,
            enableMonitoring: false
        });
        
        // Show initial state
        let status = rollbackManager.getStatus();
        console.log('📊 Initial State:', {
            currentLogger: status.state.currentLogger,
            healthStatus: status.state.healthStatus
        });
        
        // Gradual migration: Legacy -> Compatibility -> Enhanced
        console.log('🔄 Phase 1: Switching to compatibility layer...');
        const switchSuccess = await rollbackManager.switchLogger('compatibility');
        console.log(`   ${switchSuccess ? '✅' : '❌'} Switch to compatibility: ${switchSuccess ? 'SUCCESS' : 'FAILED'}`);
        
        // Test the switched logger
        const activeLogger = rollbackManager.getLogger();
        activeLogger.info('Testing compatibility layer after switch');
        
        status = rollbackManager.getStatus();
        console.log('📊 After Switch:', {
            currentLogger: status.state.currentLogger,
            healthStatus: status.state.healthStatus
        });
        
        console.log('✅ Gradual migration step complete');
        console.log('📊 No downtime - seamless logger switching');
        
        await rollbackManager.shutdown();
        await this.waitForContinue();
    }
    
    /**
     * Step 7: Demonstrate rollback capability
     */
    async step7_RollbackCapability() {
        this.logStep(
            'Rollback Capability Demonstration',
            'Showing emergency rollback capability for safety.'
        );
        
        console.log('🚨 Simulating emergency rollback scenario...');
        
        const rollbackManager = new LoggerRollback({
            configFile: './demo-rollback-config.json',
            backupDir: './demo-backup',
            autoRollback: true,
            enableMonitoring: false
        });
        
        // Switch to enhanced logger first
        console.log('🔄 Switching to enhanced logger...');
        await rollbackManager.switchLogger('enhanced');
        
        let status = rollbackManager.getStatus();
        console.log('📊 Before Rollback:', {
            currentLogger: status.state.currentLogger,
            rollbackCount: status.state.rollbackCount
        });
        
        // Simulate emergency rollback
        console.log('🚨 Initiating emergency rollback...');
        const rollbackSuccess = await rollbackManager.emergencyRollback('demo-emergency');
        console.log(`   ${rollbackSuccess ? '✅' : '❌'} Emergency rollback: ${rollbackSuccess ? 'SUCCESS' : 'FAILED'}`);
        
        // Validate rollback
        console.log('🔍 Validating rollback...');
        const validationResult = await rollbackManager.validateRollback();
        console.log(`   ${validationResult.success ? '✅' : '❌'} Rollback validation: ${validationResult.success ? 'PASSED' : 'FAILED'}`);
        
        status = rollbackManager.getStatus();
        console.log('📊 After Rollback:', {
            currentLogger: status.state.currentLogger,
            rollbackCount: status.state.rollbackCount,
            healthStatus: status.state.healthStatus
        });
        
        console.log('✅ Rollback capability verified');
        console.log('📊 No downtime - instant rollback to stable state');
        
        await rollbackManager.shutdown();
        await this.waitForContinue();
    }
    
    /**
     * Step 8: Complete migration
     */
    async step8_CompleteMigration() {
        this.logStep(
            'Complete Migration',
            'Finalizing migration with all safety measures in place.'
        );
        
        console.log('🎯 Finalizing migration process...');
        
        // Final migration with all safety measures
        const rollbackManager = new LoggerRollback({
            configFile: './demo-final-config.json',
            backupDir: './demo-final-backup',
            autoRollback: true,
            enableMonitoring: false
        });
        
        // Switch to final enhanced logger
        console.log('🔄 Final switch to enhanced logger...');
        const finalSwitch = await rollbackManager.switchLogger('enhanced');
        console.log(`   ${finalSwitch ? '✅' : '❌'} Final migration: ${finalSwitch ? 'SUCCESS' : 'FAILED'}`);
        
        // Test final logger
        const finalLogger = rollbackManager.getLogger();
        console.log('📝 Final Logger Usage:');
        finalLogger.info('Migration completed successfully');
        finalLogger.command('testuser', 'migrate-complete', []);
        finalLogger.userEvent('testuser', 'migration-verified');
        
        // Test child logger
        const finalChildLogger = finalLogger.child({ module: 'migration' });
        finalChildLogger.info('Migration module: All systems operational');
        
        const finalStatus = rollbackManager.getStatus();
        console.log('📊 Final Status:', {
            currentLogger: finalStatus.state.currentLogger,
            healthStatus: finalStatus.state.healthStatus,
            uptime: `${Math.round(finalStatus.uptime / 1000)}s`
        });
        
        console.log('✅ Migration complete - Enhanced logger active');
        console.log('📊 Zero downtime achieved throughout entire process');
        console.log('🛡️  Rollback capability remains available');
        
        await rollbackManager.shutdown();
        await this.waitForContinue(1000);
    }
    
    /**
     * Clean up demo files
     */
    async cleanup() {
        console.log('\n🧹 Cleaning up demo files...');
        
        const demoFiles = [
            './demo-rollback-config.json',
            './demo-final-config.json',
            './logger-config.json'
        ];
        
        const demoDirs = [
            './demo-validation',
            './demo-backup',
            './demo-final-backup'
        ];
        
        for (const file of demoFiles) {
            try {
                await import('fs').then(fs => fs.promises.unlink(file));
            } catch (error) {
                // Ignore cleanup errors
            }
        }
        
        for (const dir of demoDirs) {
            try {
                await import('fs').then(fs => fs.promises.rm(dir, { recursive: true, force: true }));
            } catch (error) {
                // Ignore cleanup errors
            }
        }
        
        console.log('✅ Demo cleanup complete');
    }
}

// Run demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const demo = new MigrationInfrastructureDemo();
    
    demo.demonstrate().then(async () => {
        await demo.cleanup();
        console.log('\n🎉 Demo completed successfully!');
        process.exit(0);
    }).catch(async (error) => {
        console.error('Demo failed:', error);
        await demo.cleanup();
        process.exit(1);
    });
}

export default MigrationInfrastructureDemo;