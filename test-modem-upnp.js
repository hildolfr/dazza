import natUpnp from 'nat-upnp';
import fetch from 'node-fetch';

console.log('Testing UPnP discovery on modem at 192.168.254.254...\n');

// Test 1: Try direct HTTP discovery on common UPnP ports
async function testHttpDiscovery() {
    const modemIp = '192.168.254.254';
    const ports = [
        1900,    // Standard UPnP
        2869,    // Alternative UPnP
        5000,    // Common router port
        49152,   // Common dynamic port
        49153,
        49154,
        8080,    // Common web port
        80       // Standard HTTP
    ];
    
    console.log('Testing HTTP endpoints on modem...');
    
    for (const port of ports) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1000);
            
            const response = await fetch(`http://${modemIp}:${port}/`, { 
                signal: controller.signal,
                redirect: 'manual'
            });
            clearTimeout(timeoutId);
            
            if (response.status !== 0) {
                console.log(`✓ Port ${port}: Responded with status ${response.status}`);
                
                // Try UPnP-specific paths
                if (port !== 80) {
                    try {
                        const upnpResponse = await fetch(`http://${modemIp}:${port}/rootDesc.xml`, {
                            signal: controller.signal
                        });
                        if (upnpResponse.ok) {
                            console.log(`  → Found UPnP descriptor at port ${port}!`);
                        }
                    } catch (e) {
                        // Ignore
                    }
                }
            }
        } catch (error) {
            // Port closed or timeout
        }
    }
}

// Test 2: Try to create a UPnP client with custom gateway
async function testCustomGateway() {
    console.log('\nTrying nat-upnp with custom gateway...');
    
    try {
        const client = natUpnp.createClient({
            // Try to force gateway - this might not work with all implementations
            gateway: '192.168.254.254'
        });
        
        const externalIp = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
            client.externalIp((err, ip) => {
                clearTimeout(timeout);
                if (err) reject(err);
                else resolve(ip);
            });
        });
        
        console.log(`✓ Successfully got external IP from modem: ${externalIp}`);
        client.close();
        return true;
    } catch (error) {
        console.log(`✗ Failed to connect via nat-upnp: ${error.message}`);
        return false;
    }
}

// Test 3: Check if we can reach the modem at all
async function testModemReachability() {
    console.log('\nTesting modem reachability...');
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch('http://192.168.254.254/', { 
            signal: controller.signal,
            redirect: 'manual'
        });
        clearTimeout(timeoutId);
        
        if (response.status !== 0) {
            console.log(`✓ Modem is reachable (HTTP status: ${response.status})`);
            return true;
        }
    } catch (error) {
        console.log(`✗ Cannot reach modem: ${error.message}`);
    }
    return false;
}

// Run all tests
async function runTests() {
    await testModemReachability();
    await testHttpDiscovery();
    await testCustomGateway();
    
    console.log('\nNote: Even if UPnP is enabled on the modem, it might not accept');
    console.log('commands from devices behind another NAT for security reasons.');
}

runTests().catch(console.error);