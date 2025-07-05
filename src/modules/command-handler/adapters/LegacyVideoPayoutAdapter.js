/**
 * Legacy Video Payout Adapter - Provides backward compatibility for video payout commands
 * This adapter wraps video payout services or provides fallback functionality
 */
class LegacyVideoPayoutAdapter {
    constructor(services) {
        this.services = services;
        this.videoPayoutService = services.get('video-payout');
        this.logger = null;
    }
    
    setLogger(logger) {
        this.logger = logger;
    }
    
    async getUserStats(username) {
        if (!this.videoPayoutService) {
            // Return null if service not available
            return null;
        }
        
        return await this.videoPayoutService.getUserStats(username);
    }
    
    async recordVideoWatch(username, videoData) {
        if (!this.videoPayoutService) {
            return null;
        }
        
        return await this.videoPayoutService.recordVideoWatch(username, videoData);
    }
    
    async calculatePayout(username, videoData) {
        if (!this.videoPayoutService) {
            return { payout: 0, isLucky: false };
        }
        
        return await this.videoPayoutService.calculatePayout(username, videoData);
    }
    
    async getUserEarnings(username) {
        if (!this.videoPayoutService) {
            return { total_earned: 0, videos_watched: 0, lucky_rewards: 0 };
        }
        
        return await this.videoPayoutService.getUserEarnings(username);
    }
    
    isReady() {
        return !!this.videoPayoutService;
    }
}

export default LegacyVideoPayoutAdapter;