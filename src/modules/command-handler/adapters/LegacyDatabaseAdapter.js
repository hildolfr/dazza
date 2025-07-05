/**
 * Legacy Database Adapter - Provides backward compatibility for commands
 * This adapter wraps the new modular database services to provide the legacy interface
 * that existing commands expect (bot.db.getUserStats(), etc.)
 */
class LegacyDatabaseAdapter {
    constructor(services) {
        this.services = services;
        this.databaseService = services.get('database');
        this.logger = null;
    }
    
    setLogger(logger) {
        this.logger = logger;
    }
    
    // ===== User Stats Methods =====
    
    async getUserStats(username, roomId) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        const userService = this.databaseService.getUserService();
        return await userService.getUserStats(username, roomId);
    }
    
    async getUserBongCount(username, roomId) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        const userService = this.databaseService.getUserService();
        return await userService.getUserBongCount(username, roomId);
    }
    
    async logUserBong(username, roomId) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        const userService = this.databaseService.getUserService();
        return await userService.logUserBong(username, roomId);
    }
    
    async incrementBongCount(date, roomId) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        const userService = this.databaseService.getUserService();
        return await userService.incrementBongCount(date, roomId);
    }
    
    async getUserDrinkCount(username, roomId) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        const userService = this.databaseService.getUserService();
        return await userService.getUserDrinkCount(username, roomId);
    }
    
    async logUserDrink(username, roomId) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        const userService = this.databaseService.getUserService();
        return await userService.logUserDrink(username, roomId);
    }
    
    async incrementDrinkCount(date, roomId) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        const userService = this.databaseService.getUserService();
        return await userService.incrementDrinkCount(date, roomId);
    }
    
    // ===== Message Methods =====
    
    async saveMessage(username, message, timestamp = Date.now()) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        const messageService = this.databaseService.getMessageService();
        return await messageService.saveMessage(username, message, timestamp);
    }
    
    async getMessages(options = {}) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        const messageService = this.databaseService.getMessageService();
        return await messageService.getMessages(options);
    }
    
    async getLastUserMessage(username, roomId) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        const messageService = this.databaseService.getMessageService();
        return await messageService.getLastUserMessage(username, roomId);
    }
    
    // ===== Image/Gallery Methods =====
    
    async saveUserImage(username, url, timestamp = Date.now()) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        const userService = this.databaseService.getUserService();
        return await userService.saveUserImage(username, url, timestamp);
    }
    
    async getUserImages(username, options = {}) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        const userService = this.databaseService.getUserService();
        return await userService.getUserImages(username, options);
    }
    
    async deleteUserImage(username, url) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        const userService = this.databaseService.getUserService();
        return await userService.deleteUserImage(username, url);
    }
    
    async getUserImageCount(username) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        const userService = this.databaseService.getUserService();
        return await userService.getUserImageCount(username);
    }
    
    async isGalleryLocked(username) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        const userService = this.databaseService.getUserService();
        return await userService.isGalleryLocked(username);
    }
    
    async lockGallery(username) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        const userService = this.databaseService.getUserService();
        return await userService.lockGallery(username);
    }
    
    async unlockGallery(username) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        const userService = this.databaseService.getUserService();
        return await userService.unlockGallery(username);
    }
    
    // ===== Economy Methods =====
    
    async getUserBalance(username) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        const economyService = this.databaseService.getEconomyService();
        return await economyService.getUserBalance(username);
    }
    
    async updateUserBalance(username, amount) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        const economyService = this.databaseService.getEconomyService();
        return await economyService.updateUserBalance(username, amount);
    }
    
    async transferBalance(fromUser, toUser, amount) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        const economyService = this.databaseService.getEconomyService();
        return await economyService.transferBalance(fromUser, toUser, amount);
    }
    
    // ===== Direct Query Methods (for legacy compatibility) =====
    
    async run(query, params = []) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        return await this.databaseService.run(query, params);
    }
    
    async get(query, params = []) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        return await this.databaseService.get(query, params);
    }
    
    async all(query, params = []) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        return await this.databaseService.all(query, params);
    }
    
    // ===== Utility Methods =====
    
    async transaction(callback) {
        if (!this.databaseService) {
            throw new Error('Database service not available');
        }
        
        return await this.databaseService.transaction(callback);
    }
    
    isReady() {
        return !!this.databaseService;
    }
}

export default LegacyDatabaseAdapter;