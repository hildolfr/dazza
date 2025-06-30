# Dazza Bot API Implementation Specification

## Overview
HTTP API server embedded within Dazza bot to enable dynamic features for the GitHub Pages gallery and future integrations. The API will use domain-based authentication (CORS) rather than API keys for simplicity and security.

## Core Architecture

### Technology Stack
- **Framework**: Express.js (embedded in bot process)
- **Real-time**: Socket.IO (for WebSocket support)
- **Authentication**: Domain-based (CORS validation)
- **Port**: 3001
- **Versioning**: `/api/v1/` prefix for all endpoints

## Architecture Options

### 1. **Express.js Server Within Bot**
- Add Express server running alongside the bot
- Single process, shared database connection
- Pros: Simple, direct database access, real-time updates
- Cons: Increases bot complexity, potential security concerns

### 2. **Separate API Service**
- Independent Node.js service
- Communicates with bot via shared database or message queue
- Pros: Better separation of concerns, can scale independently
- Cons: More complex deployment, needs inter-process communication

### 3. **Webhook-Based System**
- Bot exposes webhook endpoints
- GitHub Pages sends requests to webhooks
- Pros: Event-driven, loosely coupled
- Cons: Requires public endpoint, security considerations

## Recommended Approach: Embedded Express Server

### Core Features

```javascript
// src/api/server.js
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

class ApiServer {
    constructor(bot, port = 3000) {
        this.bot = bot;
        this.app = express();
        this.port = port;
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // CORS for GitHub Pages
        this.app.use(cors({
            origin: ['https://hildolfr.github.io', 'http://localhost:*'],
            credentials: true
        }));

        // Rate limiting
        this.app.use(rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100 // limit each IP to 100 requests per windowMs
        }));

        this.app.use(express.json());
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', uptime: process.uptime() });
        });

        // Gallery endpoints
        this.app.post('/api/gallery/delete', this.handleGalleryDelete.bind(this));
        this.app.get('/api/gallery/status', this.handleGalleryStatus.bind(this));
        
        // Future endpoints
        this.app.get('/api/stats/:username', this.handleUserStats.bind(this));
        this.app.post('/api/commands/execute', this.handleRemoteCommand.bind(this));
    }
}
```

## Security Considerations

### 1. **Authentication Options**

#### API Keys
```javascript
// Simple API key in header
const apiKey = req.headers['x-api-key'];
if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
}
```

#### JWT Tokens
```javascript
// More complex but flexible
import jwt from 'jsonwebtoken';

// Generate token for gallery page
const token = jwt.sign(
    { purpose: 'gallery', exp: Date.now() + 3600000 },
    process.env.JWT_SECRET
);

// Verify in API
const decoded = jwt.verify(token, process.env.JWT_SECRET);
```

#### HMAC Signatures
```javascript
// Sign requests to prevent tampering
const signature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');
```

### 2. **Rate Limiting Strategies**
- Per-IP rate limiting
- Per-endpoint limits
- User-based quotas
- Sliding window counters

### 3. **CORS Configuration**
- Whitelist GitHub Pages domain
- Allow localhost for development
- Restrict methods and headers

## API Endpoints Design

### Gallery Management
```
POST /api/gallery/delete
Body: { url: string, reason?: string }
Response: { success: boolean, message: string }

GET /api/gallery/locks
Response: { locks: { username: string, isLocked: boolean }[] }

POST /api/gallery/lock
Body: { username: string, lock: boolean }
Response: { success: boolean }
```

### Statistics & Data
```
GET /api/stats/user/:username
Response: { messages: number, firstSeen: date, lastSeen: date, ... }

GET /api/stats/channel
Response: { activeUsers: number, totalMessages: number, ... }

GET /api/leaderboard/:type
Types: bongs, drinks, money, criminal
Response: { leaderboard: [...] }
```

### Bot Interaction
```
POST /api/message
Body: { message: string, asUser?: string }
Response: { success: boolean }

POST /api/command
Body: { command: string, args: string[], user: string }
Response: { success: boolean, response?: string }
```

### Real-time Features (WebSocket)
```javascript
// Socket.IO for real-time updates
io.on('connection', (socket) => {
    // Send gallery updates
    socket.emit('gallery:updated', { timestamp: Date.now() });
    
    // Live stats
    socket.emit('stats:update', { activeUsers: count });
    
    // Chat activity indicators
    socket.emit('chat:activity', { username, action });
});
```

## Implementation Steps

### Phase 1: Basic API Setup
1. Install dependencies: `express`, `cors`, `helmet`, `express-rate-limit`
2. Create API server class
3. Add health check endpoint
4. Setup CORS for GitHub Pages
5. Add to bot initialization

### Phase 2: Gallery Integration
1. Implement delete endpoint
2. Add authentication (start with API key)
3. Update gallery JavaScript to use API
4. Add gallery status endpoint
5. Test with local development

### Phase 3: Extended Features
1. User statistics endpoints
2. Leaderboard endpoints
3. Command execution endpoint
4. WebSocket support for real-time updates

### Phase 4: Security Hardening
1. Implement proper authentication (JWT)
2. Add request validation
3. Implement audit logging
4. Setup monitoring and alerts

## Deployment Considerations

### Environment Variables
```env
API_PORT=3001
API_KEY=your-secret-api-key
JWT_SECRET=your-jwt-secret
ALLOWED_ORIGINS=https://hildolfr.github.io,http://localhost:3000
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
```

### Process Management
- Use PM2 or similar for process management
- Implement graceful shutdown
- Add health checks for monitoring
- Log API requests separately

### Reverse Proxy Setup (Optional)
```nginx
server {
    listen 443 ssl;
    server_name api.dazza.bot;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Gallery Implementation Example

### Updated Gallery JavaScript
```javascript
const API_URL = 'https://api.dazza.bot'; // or http://localhost:3001 for dev
const API_KEY = 'embedded-api-key'; // TODO: Better auth method

async function deleteImage(url, username) {
    try {
        const response = await fetch(`${API_URL}/api/gallery/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({ url, username })
        });

        const result = await response.json();
        if (result.success) {
            // Update UI immediately
            markAsDeleted(url);
            showNotification('Image queued for deletion');
        } else {
            showError(result.message);
        }
    } catch (error) {
        console.error('Delete failed:', error);
        showError('Failed to delete image');
    }
}
```

## Future Enhancements

### 1. **Admin Dashboard**
- Web interface for bot management
- Real-time logs viewer
- Command execution interface
- User management

### 2. **Public API**
- Rate-limited public endpoints
- API documentation (Swagger/OpenAPI)
- Developer tokens
- Usage analytics

### 3. **Webhooks System**
- Allow users to subscribe to events
- Gallery updates
- User milestones
- Heist notifications

### 4. **GraphQL Endpoint**
- More flexible data queries
- Reduced over-fetching
- Better for complex stats pages

### 5. **CDN Integration**
- Cache API responses
- Cloudflare Workers for edge computing
- Reduce bot server load

## Security Checklist

- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitize outputs)
- [ ] CSRF protection
- [ ] Rate limiting implemented
- [ ] Authentication required
- [ ] HTTPS only in production
- [ ] Sensitive data not logged
- [ ] Error messages don't leak info
- [ ] Regular security audits

## Monitoring & Logging

### Metrics to Track
- API request count by endpoint
- Response times
- Error rates
- Unique users
- Geographic distribution

### Logging Strategy
```javascript
// Structured logging
logger.info('API request', {
    endpoint: req.path,
    method: req.method,
    ip: req.ip,
    user: req.user?.id,
    duration: Date.now() - req.startTime
});
```

### Alerting
- High error rate alerts
- Unusual traffic patterns
- Authentication failures
- Database connection issues

## Testing Strategy

### Unit Tests
- Test each endpoint in isolation
- Mock database calls
- Test error conditions

### Integration Tests
- Test full request/response cycle
- Test with real database
- Test rate limiting

### Load Testing
- Use Artillery or K6
- Test concurrent users
- Find breaking points
- Optimize bottlenecks

## Documentation Needs

1. **API Reference**
   - Endpoint descriptions
   - Request/response examples
   - Error codes
   - Rate limits

2. **Integration Guide**
   - How to authenticate
   - JavaScript SDK examples
   - Common use cases
   - Troubleshooting

3. **Development Setup**
   - Local environment setup
   - Testing with gallery
   - Debugging tips
   - Contributing guidelines