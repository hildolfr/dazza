export class RateLimiter {
    constructor(options = {}) {
        this.windowMs = options.windowMs || 60000; // 1 minute default
        this.maxRequests = options.maxRequests || 10; // 10 requests per window
        this.warnThreshold = options.warnThreshold || 0.8; // Warn at 80% of limit
        this.users = new Map();
    }

    check(userId) {
        const now = Date.now();
        let userData = this.users.get(userId);

        if (!userData) {
            userData = {
                requests: [],
                warned: false
            };
            this.users.set(userId, userData);
        }

        // Remove old requests outside the window
        userData.requests = userData.requests.filter(
            timestamp => now - timestamp < this.windowMs
        );

        // Check if rate limit exceeded
        if (userData.requests.length >= this.maxRequests) {
            const oldestRequest = userData.requests[0];
            const resetTime = Math.ceil((this.windowMs - (now - oldestRequest)) / 1000);
            
            return {
                allowed: false,
                resetIn: resetTime,
                requests: userData.requests.length,
                limit: this.maxRequests
            };
        }

        // Add current request
        userData.requests.push(now);

        // Check if we should warn the user
        const shouldWarn = !userData.warned && 
            userData.requests.length >= Math.floor(this.maxRequests * this.warnThreshold);
        
        if (shouldWarn) {
            userData.warned = true;
        }

        // Reset warning flag if requests drop below threshold
        if (userData.requests.length < Math.floor(this.maxRequests * this.warnThreshold)) {
            userData.warned = false;
        }

        return {
            allowed: true,
            remaining: this.maxRequests - userData.requests.length,
            requests: userData.requests.length,
            limit: this.maxRequests,
            shouldWarn
        };
    }

    reset(userId) {
        this.users.delete(userId);
    }

    cleanup() {
        const now = Date.now();
        for (const [userId, userData] of this.users.entries()) {
            // Remove users with no recent activity
            const hasRecentActivity = userData.requests.some(
                timestamp => now - timestamp < this.windowMs
            );
            
            if (!hasRecentActivity) {
                this.users.delete(userId);
            }
        }
    }

    startAutoCleanup(interval = 300000) { // Clean every 5 minutes
        this.cleanupInterval = setInterval(() => this.cleanup(), interval);
    }

    stopAutoCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}