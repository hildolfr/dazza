#!/usr/bin/env node

import fetch from 'node-fetch';
import { execSync } from 'child_process';

const API_DOMAIN = 'seg.tplinkdns.com';
const API_PORT = 3001;
const API_BASE = `http://${API_DOMAIN}:${API_PORT}`;

console.log('🔍 API Server Connectivity Check\n');
console.log(`Domain: ${API_DOMAIN}`);
console.log(`Port: ${API_PORT}`);
console.log(`Full URL: ${API_BASE}\n`);

// Check DNS resolution
console.log('1️⃣ Checking DNS resolution...');
try {
    const dnsResult = execSync(`nslookup ${API_DOMAIN}`, { encoding: 'utf8' });
    const ipMatch = dnsResult.match(/Address: ([\d.]+)/);
    if (ipMatch) {
        console.log(`✅ Domain resolves to: ${ipMatch[1]}`);
    } else {
        console.log('❌ Could not resolve domain');
    }
} catch (error) {
    console.log('❌ DNS lookup failed:', error.message);
}

// Check local API server
console.log('\n2️⃣ Checking local API server...');
try {
    const localResponse = await fetch('http://localhost:3001/api/v1/health', { timeout: 5000 });
    if (localResponse.ok) {
        const data = await localResponse.json();
        console.log('✅ Local API server is running');
        console.log('   Response:', JSON.stringify(data, null, 2));
    } else {
        console.log(`⚠️ Local API returned status: ${localResponse.status}`);
    }
} catch (error) {
    console.log('❌ Local API server is not accessible:', error.message);
    console.log('   Make sure the bot is running!');
}

// Check port status
console.log('\n3️⃣ Checking port status...');
try {
    const output = execSync('netstat -tuln | grep 3001 || ss -tuln | grep 3001', { encoding: 'utf8' });
    if (output.includes('LISTEN')) {
        console.log('✅ Port 3001 is listening locally');
        console.log('   ', output.trim());
    } else {
        console.log('❌ Port 3001 is not listening');
    }
} catch (error) {
    console.log('⚠️ Could not check port status');
}

// Check firewall
console.log('\n4️⃣ Checking firewall status...');
try {
    const ufwStatus = execSync('sudo ufw status 2>/dev/null || echo "UFW not found"', { encoding: 'utf8' });
    if (ufwStatus.includes('Status: active')) {
        console.log('⚠️ UFW firewall is active');
        if (ufwStatus.includes('3001')) {
            console.log('✅ Port 3001 appears to be allowed in UFW');
        } else {
            console.log('❌ Port 3001 might be blocked by UFW');
            console.log('   To allow: sudo ufw allow 3001');
        }
    } else if (ufwStatus.includes('inactive')) {
        console.log('✅ UFW firewall is inactive');
    } else {
        console.log('   UFW not found or not accessible');
    }
} catch (error) {
    console.log('   Could not check firewall status');
}

// Test external connectivity
console.log('\n5️⃣ Testing external connectivity...');
console.log('   Note: This will fail if port forwarding is not set up');
try {
    const response = await fetch(`${API_BASE}/api/v1/health`, { timeout: 10000 });
    if (response.ok) {
        const data = await response.json();
        console.log('✅ External API access successful!');
        console.log('   Response:', JSON.stringify(data, null, 2));
    } else {
        console.log(`❌ External API returned status: ${response.status}`);
    }
} catch (error) {
    console.log('❌ External API not accessible:', error.message);
}

console.log('\n📋 Setup Checklist:');
console.log('1. ✓ Start the bot: npm start');
console.log('2. ✓ Check firewall: sudo ufw allow 3001');
console.log('3. ✓ Router port forwarding: Forward external port 3001 to internal IP:3001');
console.log('4. ✓ Dynamic DNS: Ensure seg.tplinkdns.com points to your current IP');
console.log('5. ✓ ISP restrictions: Some ISPs block incoming connections');

console.log('\n🔧 Router Port Forwarding:');
console.log('1. Log into your TP-Link router (usually 192.168.1.1)');
console.log('2. Go to Advanced → NAT Forwarding → Port Forwarding');
console.log('3. Add new rule:');
console.log('   - Service Name: Dazza API');
console.log('   - External Port: 3001');
console.log('   - Internal IP: [Your machine\'s local IP]');
console.log('   - Internal Port: 3001');
console.log('   - Protocol: TCP');
console.log('4. Save and reboot router if needed');

// Get local IP
try {
    const localIP = execSync("hostname -I | awk '{print $1}'", { encoding: 'utf8' }).trim();
    console.log(`\n💡 Your local IP appears to be: ${localIP}`);
} catch (error) {
    console.log('\n💡 To find your local IP: ip addr show or ifconfig');
}