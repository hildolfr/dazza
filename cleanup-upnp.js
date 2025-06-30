import natUpnp from 'nat-upnp';

console.log('Cleaning up UPnP port mappings...\n');

async function cleanupMappings() {
    // Clean router
    console.log('=== Cleaning Router Mappings ===');
    const routerClient = natUpnp.createClient();
    
    try {
        await new Promise((resolve, reject) => {
            routerClient.portUnmapping({
                public: 3001,
                protocol: 'tcp'
            }, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('✓ Router mapping removed');
    } catch (e) {
        console.log('Router cleanup failed:', e.message);
    }
    routerClient.close();
    
    // Clean modem
    console.log('\n=== Cleaning Modem Mappings ===');
    const modemClient = natUpnp.createClient({ gateway: '192.168.254.254' });
    
    try {
        await new Promise((resolve, reject) => {
            modemClient.portUnmapping({
                public: 3001,
                protocol: 'tcp'
            }, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log('✓ Modem mapping removed');
    } catch (e) {
        console.log('Modem cleanup failed:', e.message);
    }
    modemClient.close();
    
    console.log('\nDone!');
}

cleanupMappings().catch(console.error);