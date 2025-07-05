#!/usr/bin/env node
import { CyTubeBot } from './src/core/bot.js';
import config from './src/config/index.js';
import { createLogger } from './src/utils/logger.js';

async function testLegacyBotIntegration() {
    console.log('🧪 Testing Legacy Bot Module Integration');
    console.log('=======================================');
    
    let bot = null;
    const results = {
        moduleLoading: { passed: 0, failed: 0, details: [] },
        serviceRegistration: { passed: 0, failed: 0, details: [] },
        functionality: { passed: 0, failed: 0, details: [] },
        performance: { passed: 0, failed: 0, details: [] }
    };
    
    try {
        // 1. Test Configuration and Initialization
        console.log('\n⚙️ Loading configuration...');
        // Config is already imported
        
        // Override some settings for testing
        config.cytube = { channel: 'test' };
        config.bot = { username: 'TestBot', password: null };
        config.batch = { runOnStartup: false };
        config.api = { port: 3003 };
        
        console.log('✅ Configuration loaded');
        
        // 2. Test Bot Initialization
        console.log('\n🤖 Initializing bot...');
        const startTime = Date.now();
        
        bot = new CyTubeBot(config);
        
        // Mock the connection to avoid network calls
        bot.connection.connect = async () => {
            console.log('📡 Mock connection established');
        };
        bot.connection.joinChannel = async () => {
            console.log('🚪 Mock channel join');
        };
        bot.connection.login = async () => {
            console.log('🔐 Mock login');
        };
        
        // Initialize without network connection
        try {
            await bot.init();
            console.log('✅ Bot initialized successfully');
            
            const initTime = Date.now() - startTime;
            console.log(`⏱️ Initialization time: ${initTime}ms`);
            
            results.moduleLoading.passed++;
            results.moduleLoading.details.push(`✅ Bot initialized in ${initTime}ms`);
            
            if (initTime < 3000) {
                results.performance.passed++;
                results.performance.details.push(`✅ Fast initialization: ${initTime}ms`);
            } else {
                results.performance.failed++;
                results.performance.details.push(`❌ Slow initialization: ${initTime}ms`);
            }
        } catch (error) {
            console.error('❌ Bot initialization failed:', error.message);
            results.moduleLoading.failed++;
            results.moduleLoading.details.push(`❌ Initialization failed: ${error.message}`);
            return; // Can't continue without initialization
        }
        
        // 3. Test Service Registration
        console.log('\n🔧 Testing Service Registration...');
        const expectedServices = ['database'];
        const modulesLoaded = bot.modules.size;
        const servicesLoaded = bot.services.size;
        
        console.log(`📊 Modules loaded: ${modulesLoaded}`);
        console.log(`📊 Services loaded: ${servicesLoaded}`);
        
        for (const serviceName of expectedServices) {
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
        
        // Test available services
        const availableServices = Array.from(bot.services.keys());
        console.log(`📋 Available services: ${availableServices.join(', ')}`);
        
        if (availableServices.length > 0) {
            results.serviceRegistration.passed++;
            results.serviceRegistration.details.push(`✅ Services available: ${availableServices.length}`);
        } else {
            results.serviceRegistration.failed++;
            results.serviceRegistration.details.push('❌ No services available');
        }
        
        // 4. Test Module Functionality
        console.log('\n🧩 Testing Module Functionality...');
        
        // Test database
        if (bot.db) {
            try {
                await bot.db.get('SELECT COUNT(*) as count FROM user_stats');
                results.functionality.passed++;
                results.functionality.details.push('✅ Database: Query execution works');
                console.log('✅ Database functional');
            } catch (error) {
                results.functionality.failed++;
                results.functionality.details.push(`❌ Database: Query failed - ${error.message}`);
                console.log('❌ Database query failed:', error.message);
            }
        } else {
            results.functionality.failed++;
            results.functionality.details.push('❌ Database: Not available');
            console.log('❌ Database not available');
        }
        
        // Test userlist functionality (from user-management module)
        try {
            const userlist = bot.getUserlist();
            if (userlist instanceof Map) {
                results.functionality.passed++;
                results.functionality.details.push('✅ User Management: getUserlist() works');
                console.log('✅ getUserlist() functional');
            } else {
                results.functionality.failed++;
                results.functionality.details.push('❌ User Management: getUserlist() wrong type');
                console.log('❌ getUserlist() wrong type');
            }
        } catch (error) {
            results.functionality.failed++;
            results.functionality.details.push(`❌ User Management: getUserlist() error - ${error.message}`);
            console.log('❌ getUserlist() error:', error.message);
        }
        
        // Test AFK functionality
        try {
            const afkUsers = bot.getAFKUsers();
            if (Array.isArray(afkUsers)) {
                results.functionality.passed++;
                results.functionality.details.push('✅ User Management: getAFKUsers() works');
                console.log('✅ getAFKUsers() functional');
            } else {
                results.functionality.failed++;
                results.functionality.details.push('❌ User Management: getAFKUsers() wrong type');
                console.log('❌ getAFKUsers() wrong type');
            }
        } catch (error) {
            results.functionality.failed++;
            results.functionality.details.push(`❌ User Management: getAFKUsers() error - ${error.message}`);
            console.log('❌ getAFKUsers() error:', error.message);
        }
        
        // Test EventBus
        console.log('\n🚌 Testing EventBus...');
        let eventReceived = false;
        bot.eventBus.on('test:event', () => {
            eventReceived = true;
        });
        
        bot.eventBus.emit('test:event');
        
        if (eventReceived) {
            results.functionality.passed++;
            results.functionality.details.push('✅ EventBus: Event handling works');
            console.log('✅ EventBus functional');
        } else {
            results.functionality.failed++;
            results.functionality.details.push('❌ EventBus: Event handling failed');
            console.log('❌ EventBus failed');
        }
        
        // 5. Test Memory Usage
        console.log('\n🧠 Testing Memory Usage...');
        const memoryUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        const rssMB = Math.round(memoryUsage.rss / 1024 / 1024);
        
        console.log(`📊 Heap used: ${heapUsedMB}MB`);
        console.log(`📊 RSS: ${rssMB}MB`);
        
        if (heapUsedMB < 150) {
            results.performance.passed++;
            results.performance.details.push(`✅ Memory usage acceptable: ${heapUsedMB}MB heap`);
        } else {
            results.performance.failed++;
            results.performance.details.push(`❌ Memory usage high: ${heapUsedMB}MB heap`);
        }
        
        // 6. Test Module Integration
        console.log('\n🔗 Testing Module Integration...');
        
        // Test that services can communicate
        let serviceIntegrationWorking = true;
        const services = bot.services;
        
        // Check if services reference each other properly
        for (const [name, service] of services.entries()) {
            if (service && typeof service === 'object') {
                console.log(`✅ Service ${name} is properly instantiated`);
            } else {
                console.log(`❌ Service ${name} is not properly instantiated`);
                serviceIntegrationWorking = false;
            }
        }
        
        if (serviceIntegrationWorking && services.size > 0) {
            results.functionality.passed++;
            results.functionality.details.push('✅ Module Integration: Services properly instantiated');
        } else {
            results.functionality.failed++;
            results.functionality.details.push('❌ Module Integration: Service instantiation issues');
        }
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        console.error('Stack:', error.stack);
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
    
    // 7. Print Results
    console.log('\n📋 Test Results Summary');
    console.log('=======================');
    
    const categories = [
        { name: 'Module Loading', key: 'moduleLoading' },
        { name: 'Service Registration', key: 'serviceRegistration' },
        { name: 'Functionality', key: 'functionality' },
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
testLegacyBotIntegration().catch((error) => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
});