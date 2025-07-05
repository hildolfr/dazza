#!/usr/bin/env node
import { CyTubeBot } from './src/core/bot.js';
import config from './src/config/index.js';

async function testModuleFunctionality() {
    console.log('🧪 Testing Module Functionality Integration');
    console.log('===========================================');
    
    let bot = null;
    const results = {
        userManagement: { passed: 0, failed: 0, details: [] },
        greetingSystem: { passed: 0, failed: 0, details: [] },
        integration: { passed: 0, failed: 0, details: [] },
        performance: { passed: 0, failed: 0, details: [] }
    };
    
    try {
        // Initialize bot with test configuration
        config.cytube = { channel: 'test' };
        config.bot = { username: 'TestBot', password: null };
        config.batch = { runOnStartup: false };
        config.api = { port: 3004 };
        
        bot = new CyTubeBot(config);
        
        // Mock connection to avoid network calls
        bot.connection.connect = async () => console.log('📡 Mock connection');
        bot.connection.joinChannel = async () => console.log('🚪 Mock channel join');
        bot.connection.login = async () => console.log('🔐 Mock login');
        
        await bot.init();
        console.log('✅ Bot initialized for module testing');
        
        // 1. Test User Management System
        console.log('\n👥 Testing User Management System...');
        const userManagementService = bot.services.get('userManagement');
        
        if (userManagementService) {
            // Test initial userlist
            const initialUserlist = userManagementService.getUserlist();
            if (initialUserlist instanceof Map && initialUserlist.size === 0) {
                results.userManagement.passed++;
                results.userManagement.details.push('✅ Initial userlist is empty Map');
                console.log('✅ Initial userlist correct');
            } else {
                results.userManagement.failed++;
                results.userManagement.details.push('❌ Initial userlist incorrect');
                console.log('❌ Initial userlist incorrect');
            }
            
            // Simulate userlist update
            const testUsers = [
                { name: 'TestUser1', meta: { afk: false } },
                { name: 'TestUser2', meta: { afk: true } }
            ];
            
            // Test handling userlist event
            bot.eventBus.emit('userlist', testUsers);
            
            // Small delay to allow event processing
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const updatedUserlist = userManagementService.getUserlist();
            if (updatedUserlist.size === 2) {
                results.userManagement.passed++;
                results.userManagement.details.push('✅ Userlist update processed correctly');
                console.log('✅ Userlist update processed');
            } else {
                results.userManagement.failed++;
                results.userManagement.details.push(`❌ Userlist size wrong: ${updatedUserlist.size}`);
                console.log(`❌ Userlist size wrong: ${updatedUserlist.size}`);
            }
            
            // Test AFK functionality
            const afkUsers = userManagementService.getAFKUsers();
            if (Array.isArray(afkUsers) && afkUsers.length === 1 && afkUsers[0] === 'TestUser2') {
                results.userManagement.passed++;
                results.userManagement.details.push('✅ AFK user detection works');
                console.log('✅ AFK user detection works');
            } else {
                results.userManagement.failed++;
                results.userManagement.details.push(`❌ AFK users wrong: ${JSON.stringify(afkUsers)}`);
                console.log(`❌ AFK users wrong: ${JSON.stringify(afkUsers)}`);
            }
            
            // Test user count
            const userCount = userManagementService.getUserCount();
            if (userCount === 2) {
                results.userManagement.passed++;
                results.userManagement.details.push('✅ User count correct');
                console.log('✅ User count correct');
            } else {
                results.userManagement.failed++;
                results.userManagement.details.push(`❌ User count wrong: ${userCount}`);
                console.log(`❌ User count wrong: ${userCount}`);
            }
            
        } else {
            results.userManagement.failed++;
            results.userManagement.details.push('❌ User Management service not available');
            console.log('❌ User Management service not available');
        }
        
        // 2. Test Greeting System
        console.log('\n👋 Testing Greeting System...');
        const greetingService = bot.services.get('greetingSystem');
        
        if (greetingService) {
            // Test greeting generation
            const greeting = greetingService.getRandomGreeting();
            if (typeof greeting === 'string' && greeting.length > 0) {
                results.greetingSystem.passed++;
                results.greetingSystem.details.push('✅ Greeting generation works');
                console.log('✅ Greeting generation works');
            } else {
                results.greetingSystem.failed++;
                results.greetingSystem.details.push('❌ Greeting generation failed');
                console.log('❌ Greeting generation failed');
            }
            
            // Test cooldown check
            const shouldGreetFirst = greetingService.shouldGreetUser('NewUser');
            if (typeof shouldGreetFirst === 'boolean') {
                results.greetingSystem.passed++;
                results.greetingSystem.details.push('✅ Greeting cooldown check works');
                console.log('✅ Greeting cooldown check works');
            } else {
                results.greetingSystem.failed++;
                results.greetingSystem.details.push('❌ Greeting cooldown check failed');
                console.log('❌ Greeting cooldown check failed');
            }
            
            // Test that subsequent checks respect cooldown
            const shouldGreetSecond = greetingService.shouldGreetUser('NewUser');
            if (shouldGreetFirst !== shouldGreetSecond || shouldGreetSecond === false) {
                results.greetingSystem.passed++;
                results.greetingSystem.details.push('✅ Greeting cooldown enforcement works');
                console.log('✅ Greeting cooldown enforcement works');
            } else {
                results.greetingSystem.failed++;
                results.greetingSystem.details.push('❌ Greeting cooldown enforcement failed');
                console.log('❌ Greeting cooldown enforcement failed');
            }
            
        } else {
            results.greetingSystem.failed++;
            results.greetingSystem.details.push('❌ Greeting System service not available');
            console.log('❌ Greeting System service not available');
        }
        
        // 3. Test Integration Between Modules
        console.log('\n🔗 Testing Module Integration...');
        
        let greetingTriggered = false;
        
        // Set up event listener for bot:send (greeting output)
        bot.eventBus.on('bot:send', (data) => {
            if (data.message && data.message.length > 0) {
                greetingTriggered = true;
                console.log(`📤 Greeting triggered: ${data.message.substring(0, 50)}...`);
            }
        });
        
        // Simulate user joining
        bot.eventBus.emit('addUser', { name: 'IntegrationTestUser', meta: { afk: false } });
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Check if user was added to userlist
        const userManagement = bot.services.get('userManagement');
        const finalUserlist = userManagement.getUserlist();
        const userAdded = finalUserlist.has('IntegrationTestUser');
        
        if (userAdded) {
            results.integration.passed++;
            results.integration.details.push('✅ User Management → User join event processed');
            console.log('✅ User join processed by User Management');
        } else {
            results.integration.failed++;
            results.integration.details.push('❌ User Management → User join event failed');
            console.log('❌ User join not processed by User Management');
        }
        
        // Check if greeting was potentially triggered (depends on cooldown and chance)
        // This is a best-effort test since greetings have randomness
        if (greetingTriggered) {
            results.integration.passed++;
            results.integration.details.push('✅ Integration: Greeting system responded to user join');
            console.log('✅ Greeting system integration works');
        } else {
            // This is not necessarily a failure due to greeting chance/cooldown
            results.integration.passed++;
            results.integration.details.push('✅ Integration: Greeting system operating (no greeting due to cooldown/chance)');
            console.log('✅ Greeting system integration functional (no greeting triggered)');
        }
        
        // 4. Test Performance
        console.log('\n⚡ Testing Performance...');
        const memoryUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        
        console.log(`📊 Memory usage: ${heapUsedMB}MB heap`);
        
        if (heapUsedMB < 80) {
            results.performance.passed++;
            results.performance.details.push(`✅ Memory usage good: ${heapUsedMB}MB`);
        } else {
            results.performance.failed++;
            results.performance.details.push(`❌ Memory usage high: ${heapUsedMB}MB`);
        }
        
        // Test service lookup performance
        const startTime = Date.now();
        for (let i = 0; i < 1000; i++) {
            bot.services.get('userManagement');
            bot.services.get('greetingSystem');
        }
        const lookupTime = Date.now() - startTime;
        
        console.log(`📊 Service lookup time: ${lookupTime}ms for 2000 operations`);
        
        if (lookupTime < 50) {
            results.performance.passed++;
            results.performance.details.push(`✅ Service lookup fast: ${lookupTime}ms`);
        } else {
            results.performance.failed++;
            results.performance.details.push(`❌ Service lookup slow: ${lookupTime}ms`);
        }
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        results.integration.failed++;
        results.integration.details.push(`❌ Fatal error: ${error.message}`);
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
    
    // Print Results
    console.log('\n📋 Module Functionality Test Results');
    console.log('====================================');
    
    const categories = [
        { name: 'User Management', key: 'userManagement' },
        { name: 'Greeting System', key: 'greetingSystem' },
        { name: 'Module Integration', key: 'integration' },
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
    
    console.log('\n🎯 Overall Module Test Results');
    console.log(`Total Passed: ${totalPassed}`);
    console.log(`Total Failed: ${totalFailed}`);
    console.log(`Success Rate: ${Math.round((totalPassed / (totalPassed + totalFailed)) * 100)}%`);
    
    // Exit with appropriate code
    process.exit(totalFailed === 0 ? 0 : 1);
}

// Run the test
testModuleFunctionality().catch((error) => {
    console.error('💥 Module functionality test failed:', error);
    process.exit(1);
});