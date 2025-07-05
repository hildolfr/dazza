import { EventEmitter } from 'events';

class RouteManager extends EventEmitter {
    constructor(apiModule) {
        super();
        
        this.apiModule = apiModule;
        this.routes = new Map();
        this.middleware = new Map();
        this.validators = new Map();
    }
    
    // ===== Route Management =====
    
    registerRoute(moduleId, method, path, handler, options = {}) {
        const routeKey = `${method.toUpperCase()} ${path}`;
        const fullPath = `/api/${moduleId}${path}`;
        
        // Store route info
        this.routes.set(`${moduleId}:${routeKey}`, {
            moduleId,
            method,
            path,
            fullPath,
            handler,
            options
        });
        
        // Apply middleware if specified
        const middlewares = [];
        
        if (options.authenticate) {
            middlewares.push(this._getAuthMiddleware());
        }
        
        if (options.validate) {
            middlewares.push(this._getValidationMiddleware(options.validate));
        }
        
        if (options.rateLimit) {
            middlewares.push(this._getRateLimitMiddleware(options.rateLimit));
        }
        
        // Register with Express
        const app = this.apiModule.getExpressApp();
        app[method.toLowerCase()](fullPath, ...middlewares, handler);
        
        this.emit('route:registered', {
            moduleId,
            method,
            path: fullPath
        });
    }
    
    registerBulkRoutes(moduleId, routes) {
        for (const [routeString, config] of Object.entries(routes)) {
            const [method, path] = this._parseRouteString(routeString);
            
            if (typeof config === 'function') {
                // Simple handler
                this.registerRoute(moduleId, method, path, config);
            } else {
                // Handler with options
                const { handler, ...options } = config;
                this.registerRoute(moduleId, method, path, handler, options);
            }
        }
    }
    
    // ===== Middleware =====
    
    registerModuleMiddleware(moduleId, middleware) {
        if (!this.middleware.has(moduleId)) {
            this.middleware.set(moduleId, []);
        }
        
        this.middleware.get(moduleId).push(middleware);
    }
    
    _getAuthMiddleware() {
        return (req, res, next) => {
            // Simple auth check - can be extended
            const token = req.headers.authorization?.split(' ')[1];
            
            if (!token) {
                return res.status(401).json({
                    error: 'Authentication required'
                });
            }
            
            // Verify token (simplified)
            req.user = { authenticated: true };
            next();
        };
    }
    
    _getValidationMiddleware(schema) {
        return (req, res, next) => {
            const errors = [];
            
            // Validate body
            if (schema.body) {
                const bodyErrors = this._validateObject(req.body, schema.body);
                errors.push(...bodyErrors.map(e => `body.${e}`));
            }
            
            // Validate params
            if (schema.params) {
                const paramErrors = this._validateObject(req.params, schema.params);
                errors.push(...paramErrors.map(e => `params.${e}`));
            }
            
            // Validate query
            if (schema.query) {
                const queryErrors = this._validateObject(req.query, schema.query);
                errors.push(...queryErrors.map(e => `query.${e}`));
            }
            
            if (errors.length > 0) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors
                });
            }
            
            next();
        };
    }
    
    _getRateLimitMiddleware(config) {
        const { default: rateLimit } = await import('express-rate-limit');
        
        return rateLimit({
            windowMs: config.windowMs || 60000,
            max: config.max || 10,
            message: config.message || 'Too many requests',
            keyGenerator: config.keyGenerator || ((req) => req.ip)
        });
    }
    
    // ===== Validation Helpers =====
    
    _validateObject(obj, schema) {
        const errors = [];
        
        // Check required fields
        if (schema.required) {
            for (const field of schema.required) {
                if (!(field in obj)) {
                    errors.push(`${field} is required`);
                }
            }
        }
        
        // Check field types
        if (schema.properties) {
            for (const [field, config] of Object.entries(schema.properties)) {
                if (field in obj) {
                    const value = obj[field];
                    
                    // Type check
                    if (config.type && typeof value !== config.type) {
                        errors.push(`${field} must be ${config.type}`);
                    }
                    
                    // Pattern check
                    if (config.pattern && !new RegExp(config.pattern).test(value)) {
                        errors.push(`${field} format is invalid`);
                    }
                    
                    // Min/max for numbers
                    if (config.type === 'number') {
                        if (config.min !== undefined && value < config.min) {
                            errors.push(`${field} must be >= ${config.min}`);
                        }
                        if (config.max !== undefined && value > config.max) {
                            errors.push(`${field} must be <= ${config.max}`);
                        }
                    }
                }
            }
        }
        
        return errors;
    }
    
    // ===== Utility Methods =====
    
    _parseRouteString(routeString) {
        const parts = routeString.split(' ');
        if (parts.length === 2) {
            return [parts[0], parts[1]];
        }
        return ['GET', routeString];
    }
    
    getModuleRoutes(moduleId) {
        const moduleRoutes = [];
        
        for (const [key, route] of this.routes) {
            if (route.moduleId === moduleId) {
                moduleRoutes.push(route);
            }
        }
        
        return moduleRoutes;
    }
    
    getAllRoutes() {
        return Array.from(this.routes.values());
    }
}

export default RouteManager;