import natUpnp from 'nat-upnp';
import os from 'os';

export class UpnpManager {
    constructor(logger) {
        this.logger = logger;
        this.client = natUpnp.createClient();
        this.mappings = new Map();
        this.externalIp = null;
        this.internalIp = null;
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

    // Get external IP from router
    async getExternalIp() {
        return new Promise((resolve, reject) => {
            this.client.externalIp((err, ip) => {
                if (err) {
                    this.logger.error('[UPnP] Failed to get external IP:', err.message);
                    reject(err);
                } else {
                    this.externalIp = ip;
                    this.logger.info(`[UPnP] External IP: ${ip}`);
                    resolve(ip);
                }
            });
        });
    }

    // Create port mapping
    async createPortMapping(port, description = 'Dazza Bot API') {
        this.internalIp = this.getLocalIp();
        
        return new Promise((resolve, reject) => {
            const mapping = {
                public: port,
                private: port,
                protocol: 'tcp',
                description: description,
                ttl: 0 // Permanent mapping (until router restart or manual removal)
            };

            this.logger.info(`[UPnP] Creating port mapping: ${this.internalIp}:${port} → *:${port}`);

            this.client.portMapping(mapping, (err) => {
                if (err) {
                    this.logger.error(`[UPnP] Failed to create port mapping:`, err.message);
                    
                    // Try to provide helpful error messages
                    if (err.message.includes('disabled')) {
                        this.logger.error('[UPnP] UPnP appears to be disabled on your router');
                        this.logger.error('[UPnP] Enable it in your router settings (usually under Advanced → UPnP)');
                    } else if (err.message.includes('conflict')) {
                        this.logger.error('[UPnP] Port already mapped, trying to remove and recreate...');
                        // Try to remove and recreate
                        this.removePortMapping(port).then(() => {
                            this.createPortMapping(port, description).then(resolve).catch(reject);
                        }).catch(reject);
                        return;
                    }
                    
                    reject(err);
                } else {
                    this.logger.info(`[UPnP] ✅ Successfully mapped port ${port}`);
                    this.mappings.set(port, mapping);
                    resolve({
                        success: true,
                        internal: `${this.internalIp}:${port}`,
                        external: `${this.externalIp || 'unknown'}:${port}`
                    });
                }
            });
        });
    }

    // Remove port mapping
    async removePortMapping(port) {
        return new Promise((resolve, reject) => {
            const mapping = {
                public: port,
                protocol: 'tcp'
            };

            this.logger.info(`[UPnP] Removing port mapping for port ${port}`);

            this.client.portUnmapping(mapping, (err) => {
                if (err) {
                    this.logger.warn(`[UPnP] Failed to remove port mapping:`, err.message);
                    // Don't reject, as the mapping might not exist
                    resolve(false);
                } else {
                    this.logger.info(`[UPnP] Removed port mapping for port ${port}`);
                    this.mappings.delete(port);
                    resolve(true);
                }
            });
        });
    }

    // Get current port mappings
    async getMappings() {
        return new Promise((resolve, reject) => {
            this.client.getMappings((err, mappings) => {
                if (err) {
                    this.logger.error('[UPnP] Failed to get mappings:', err.message);
                    reject(err);
                } else {
                    resolve(mappings);
                }
            });
        });
    }

    // Setup API port with retry logic
    async setupApiPort(port = 3001, maxRetries = 3) {
        this.logger.info('[UPnP] Starting UPnP port forwarding setup...');
        
        let lastError = null;
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                // First, try to get external IP
                try {
                    await this.getExternalIp();
                } catch (ipError) {
                    this.logger.warn('[UPnP] Could not get external IP, continuing anyway...');
                }
                
                // Try to create port mapping
                const result = await this.createPortMapping(port, 'Dazza Bot API Server');
                
                this.logger.info('[UPnP] Port forwarding setup complete!');
                this.logger.info(`[UPnP] API should be accessible at: http://${this.externalIp || 'your-external-ip'}:${port}`);
                
                return result;
                
            } catch (error) {
                lastError = error;
                this.logger.warn(`[UPnP] Attempt ${i + 1} failed: ${error.message}`);
                
                if (i < maxRetries - 1) {
                    this.logger.info(`[UPnP] Retrying in 5 seconds...`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
        }
        
        this.logger.error('[UPnP] All attempts failed. Manual port forwarding required.');
        throw lastError;
    }

    // Cleanup all mappings
    async cleanup() {
        this.logger.info('[UPnP] Cleaning up port mappings...');
        
        for (const [port, mapping] of this.mappings) {
            try {
                await this.removePortMapping(port);
            } catch (error) {
                this.logger.warn(`[UPnP] Failed to remove mapping for port ${port}:`, error.message);
            }
        }
        
        this.mappings.clear();
        
        // Close the client
        if (this.client) {
            this.client.close();
        }
    }

    // Get status information
    getStatus() {
        return {
            enabled: true,
            externalIp: this.externalIp,
            internalIp: this.internalIp,
            mappings: Array.from(this.mappings.entries()).map(([port, mapping]) => ({
                port,
                protocol: mapping.protocol,
                description: mapping.description
            }))
        };
    }
}