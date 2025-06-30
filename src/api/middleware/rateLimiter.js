import { RateLimitError } from './errorHandler.js';

export function createRateLimiter(apiServer) {
    // Store rate limit data in memory
    const requests = new Map();
    
    // Configuration
    const windowMs = (process.env.API_RATE_LIMIT_WINDOW || 15) * 60 * 1000; // Default 15 minutes
    const maxRequests = parseInt(process.env.API_RATE_LIMIT_MAX || 100);
    
    // Cleanup old entries periodically
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        const cutoff = now - windowMs;
        
        for (const [key, data] of requests.entries()) {
            // Remove entries with no recent requests
            const recentRequests = data.timestamps.filter(ts => ts > cutoff);
            if (recentRequests.length === 0) {
                requests.delete(key);
            } else {
                data.timestamps = recentRequests;
            }
        }
    }, 60000); // Clean up every minute
    
    // Store cleanup interval for shutdown
    apiServer.rateLimiterCleanup = () => clearInterval(cleanupInterval);
    
    return (req, res, next) => {
        // Skip rate limiting for health checks
        if (req.path === '/api/v1/health') {
            return next();
        }
        
        // Get client identifier (IP address)
        const clientId = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const cutoff = now - windowMs;
        
        // Get or create request data for this client
        if (!requests.has(clientId)) {
            requests.set(clientId, { timestamps: [] });
        }
        
        const clientData = requests.get(clientId);
        
        // Filter out old timestamps
        clientData.timestamps = clientData.timestamps.filter(ts => ts > cutoff);
        
        // Check if limit exceeded
        if (clientData.timestamps.length >= maxRequests) {
            // Calculate when the oldest request will expire
            const oldestRequest = Math.min(...clientData.timestamps);
            const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);
            
            apiServer.bot.logger.warn(`[API] Rate limit exceeded for ${clientId}`);
            
            // Set retry-after header
            res.set('Retry-After', retryAfter.toString());
            res.set('X-RateLimit-Limit', maxRequests.toString());
            res.set('X-RateLimit-Remaining', '0');
            res.set('X-RateLimit-Reset', new Date(oldestRequest + windowMs).toISOString());
            
            throw new RateLimitError(retryAfter);
        }
        
        // Add current request timestamp
        clientData.timestamps.push(now);
        
        // Set rate limit headers
        const remaining = maxRequests - clientData.timestamps.length;
        const reset = new Date(now + windowMs).toISOString();
        
        res.set('X-RateLimit-Limit', maxRequests.toString());
        res.set('X-RateLimit-Remaining', remaining.toString());
        res.set('X-RateLimit-Reset', reset);
        
        next();
    };
}

// Create a stricter rate limiter for sensitive endpoints
export function createStrictRateLimiter(apiServer, maxRequests = 10, windowMs = 60000) {
    const requests = new Map();
    
    return (req, res, next) => {
        const clientId = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const cutoff = now - windowMs;
        
        if (!requests.has(clientId)) {
            requests.set(clientId, { timestamps: [] });
        }
        
        const clientData = requests.get(clientId);
        clientData.timestamps = clientData.timestamps.filter(ts => ts > cutoff);
        
        if (clientData.timestamps.length >= maxRequests) {
            const retryAfter = Math.ceil(windowMs / 1000);
            apiServer.bot.logger.warn(`[API] Strict rate limit exceeded for ${clientId} on ${req.path}`);
            
            res.set('Retry-After', retryAfter.toString());
            throw new RateLimitError(retryAfter);
        }
        
        clientData.timestamps.push(now);
        next();
    };
}