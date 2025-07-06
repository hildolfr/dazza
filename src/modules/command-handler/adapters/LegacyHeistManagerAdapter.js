/**
 * Legacy HeistManager Adapter - Provides backward compatibility for economy commands
 * This adapter wraps the new modular heist/economy services to provide the legacy interface
 * that existing commands expect (bot.heistManager.getUserBalance(), etc.)
 */
class LegacyHeistManagerAdapter {
    constructor(services) {
        this.services = services;
        this.heistService = services.get('heist');
        this.databaseService = services.get('database');
        this.economySystemService = services.get('economySystem');
        this.logger = null;
    }
    
    setLogger(logger) {
        this.logger = logger;
    }
    
    // ===== User Balance Methods =====
    
    async getUserBalance(username) {
        if (!this.heistService && !this.economySystemService) {
            throw new Error('Heist or economy system service not available');
        }
        
        // Try heist service first, fall back to economy system service
        if (this.heistService) {
            return await this.heistService.getUserBalance(username);
        } else if (this.economySystemService) {
            // Use the economy system service's heist manager
            const heistManager = this.economySystemService.getHeistManager();
            if (heistManager) {
                return await heistManager.getUserBalance(username);
            } else {
                throw new Error('HeistManager not available from economy system');
            }
        } else {
            throw new Error('No economy services available');
        }
    }
    
    async updateUserBalance(username, amount) {
        if (!this.heistService && !this.economySystemService) {
            throw new Error('Heist or economy system service not available');
        }
        
        if (this.heistService) {
            return await this.heistService.updateUserBalance(username, amount);
        } else if (this.economySystemService) {
            const heistManager = this.economySystemService.getHeistManager();
            if (heistManager) {
                return await heistManager.updateUserBalance(username, amount);
            } else {
                throw new Error('HeistManager not available from economy system');
            }
        } else {
            throw new Error('No economy services available');
        }
    }
    
    async transferBalance(fromUser, toUser, amount) {
        if (!this.heistService && !this.economySystemService) {
            throw new Error('Heist or economy system service not available');
        }
        
        if (this.heistService) {
            return await this.heistService.transferBalance(fromUser, toUser, amount);
        } else if (this.economySystemService) {
            const heistManager = this.economySystemService.getHeistManager();
            if (heistManager) {
                return await heistManager.transferBalance(fromUser, toUser, amount);
            } else {
                throw new Error('HeistManager not available from economy system');
            }
        } else {
            throw new Error('No economy services available');
        }
    }
    
    // ===== Heist Methods =====
    
    async startHeist(roomId, options = {}) {
        if (!this.heistService) {
            throw new Error('Heist service not available');
        }
        
        return await this.heistService.startHeist(roomId, options);
    }
    
    async joinHeist(roomId, username, bet = 0) {
        if (!this.heistService) {
            throw new Error('Heist service not available');
        }
        
        return await this.heistService.joinHeist(roomId, username, bet);
    }
    
    async getHeistStatus(roomId) {
        if (!this.heistService) {
            throw new Error('Heist service not available');
        }
        
        return await this.heistService.getHeistStatus(roomId);
    }
    
    async advanceHeist(roomId) {
        if (!this.heistService) {
            throw new Error('Heist service not available');
        }
        
        return await this.heistService.advanceHeist(roomId);
    }
    
    async forceHeist(roomId, options = {}) {
        if (!this.heistService) {
            throw new Error('Heist service not available');
        }
        
        return await this.heistService.forceHeist(roomId, options);
    }
    
    // ===== Trust System Methods =====
    
    async getUserTrust(username) {
        if (!this.heistService && !this.economySystemService) {
            throw new Error('Heist or economy system service not available');
        }
        
        if (this.heistService) {
            return await this.heistService.getUserTrust(username);
        } else if (this.economySystemService) {
            const heistManager = this.economySystemService.getHeistManager();
            if (heistManager) {
                return await heistManager.getUserTrust(username);
            } else {
                throw new Error('HeistManager not available from economy system');
            }
        } else {
            throw new Error('No economy services available');
        }
    }
    
    async updateUserTrust(username, amount) {
        if (!this.heistService && !this.economySystemService) {
            throw new Error('Heist or economy system service not available');
        }
        
        if (this.heistService) {
            return await this.heistService.updateUserTrust(username, amount);
        } else if (this.economySystemService) {
            const heistManager = this.economySystemService.getHeistManager();
            if (heistManager) {
                return await heistManager.updateUserTrust(username, amount);
            } else {
                throw new Error('HeistManager not available from economy system');
            }
        } else {
            throw new Error('No economy services available');
        }
    }
    
    // ===== Utility Methods =====
    
    isReady() {
        return !!(this.heistService || this.economySystemService);
    }
    
    // ===== Fallback Methods =====
    
    // If heist service is not available, provide basic economy functionality
    async _createBasicEconomyUser(username) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        const economyService = this.databaseService.getEconomyService();
        return await economyService.createUser(username);
    }
}

export default LegacyHeistManagerAdapter;