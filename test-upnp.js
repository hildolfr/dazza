#!/usr/bin/env node

import { UpnpManager } from './src/services/upnpManager.js';

console.log('🔌 Testing UPnP Port Forwarding...\n');

const manager = new UpnpManager({
    info: (msg) => console.log('[INFO]', msg),
    warn: (msg) => console.log('[WARN]', msg),
    error: (msg) => console.log('[ERROR]', msg),
    debug: (msg) => console.log('[DEBUG]', msg)
});

async function test() {
    try {
        console.log('1️⃣ Getting external IP...');
        const externalIp = await manager.getExternalIp();
        console.log(`   External IP: ${externalIp}\n`);
        
        console.log('2️⃣ Attempting to create port mapping for 3001...');
        const result = await manager.setupApiPort(3001);
        console.log(`   Success! Port mapping created`);
        console.log(`   Internal: ${result.internal}`);
        console.log(`   External: ${result.external}\n`);
        
        console.log('3️⃣ Checking current mappings...');
        const mappings = await manager.getMappings();
        console.log(`   Found ${mappings.length} total mappings`);
        
        const ourMapping = mappings.find(m => m.public.port === '3001');
        if (ourMapping) {
            console.log(`   ✅ Our mapping found:`);
            console.log(`      ${ourMapping.public.host}:${ourMapping.public.port} → ${ourMapping.private.host}:${ourMapping.private.port}`);
            console.log(`      Description: ${ourMapping.description}`);
        }
        
        console.log('\n4️⃣ Waiting 10 seconds before cleanup...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        console.log('5️⃣ Removing port mapping...');
        await manager.cleanup();
        console.log('   ✅ Cleanup complete');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('\nTroubleshooting:');
        console.error('1. Check if UPnP is enabled in your router settings');
        console.error('2. Make sure your router supports UPnP');
        console.error('3. Check if another device already has this port mapped');
        console.error('4. Try a different port number');
    }
    
    process.exit(0);
}

test();