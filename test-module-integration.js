#!/usr/bin/env node
import { MultiRoomBot } from './src/core/MultiRoomBot.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const testConfig = {
    rooms: {
        fatpizza: {
            enabled: true,
            channel: 'fatpizza',
            features: {
                greetings: true,
                userTracking: true,
                reminderSystem: true,
                tellSystem: true,
                memoryManagement: true
            }
        }
    },
    database: {
        path: './cytube_stats_modular.db'
    },
    logging: {
        level: 'debug',
        console: true
    },
    bot: {
        username: 'TestBot',
        password: null
    },
    batch: {
        runOnStartup: false
    },
    api: {
        port: 3002
    }
};

async function testModuleIntegration() {
    console.log('🧪 Starting Module Integration Test');
    console.log('=====================================');
    
    let bot = null;
    const results = {
        moduleLoading: { passed: 0, failed: 0, details: [] },
        serviceRegistration: { passed: 0, failed: 0, details: [] },
        functionality: { passed: 0, failed: 0, details: [] },
        integration: { passed: 0, failed: 0, details: [] },
        performance: { passed: 0, failed: 0, details: [] }
    };
    
    try {
        // 1. Test Module Loading
        console.log('\n📦 Testing Module Loading...');
        const startTime = Date.now();
        
        bot = new MultiRoomBot(testConfig);
        await bot.init();
        
        const initTime = Date.now() - startTime;
        console.log(`✅ Bot initialized in ${initTime}ms`);
        
        // Check module count
        const moduleCount = bot.moduleRegistry.getModuleCount();
        console.log(`📊 Found ${moduleCount} modules`);
        
        // Expected modules from our analysis
        const expectedModules = [
            'bot-message-tracking',
            'character-personality', 
            'command-handler',
            'connection-handler',
            'cooldown',
            'core-api',
            'core-connection',
            'core-database',
            'greeting-system',
            'memory-management',
            'message-processing',
            'permissions',
            'reminder-system',
            'tell-system',
            'url-comment',
            'user-management'
        ];
        
        if (moduleCount === expectedModules.length) {
            results.moduleLoading.passed++;
            results.moduleLoading.details.push(`✅ Expected ${expectedModules.length} modules, found ${moduleCount}`);
        } else {
            results.moduleLoading.failed++;
            results.moduleLoading.details.push(`❌ Expected ${expectedModules.length} modules, found ${moduleCount}`);
        }
        
        // 2. Test Service Registration
        console.log('\n🔧 Testing Service Registration...');
        const requiredServices = ['database', 'userManagement', 'greetingSystem', 'memoryManagement', 'tellSystem'];
        
        for (const serviceName of requiredServices) {
            const service = bot.services.get(serviceName);
            if (service) {
                results.serviceRegistration.passed++;
                results.serviceRegistration.details.push(`✅ Service registered: ${serviceName}`);
                console.log(`✅ ${serviceName} service registered`);
            } else {
                results.serviceRegistration.failed++;
                results.serviceRegistration.details.push(`❌ Service missing: ${serviceName}`);
                console.log(`❌ ${serviceName} service missing`);
            }
        }
        
        // 3. Test User Management System
        console.log('\n👥 Testing User Management System...');
        const userManagementService = bot.services.get('userManagement');
        
        if (userManagementService) {
            // Test userlist functionality
            const userlist = userManagementService.getUserlist();
            if (userlist instanceof Map) {
                results.functionality.passed++;
                results.functionality.details.push('✅ User Management: getUserlist() returns Map');
                console.log('✅ getUserlist() returns correct type');
            } else {
                results.functionality.failed++;
                results.functionality.details.push('❌ User Management: getUserlist() incorrect type');
                console.log('❌ getUserlist() returns incorrect type');
            }
            
            // Test AFK functionality
            const afkUsers = userManagementService.getAFKUsers();
            if (Array.isArray(afkUsers)) {
                results.functionality.passed++;
                results.functionality.details.push('✅ User Management: getAFKUsers() returns Array');
                console.log('✅ getAFKUsers() returns correct type');
            } else {
                results.functionality.failed++;
                results.functionality.details.push('❌ User Management: getAFKUsers() incorrect type');
                console.log('❌ getAFKUsers() returns incorrect type');
            }
            
            // Test user count
            const userCount = userManagementService.getUserCount();
            if (typeof userCount === 'number') {
                results.functionality.passed++;
                results.functionality.details.push('✅ User Management: getUserCount() returns number');
                console.log('✅ getUserCount() returns correct type');
            } else {
                results.functionality.failed++;
                results.functionality.details.push('❌ User Management: getUserCount() incorrect type');
                console.log('❌ getUserCount() returns incorrect type');
            }
        } else {
            results.functionality.failed++;
            results.functionality.details.push('❌ User Management service not available');
            console.log('❌ User Management service not available');
        }
        
        // 4. Test Greeting System
        console.log('\n👋 Testing Greeting System...');
        const greetingService = bot.services.get('greetingSystem');
        
        if (greetingService) {
            // Test greeting generation
            const greeting = greetingService.getRandomGreeting();
            if (typeof greeting === 'string' && greeting.length > 0) {
                results.functionality.passed++;
                results.functionality.details.push('✅ Greeting System: getRandomGreeting() works');
                console.log('✅ getRandomGreeting() works');
            } else {
                results.functionality.failed++;
                results.functionality.details.push('❌ Greeting System: getRandomGreeting() failed');
                console.log('❌ getRandomGreeting() failed');
            }
            
            // Test cooldown functionality
            const shouldGreet = greetingService.shouldGreetUser('TestUser');
            if (typeof shouldGreet === 'boolean') {
                results.functionality.passed++;
                results.functionality.details.push('✅ Greeting System: shouldGreetUser() works');
                console.log('✅ shouldGreetUser() works');
            } else {
                results.functionality.failed++;
                results.functionality.details.push('❌ Greeting System: shouldGreetUser() failed');
                console.log('❌ shouldGreetUser() failed');
            }
        } else {
            results.functionality.failed++;
            results.functionality.details.push('❌ Greeting System service not available');
            console.log('❌ Greeting System service not available');
        }
        
        // 5. Test Integration Points
        console.log('\n🔗 Testing Integration Points...');
        
        // Test EventBus
        let eventReceived = false;
        bot.eventBus.on('test:event', () => {
            eventReceived = true;
        });
        
        bot.eventBus.emit('test:event');
        
        if (eventReceived) {
            results.integration.passed++;
            results.integration.details.push('✅ EventBus: Event emission/reception works');
            console.log('✅ EventBus works');
        } else {
            results.integration.failed++;
            results.integration.details.push('❌ EventBus: Event emission/reception failed');
            console.log('❌ EventBus failed');
        }
        
        // Test Database service integration
        const dbService = bot.services.get('database');
        if (dbService && typeof dbService.get === 'function') {
            results.integration.passed++;
            results.integration.details.push('✅ Database Service: Available and functional');
            console.log('✅ Database service integrated');
        } else {
            results.integration.failed++;
            results.integration.details.push('❌ Database Service: Not available or non-functional');
            console.log('❌ Database service integration failed');
        }
        
        // 6. Test Memory Management
        console.log('\n🧠 Testing Memory Management...');
        const memoryService = bot.services.get('memoryManagement');
        
        if (memoryService) {
            // Test memory tracking
            const memoryStats = memoryService.getMemoryStats();
            if (memoryStats && typeof memoryStats === 'object') {
                results.functionality.passed++;
                results.functionality.details.push('✅ Memory Management: getMemoryStats() works');
                console.log('✅ Memory stats available');
            } else {
                results.functionality.failed++;
                results.functionality.details.push('❌ Memory Management: getMemoryStats() failed');
                console.log('❌ Memory stats failed');
            }
        } else {
            results.functionality.failed++;
            results.functionality.details.push('❌ Memory Management service not available');
            console.log('❌ Memory Management service not available');
        }
        
        // 7. Performance Testing
        console.log('\n⚡ Testing Performance...');
        const memoryUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        
        console.log(`📊 Memory usage: ${heapUsedMB}MB heap`);
        console.log(`📊 Startup time: ${initTime}ms`);
        
        // Performance thresholds
        if (heapUsedMB < 100) {
            results.performance.passed++;
            results.performance.details.push(`✅ Memory usage acceptable: ${heapUsedMB}MB`);
        } else {
            results.performance.failed++;
            results.performance.details.push(`❌ Memory usage high: ${heapUsedMB}MB`);
        }
        
        if (initTime < 5000) {
            results.performance.passed++;
            results.performance.details.push(`✅ Startup time acceptable: ${initTime}ms`);
        } else {
            results.performance.failed++;
            results.performance.details.push(`❌ Startup time slow: ${initTime}ms`);
        }
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        results.moduleLoading.failed++;
        results.moduleLoading.details.push(`❌ Fatal error: ${error.message}`);
    } finally {
        if (bot) {
            try {
                await bot.shutdown();
                console.log('✅ Bot shutdown completed');
            } catch (error) {
                console.error('❌ Shutdown error:', error.message);
            }
        }
    }
    
    // 8. Print Results
    console.log('\n📋 Test Results Summary');
    console.log('=======================');
    
    const categories = [
        { name: 'Module Loading', key: 'moduleLoading' },
        { name: 'Service Registration', key: 'serviceRegistration' },
        { name: 'Functionality', key: 'functionality' },
        { name: 'Integration', key: 'integration' },
        { name: 'Performance', key: 'performance' }
    ];
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    for (const category of categories) {
        const result = results[category.key];
        totalPassed += result.passed;
        totalFailed += result.failed;
        
        const total = result.passed + result.failed;
        const percentage = total > 0 ? Math.round((result.passed / total) * 100) : 0;
        
        console.log(`\n${category.name}: ${result.passed}/${total} (${percentage}%)`);
        
        // Show details
        for (const detail of result.details) {
            console.log(`  ${detail}`);
        }
    }
    
    console.log('\n🎯 Overall Results');
    console.log(`Total Passed: ${totalPassed}`);
    console.log(`Total Failed: ${totalFailed}`);
    console.log(`Success Rate: ${Math.round((totalPassed / (totalPassed + totalFailed)) * 100)}%`);
    
    // Exit with appropriate code
    process.exit(totalFailed === 0 ? 0 : 1);
}

// Run the test
testModuleIntegration().catch((error) => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
});