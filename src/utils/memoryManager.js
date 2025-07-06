import { getLogger } from './LoggerCompatibilityLayer.js';

export class MemoryManager {
    constructor(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
        this.maxAge = maxAge;
        this.cleanupInterval = null;
        this.logger = getLogger();
    }

    startCleanup(map, interval = 60 * 60 * 1000) { // Clean every hour
        this.cleanupInterval = setInterval(() => {
            this.cleanupMap(map);
        }, interval);
    }

    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    cleanupMap(map) {
        const now = Date.now();
        let removed = 0;
        
        for (const [key, value] of map.entries()) {
            // Assume value is a timestamp or has a timestamp property
            const timestamp = typeof value === 'number' ? value : value.timestamp;
            
            if (timestamp && (now - timestamp) > this.maxAge) {
                map.delete(key);
                removed++;
            }
        }
        
        if (removed > 0) {
            this.logger.info(`Memory cleanup: removed ${removed} old entries`);
        }
    }
}