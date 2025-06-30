#!/usr/bin/env node

import { DoubleNatUpnpManager } from './src/services/doubleNatUpnp.js';

console.log('🔌 Testing Double NAT UPnP Configuration...\n');

const manager = new DoubleNatUpnpManager({
    info: (msg) => console.log('[INFO]', msg),
    warn: (msg) => console.log('[WARN]', msg),
    error: (msg) => console.log('[ERROR]', msg),
    debug: (msg) => console.log('[DEBUG]', msg)
});

async function test() {
    try {
        console.log('1️⃣ Detecting NAT layers...');
        const status = await manager.getStatus();
        
        console.log(`\n📊 NAT Configuration:`);
        console.log(`   NAT Layers: ${status.natLayers}`);
        console.log(`   Double NAT: ${status.isDoubleNat ? 'YES ⚠️' : 'NO ✅'}`);
        console.log(`   Real External IP: ${status.realExternalIp}`);
        
        console.log(`\n🔍 Layer Details:`);
        status.layers.forEach(layer => {
            console.log(`   Layer ${layer.layer}: ${layer.internal} → ${layer.external} (${layer.isPrivate ? 'Private' : 'Public'})`);
        });
        
        if (status.isDoubleNat) {
            console.log(`\n⚠️  DOUBLE NAT DETECTED!`);
            console.log(`   Your setup: PC → Router → Modem → Internet`);
        }
        
        console.log(`\n2️⃣ Attempting to setup port forwarding for port 3001...`);
        const result = await manager.setupApiPort(3001);
        
        console.log(`\n📝 Results:`);
        result.mappings.forEach(mapping => {
            if (mapping.success) {
                console.log(`   ✅ Layer ${mapping.layer}: ${mapping.internal} → ${mapping.external}`);
            } else if (mapping.manual) {
                console.log(`   ❌ Layer ${mapping.layer}: Manual configuration required`);
                console.log(`      ${mapping.instruction}`);
            } else {
                console.log(`   ❌ Layer ${mapping.layer}: Failed - ${mapping.error}`);
            }
        });
        
        if (result.isDoubleNat) {
            console.log(`\n📋 Manual Configuration Required:`);
            console.log(`   1. Access your modem (usually at 192.168.254.1)`);
            console.log(`   2. Find port forwarding settings`);
            console.log(`   3. Add rule: External:3001 → ${result.mappings[0].external}`);
            console.log(`   4. Your API will be accessible at: http://${result.realExternalIp}:3001`);
        } else {
            console.log(`\n✅ Port forwarding complete!`);
            console.log(`   API accessible at: http://${result.realExternalIp}:3001`);
        }
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
    } finally {
        await manager.cleanup();
    }
    
    process.exit(0);
}

test();