export function createCorsMiddleware(apiServer) {
    const corsOptions = {
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps or Postman)
            if (!origin) {
                return callback(null, true);
            }
            
            const allowedOrigins = apiServer.getAllowedOrigins();
            
            // Check if origin matches any allowed pattern
            const isAllowed = allowedOrigins.some(allowed => {
                if (allowed instanceof RegExp) {
                    return allowed.test(origin);
                }
                return allowed === origin;
            });
            
            if (isAllowed) {
                callback(null, true);
            } else {
                apiServer.bot.logger.warn(`[API] CORS blocked request from: ${origin}`);
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        maxAge: 86400 // 24 hours
    };
    
    return corsOptions;
}

// Strict CORS middleware for sensitive endpoints
export function strictCorsMiddleware(apiServer) {
    return (req, res, next) => {
        const origin = req.get('origin') || req.get('referer');
        
        if (!origin) {
            return res.status(403).json({
                error: true,
                message: 'Origin header required',
                code: 'ORIGIN_REQUIRED'
            });
        }
        
        const allowedOrigins = apiServer.getAllowedOrigins();
        const isAllowed = allowedOrigins.some(allowed => {
            if (allowed instanceof RegExp) {
                return allowed.test(origin);
            }
            return origin.startsWith(allowed);
        });
        
        if (!isAllowed) {
            apiServer.bot.logger.warn(`[API] Strict CORS blocked request from: ${origin}`);
            return res.status(403).json({
                error: true,
                message: 'Forbidden - Invalid origin',
                code: 'CORS_FORBIDDEN'
            });
        }
        
        next();
    };
}