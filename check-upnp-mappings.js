import natUpnp from 'nat-upnp';

console.log('Checking UPnP port mappings...\n');

// Check router mappings
const routerClient = natUpnp.createClient();

console.log('=== Router Mappings ===');
routerClient.getMappings((err, mappings) => {
    if (err) {
        console.error('Error getting router mappings:', err.message);
    } else {
        console.log('Active mappings:', mappings.length);
        mappings.forEach(mapping => {
            if (mapping.public.port === 3001 || mapping.private.port === 3001) {
                console.log(`Found: ${mapping.public.host || 'any'}:${mapping.public.port} → ${mapping.private.host}:${mapping.private.port} (${mapping.protocol})`);
                console.log(`  Description: ${mapping.description}`);
                console.log(`  TTL: ${mapping.ttl}`);
            }
        });
    }
    routerClient.close();
    
    // Check modem mappings
    console.log('\n=== Modem Mappings ===');
    const modemClient = natUpnp.createClient({ gateway: '192.168.254.254' });
    
    modemClient.getMappings((err, mappings) => {
        if (err) {
            console.error('Error getting modem mappings:', err.message);
        } else {
            console.log('Active mappings:', mappings.length);
            mappings.forEach(mapping => {
                if (mapping.public.port === 3001 || mapping.private.port === 3001) {
                    console.log(`Found: ${mapping.public.host || 'any'}:${mapping.public.port} → ${mapping.private.host}:${mapping.private.port} (${mapping.protocol})`);
                    console.log(`  Description: ${mapping.description}`);
                    console.log(`  TTL: ${mapping.ttl}`);
                }
            });
        }
        modemClient.close();
    });
});