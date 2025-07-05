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
        this.logger = null;
    }
    
    setLogger(logger) {
        this.logger = logger;
    }
    
    // ===== User Balance Methods =====
    
    async getUserBalance(username) {
        if (!this.heistService && !this.databaseService) {
            throw new Error('Heist or database service not available');
        }
        
        // Try heist service first, fall back to database service
        if (this.heistService) {
            return await this.heistService.getUserBalance(username);
        } else {
            const economyService = this.databaseService.getEconomyService();
            return await economyService.getUserBalance(username);
        }
    }
    
    async updateUserBalance(username, amount) {
        if (!this.heistService && !this.databaseService) {
            throw new Error('Heist or database service not available');
        }
        
        if (this.heistService) {
            return await this.heistService.updateUserBalance(username, amount);
        } else {
            const economyService = this.databaseService.getEconomyService();
            return await economyService.updateUserBalance(username, amount);
        }
    }
    
    async transferBalance(fromUser, toUser, amount) {
        if (!this.heistService && !this.databaseService) {
            throw new Error('Heist or database service not available');
        }
        
        if (this.heistService) {
            return await this.heistService.transferBalance(fromUser, toUser, amount);
        } else {
            const economyService = this.databaseService.getEconomyService();
            return await economyService.transferBalance(fromUser, toUser, amount);
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
        if (!this.heistService && !this.databaseService) {
            throw new Error('Heist or database service not available');
        }
        
        if (this.heistService) {
            return await this.heistService.getUserTrust(username);
        } else {
            const economyService = this.databaseService.getEconomyService();
            return await economyService.getUserTrust(username);
        }
    }
    
    async updateUserTrust(username, amount) {
        if (!this.heistService && !this.databaseService) {
            throw new Error('Heist or database service not available');
        }
        
        if (this.heistService) {
            return await this.heistService.updateUserTrust(username, amount);
        } else {
            const economyService = this.databaseService.getEconomyService();
            return await economyService.updateUserTrust(username, amount);
        }
    }
    
    // ===== Utility Methods =====
    
    isReady() {
        return !!(this.heistService || this.databaseService);
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