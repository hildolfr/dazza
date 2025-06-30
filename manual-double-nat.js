import natUpnp from 'nat-upnp';
import os from 'os';

console.log('Setting up manual double NAT configuration...\n');

async function setupDoubleNat() {
    const localIp = '192.168.68.85';
    const routerExternalIp = '192.168.254.10';
    const port = 3001;
    
    // Step 1: Configure router
    console.log('=== Step 1: Configure Router ===');
    console.log(`Mapping ${localIp}:${port} → Router External:${port}`);
    
    const routerClient = natUpnp.createClient();
    
    try {
        await new Promise((resolve, reject) => {
            routerClient.portMapping({
                public: port,
                private: port,
                protocol: 'tcp',
                description: 'Dazza Bot Manual',
                ttl: 0
            }, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('✓ Router configured successfully');
    } catch (e) {
        console.log('✗ Router configuration failed:', e.message);
    }
    routerClient.close();
    
    // Step 2: Configure modem with explicit private host
    console.log('\n=== Step 2: Configure Modem ===');
    console.log(`Mapping Modem External:${port} → ${routerExternalIp}:${port}`);
    
    const modemClient = natUpnp.createClient({ gateway: '192.168.254.254' });
    
    // Try different approaches
    const attempts = [
        {
            name: 'With private host',
            mapping: {
                public: port,
                private: {
                    host: routerExternalIp,
                    port: port
                },
                protocol: 'tcp',
                description: 'Dazza Bot Manual',
                ttl: 0
            }
        },
        {
            name: 'With client parameter',
            mapping: {
                public: port,
                private: port,
                protocol: 'tcp',
                description: 'Dazza Bot Manual',
                ttl: 0,
                client: routerExternalIp
            }
        }
    ];
    
    for (const attempt of attempts) {
        console.log(`\nAttempting: ${attempt.name}`);
        try {
            await new Promise((resolve, reject) => {
                modemClient.portMapping(attempt.mapping, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            console.log('✓ Modem configured successfully!');
            break;
        } catch (e) {
            console.log('✗ Failed:', e.message);
            
            // Try to remove any partial mapping
            try {
                await new Promise((resolve) => {
                    modemClient.portUnmapping({
                        public: port,
                        protocol: 'tcp'
                    }, () => resolve());
                });
            } catch (e2) {
                // Ignore cleanup errors
            }
        }
    }
    
    modemClient.close();
    
    // Verify mappings
    console.log('\n=== Verifying Mappings ===');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const verifyRouter = natUpnp.createClient();
    verifyRouter.getMappings((err, mappings) => {
        if (!err) {
            console.log('\nRouter mappings:');
            mappings.forEach(m => {
                if (m.public.port === port) {
                    console.log(`  ${m.public.host || 'any'}:${m.public.port} → ${m.private.host}:${m.private.port}`);
                }
            });
        }
        verifyRouter.close();
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const verifyModem = natUpnp.createClient({ gateway: '192.168.254.254' });
    verifyModem.getMappings((err, mappings) => {
        if (!err) {
            console.log('\nModem mappings:');
            mappings.forEach(m => {
                if (m.public.port === port) {
                    console.log(`  ${m.public.host || 'any'}:${m.public.port} → ${m.private.host}:${m.private.port}`);
                }
            });
        }
        verifyModem.close();
    });
}

setupDoubleNat().catch(console.error);