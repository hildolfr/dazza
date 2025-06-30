import natUpnp from 'nat-upnp';
import os from 'os';
import fetch from 'node-fetch';

export class DoubleNatUpnpManager {
    constructor(logger) {
        this.logger = logger;
        this.clients = [];
        this.mappings = [];
        this.externalIps = [];
    }

    // Get the machine's local IP address
    getLocalIp() {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                // Skip loopback and non-IPv4 addresses
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
        return '127.0.0.1';
    }

    // Check if an IP is private
    isPrivateIp(ip) {
        const parts = ip.split('.').map(Number);
        return (
            (parts[0] === 10) || // 10.0.0.0/8
            (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
            (parts[0] === 192 && parts[1] === 168) // 192.168.0.0/16
        );
    }

    // Get real external IP from external service
    async getRealExternalIp() {
        try {
            // Create an AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch('https://api.ipify.org?format=json', { 
                signal: controller.signal 
            });
            clearTimeout(timeoutId);
            
            const data = await response.json();
            return data.ip;
        } catch (error) {
            this.logger.warn('[DoubleNAT] Failed to get real external IP:', error.message);
            return null;
        }
    }

    // Detect all NAT layers
    async detectNatLayers() {
        const layers = [];
        let currentClient = natUpnp.createClient();
        this.clients.push(currentClient);
        
        try {
            // First layer (immediate router)
            const firstExternal = await new Promise((resolve, reject) => {
                currentClient.externalIp((err, ip) => {
                    if (err) reject(err);
                    else resolve(ip);
                });
            });
            
            layers.push({
                client: currentClient,
                internalIp: this.getLocalIp(),
                externalIp: firstExternal,
                isPrivate: this.isPrivateIp(firstExternal)
            });
            
            this.logger.info(`[DoubleNAT] Layer 1: ${this.getLocalIp()} → ${firstExternal} (${this.isPrivateIp(firstExternal) ? 'Private' : 'Public'})`);
            
            // If first external is private, we likely have double NAT
            if (this.isPrivateIp(firstExternal)) {
                this.logger.info('[DoubleNAT] Detected double NAT configuration');
                
                // Try to create a client for the second layer
                // This is tricky - we need to use the gateway of the first router
                // Allow override via environment variable, otherwise use common defaults
                const modemIp = process.env.MODEM_IP || '192.168.254.254';
                this.logger.info(`[DoubleNAT] Attempting to connect to upstream router at ${modemIp}`);
                
                // Get real external IP
                const realExternal = await this.getRealExternalIp();
                if (realExternal) {
                    layers.push({
                        client: null, // We can't directly control the upstream router via UPnP from here
                        internalIp: firstExternal,
                        externalIp: realExternal,
                        isPrivate: false,
                        isEstimated: true
                    });
                    this.logger.info(`[DoubleNAT] Layer 2 (estimated): ${firstExternal} → ${realExternal} (Public)`);
                }
            }
            
        } catch (error) {
            this.logger.error('[DoubleNAT] Failed to detect NAT layers:', error.message);
        }
        
        return layers;
    }

    // Create port mapping through all layers
    async createMultiLayerMapping(port, description = 'Dazza Bot API') {
        const layers = await this.detectNatLayers();
        
        if (layers.length === 0) {
            throw new Error('No NAT layers detected');
        }
        
        const results = [];
        
        // Map through first layer (we can control this)
        const firstLayer = layers[0];
        if (firstLayer.client) {
            try {
                const mapping = {
                    public: port,
                    private: port,
                    protocol: 'tcp',
                    description: description,
                    ttl: 0
                };
                
                await new Promise((resolve, reject) => {
                    firstLayer.client.portMapping(mapping, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                
                results.push({
                    layer: 1,
                    success: true,
                    internal: `${firstLayer.internalIp}:${port}`,
                    external: `${firstLayer.externalIp}:${port}`
                });
                
                this.logger.info(`[DoubleNAT] ✅ Layer 1 mapped: ${firstLayer.internalIp}:${port} → ${firstLayer.externalIp}:${port}`);
                
            } catch (error) {
                this.logger.error(`[DoubleNAT] Layer 1 mapping failed:`, error.message);
                results.push({
                    layer: 1,
                    success: false,
                    error: error.message
                });
            }
        }
        
        // For double NAT, we need manual configuration or special handling
        if (layers.length > 1 && layers[1].isEstimated) {
            this.logger.warn('[DoubleNAT] ⚠️  Second NAT layer detected but cannot be automatically configured');
            this.logger.warn(`[DoubleNAT] You need to manually forward port ${port} on your modem:`);
            this.logger.warn(`[DoubleNAT] Modem: External:${port} → ${layers[0].externalIp}:${port}`);
            
            results.push({
                layer: 2,
                success: false,
                manual: true,
                instruction: `Forward external:${port} → ${layers[0].externalIp}:${port} on your modem`
            });
        }
        
        return {
            layers: layers.length,
            isDoubleNat: layers.length > 1,
            realExternalIp: layers[layers.length - 1].externalIp,
            mappings: results
        };
    }

    // Alternative: Try to use UPnP-IGD on the modem through HTTP
    async tryModemUPnP(modemIp = process.env.MODEM_IP || '192.168.254.254') {
        // Skip modem UPnP discovery for now - it's causing hangs
        this.logger.debug(`[DoubleNAT] Skipping modem UPnP discovery (not implemented)`);
        return false;
        
        /* Disabled due to hanging issues
        this.logger.info(`[DoubleNAT] Attempting to discover UPnP on modem at ${modemIp}`);
        
        try {
            // Try common UPnP discovery URLs
            const urls = [
                `http://${modemIp}:5000/rootDesc.xml`,
                `http://${modemIp}:49152/rootDesc.xml`,
                `http://${modemIp}:49153/rootDesc.xml`,
                `http://${modemIp}:49154/rootDesc.xml`,
                `http://${modemIp}:2869/rootDesc.xml`
            ];
            
            for (const url of urls) {
                try {
                    const response = await fetch(url, { timeout: 2000 });
                    if (response.ok) {
                        this.logger.info(`[DoubleNAT] Found UPnP endpoint at ${url}`);
                        // Would need to parse XML and send SOAP requests
                        // This is complex and device-specific
                        return true;
                    }
                } catch (e) {
                    // Continue trying other ports
                }
            }
            
        } catch (error) {
            this.logger.debug(`[DoubleNAT] Modem UPnP discovery failed:`, error.message);
        }
        
        return false;
        */
    }

    // Setup with double NAT awareness
    async setupApiPort(port = 3001, maxRetries = 3) {
        this.logger.info('[DoubleNAT] Starting double NAT aware UPnP setup...');
        
        try {
            const result = await this.createMultiLayerMapping(port);
            
            if (result.isDoubleNat) {
                this.logger.warn('[DoubleNAT] ⚠️  DOUBLE NAT DETECTED ⚠️');
                this.logger.warn('[DoubleNAT] Port forwarding partially configured');
                this.logger.warn('[DoubleNAT] Manual modem configuration required for full external access');
                
                // Try modem UPnP as last resort
                const modemUpnp = await this.tryModemUPnP();
                if (modemUpnp) {
                    this.logger.info('[DoubleNAT] Modem appears to support UPnP, but automatic configuration not implemented');
                }
            } else {
                this.logger.info('[DoubleNAT] ✅ Single NAT - Port forwarding complete!');
            }
            
            return result;
            
        } catch (error) {
            this.logger.error('[DoubleNAT] Setup failed:', error.message);
            throw error;
        }
    }

    // Cleanup all mappings
    async cleanup() {
        this.logger.info('[DoubleNAT] Cleaning up port mappings...');
        
        for (const client of this.clients) {
            if (client) {
                try {
                    client.close();
                } catch (error) {
                    this.logger.debug('Failed to close client:', error.message);
                }
            }
        }
        
        this.clients = [];
    }

    // Get comprehensive status
    async getStatus() {
        const layers = await this.detectNatLayers();
        const realIp = await this.getRealExternalIp();
        
        return {
            enabled: true,
            natLayers: layers.length,
            isDoubleNat: layers.length > 1,
            layers: layers.map((l, i) => ({
                layer: i + 1,
                internal: l.internalIp,
                external: l.externalIp,
                isPrivate: l.isPrivate
            })),
            realExternalIp: realIp,
            recommendation: layers.length > 1 
                ? 'Manual modem configuration required for full external access'
                : 'Single NAT - automatic configuration should work'
        };
    }
}