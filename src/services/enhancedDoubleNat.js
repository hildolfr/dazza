import natUpnp from 'nat-upnp';
import os from 'os';
import fetch from 'node-fetch';

export class EnhancedDoubleNatManager {
    constructor(logger) {
        this.logger = logger;
        this.routerClient = null;
        this.modemClient = null;
        this.mappings = [];
    }

    getLocalIp() {
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

    isPrivateIp(ip) {
        const parts = ip.split('.').map(Number);
        return (
            (parts[0] === 10) ||
            (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
            (parts[0] === 192 && parts[1] === 168)
        );
    }

    async getRealExternalIp() {
        try {
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

    async setupCompletePortForwarding(port = 3001) {
        const localIp = this.getLocalIp();
        const realExternalIp = await this.getRealExternalIp();
        
        this.logger.info(`[DoubleNAT] Local IP: ${localIp}`);
        this.logger.info(`[DoubleNAT] Real external IP: ${realExternalIp}`);
        
        const results = {
            success: false,
            layers: [],
            realExternalIp,
            instructions: []
        };

        try {
            // Layer 1: Configure router
            this.routerClient = natUpnp.createClient();
            
            const routerExternal = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
                this.routerClient.externalIp((err, ip) => {
                    clearTimeout(timeout);
                    if (err) reject(err);
                    else resolve(ip);
                });
            });
            
            this.logger.info(`[DoubleNAT] Router external IP: ${routerExternal}`);
            
            // Map port on router
            await new Promise((resolve, reject) => {
                this.routerClient.portMapping({
                    public: port,
                    private: port,
                    protocol: 'tcp',
                    description: 'Dazza Bot API',
                    ttl: 0
                }, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            this.logger.info(`[DoubleNAT] ✅ Layer 1 (Router): ${localIp}:${port} → ${routerExternal}:${port}`);
            results.layers.push({
                name: 'Router',
                success: true,
                mapping: `${localIp}:${port} → ${routerExternal}:${port}`
            });

            // Layer 2: Try to configure modem
            if (this.isPrivateIp(routerExternal)) {
                const modemIp = process.env.MODEM_IP || '192.168.254.254';
                this.logger.info(`[DoubleNAT] Attempting modem configuration at ${modemIp}`);
                
                this.modemClient = natUpnp.createClient({ gateway: modemIp });
                
                try {
                    const modemExternal = await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
                        this.modemClient.externalIp((err, ip) => {
                            clearTimeout(timeout);
                            if (err) reject(err);
                            else resolve(ip);
                        });
                    });
                    
                    this.logger.info(`[DoubleNAT] Modem reports external IP: ${modemExternal}`);
                    
                    // Try to create mapping
                    await new Promise((resolve, reject) => {
                        this.modemClient.portMapping({
                            public: port,
                            private: port,
                            protocol: 'tcp',
                            description: 'Dazza Bot API',
                            ttl: 0,
                            client: routerExternal // Specify the router's IP
                        }, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                    
                    this.logger.info(`[DoubleNAT] ✅ Layer 2 (Modem): External:${port} → ${routerExternal}:${port}`);
                    results.layers.push({
                        name: 'Modem',
                        success: true,
                        mapping: `External:${port} → ${routerExternal}:${port}`
                    });
                    results.success = true;
                    
                } catch (error) {
                    this.logger.warn(`[DoubleNAT] ❌ Layer 2 (Modem) failed: ${error.message}`);
                    results.layers.push({
                        name: 'Modem',
                        success: false,
                        error: error.message
                    });
                    
                    // Provide manual instructions
                    results.instructions.push(`Manual configuration needed on modem (${modemIp}):`);
                    results.instructions.push(`1. Access modem admin panel at http://${modemIp}/`);
                    results.instructions.push(`2. Find Port Forwarding or Virtual Server settings`);
                    results.instructions.push(`3. Create rule: External Port ${port} → ${routerExternal}:${port}`);
                    results.instructions.push(`4. Your service will be accessible at ${realExternalIp}:${port}`);
                }
            } else {
                // Single NAT
                results.success = true;
                this.logger.info('[DoubleNAT] Single NAT detected - configuration complete');
            }
            
        } catch (error) {
            this.logger.error(`[DoubleNAT] Router configuration failed: ${error.message}`);
            results.layers.push({
                name: 'Router',
                success: false,
                error: error.message
            });
        }
        
        return results;
    }

    async cleanup() {
        this.logger.info('[DoubleNAT] Cleaning up port mappings...');
        
        if (this.routerClient) {
            try {
                this.routerClient.close();
            } catch (e) {
                this.logger.debug('Router client cleanup error:', e.message);
            }
        }
        
        if (this.modemClient) {
            try {
                this.modemClient.close();
            } catch (e) {
                this.logger.debug('Modem client cleanup error:', e.message);
            }
        }
    }

    async getStatus() {
        const localIp = this.getLocalIp();
        const realExternalIp = await this.getRealExternalIp();
        const status = {
            localIp,
            realExternalIp,
            layers: []
        };

        try {
            // Check router
            const routerClient = natUpnp.createClient();
            const routerExternal = await new Promise((resolve) => {
                const timeout = setTimeout(() => resolve(null), 3000);
                routerClient.externalIp((err, ip) => {
                    clearTimeout(timeout);
                    resolve(err ? null : ip);
                });
            });
            routerClient.close();
            
            if (routerExternal) {
                status.layers.push({
                    name: 'Router',
                    internal: localIp,
                    external: routerExternal,
                    isPrivate: this.isPrivateIp(routerExternal)
                });
                
                // Check modem if router has private IP
                if (this.isPrivateIp(routerExternal)) {
                    const modemIp = process.env.MODEM_IP || '192.168.254.254';
                    const modemClient = natUpnp.createClient({ gateway: modemIp });
                    
                    const modemExternal = await new Promise((resolve) => {
                        const timeout = setTimeout(() => resolve(null), 3000);
                        modemClient.externalIp((err, ip) => {
                            clearTimeout(timeout);
                            resolve(err ? null : ip);
                        });
                    });
                    modemClient.close();
                    
                    if (modemExternal) {
                        status.layers.push({
                            name: 'Modem',
                            internal: routerExternal,
                            external: modemExternal,
                            isPrivate: this.isPrivateIp(modemExternal)
                        });
                    }
                }
            }
        } catch (error) {
            this.logger.error('Status check failed:', error.message);
        }
        
        status.isDoubleNat = status.layers.length > 1;
        return status;
    }
}