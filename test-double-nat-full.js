import natUpnp from 'nat-upnp';
import os from 'os';

console.log('Testing full double NAT port forwarding...\n');

// Get local IP
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

async function setupDoubleNatPortForwarding(port = 3001) {
    const localIp = getLocalIp();
    console.log(`Local IP: ${localIp}`);
    
    // Layer 1: Local router
    console.log('\n=== Layer 1: Router Configuration ===');
    const routerClient = natUpnp.createClient();
    
    try {
        // Get router's external IP
        const routerExternal = await new Promise((resolve, reject) => {
            routerClient.externalIp((err, ip) => {
                if (err) reject(err);
                else resolve(ip);
            });
        });
        console.log(`Router external IP: ${routerExternal}`);
        
        // Map port on router
        const routerMapping = {
            public: port,
            private: port,
            protocol: 'tcp',
            description: 'Dazza Bot Test',
            ttl: 0
        };
        
        await new Promise((resolve, reject) => {
            routerClient.portMapping(routerMapping, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log(`✓ Router mapped: ${localIp}:${port} → ${routerExternal}:${port}`);
        
        // Layer 2: Modem
        console.log('\n=== Layer 2: Modem Configuration ===');
        
        // Create client for modem (with custom gateway)
        const modemClient = natUpnp.createClient({
            gateway: '192.168.254.254'
        });
        
        try {
            // Get modem's external IP
            const modemExternal = await new Promise((resolve, reject) => {
                modemClient.externalIp((err, ip) => {
                    if (err) reject(err);
                    else resolve(ip);
                });
            });
            console.log(`Modem external IP: ${modemExternal}`);
            
            // Try to map port on modem
            // This maps from modem's external interface to the router's IP
            const modemMapping = {
                public: port,
                private: port,
                protocol: 'tcp',
                description: 'Dazza Bot Test',
                ttl: 0,
                // Some UPnP implementations need the client IP specified
                client: routerExternal
            };
            
            await new Promise((resolve, reject) => {
                modemClient.portMapping(modemMapping, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            console.log(`✓ Modem mapped: ${modemExternal}:${port} → ${routerExternal}:${port}`);
            
            console.log('\n✅ Double NAT port forwarding configured successfully!');
            console.log(`External access should be available at: ${modemExternal}:${port}`);
            
        } catch (error) {
            console.log(`✗ Modem mapping failed: ${error.message}`);
            console.log('\nThis might be because:');
            console.log('1. The modem restricts UPnP access from double-NAT devices');
            console.log('2. The modem requires authentication for UPnP');
            console.log('3. Port forwarding might already exist');
        } finally {
            modemClient.close();
        }
        
    } catch (error) {
        console.log(`✗ Router mapping failed: ${error.message}`);
    } finally {
        routerClient.close();
    }
}

// Cleanup function
async function cleanupMappings(port = 3001) {
    console.log('\n=== Cleaning up port mappings ===');
    
    // Clean router
    const routerClient = natUpnp.createClient();
    try {
        await new Promise((resolve) => {
            routerClient.portUnmapping({
                public: port,
                protocol: 'tcp'
            }, () => resolve());
        });
        console.log('✓ Router mapping removed');
    } catch (e) {
        console.log('Router cleanup failed:', e.message);
    }
    routerClient.close();
    
    // Clean modem
    const modemClient = natUpnp.createClient({ gateway: '192.168.254.254' });
    try {
        await new Promise((resolve) => {
            modemClient.portUnmapping({
                public: port,
                protocol: 'tcp'
            }, () => resolve());
        });
        console.log('✓ Modem mapping removed');
    } catch (e) {
        console.log('Modem cleanup failed:', e.message);
    }
    modemClient.close();
}

// Run the test
(async () => {
    try {
        await setupDoubleNatPortForwarding();
        
        console.log('\nPress Ctrl+C to cleanup and exit...');
        
        // Cleanup on exit
        process.on('SIGINT', async () => {
            await cleanupMappings();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('Error:', error);
    }
})();