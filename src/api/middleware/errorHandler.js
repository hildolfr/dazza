export function createErrorHandler(apiServer) {
    return (err, req, res, next) => {
        // Generate unique error ID
        const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        
        // Log full error details
        const errorDetails = {
            id: errorId,
            timestamp: new Date().toISOString(),
            path: req.path,
            method: req.method,
            origin: req.get('origin'),
            ip: req.ip,
            error: {
                message: err.message,
                code: err.code || 'INTERNAL_ERROR',
                status: err.status || 500,
                stack: err.stack
            }
        };
        
        // Log to file
        apiServer.bot.logger.error('[API] Request error', errorDetails);
        
        // Log to console for debugging
        console.error(`[API Error ${errorId}]`, {
            path: req.path,
            method: req.method,
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
        
        // Determine status code
        const statusCode = err.status || err.statusCode || 500;
        
        // Build client response
        const response = {
            error: true,
            message: err.expose ? err.message : 'Internal server error',
            code: err.code || 'INTERNAL_ERROR',
            id: errorId
        };
        
        // Add additional error details in development
        if (process.env.NODE_ENV === 'development') {
            response.details = {
                stack: err.stack,
                path: req.path,
                method: req.method
            };
        }
        
        res.status(statusCode).json(response);
    };
}

// Custom error classes
export class ApiError extends Error {
    constructor(message, code = 'API_ERROR', status = 400) {
        super(message);
        this.code = code;
        this.status = status;
        this.expose = true; // Safe to expose message to client
    }
}

export class ValidationError extends ApiError {
    constructor(message, field = null) {
        super(message, 'VALIDATION_ERROR', 400);
        this.field = field;
    }
}

export class NotFoundError extends ApiError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 'NOT_FOUND', 404);
    }
}

export class ForbiddenError extends ApiError {
    constructor(message = 'Access forbidden') {
        super(message, 'FORBIDDEN', 403);
    }
}

export class RateLimitError extends ApiError {
    constructor(retryAfter = null) {
        super('Too many requests', 'RATE_LIMIT', 429);
        this.retryAfter = retryAfter;
    }
}

// Async error wrapper for route handlers
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}