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

### Security Model
- **CORS-based Authentication**: Only accept requests from:
  - `https://hildolfr.github.io`
  - `http://localhost:*` (development only, remove after testing)
- **No API Keys in JavaScript**: Rely on origin validation
- **Rate Limiting**: Relaxed limits initially (100 requests per 15 minutes per IP)
- **HTTPS**: Not required initially (home server), but ready for future

## API Structure

### Base URL Format
```
http://<host>:3001/api/v1/<endpoint>
```

### Response Format
All responses follow this structure:
```json
// Success
{
  "success": true,
  "data": { ... }
}

// Error
{
  "error": true,
  "message": "Human readable error description",
  "code": "ERROR_CODE"
}
```

## Phase 1 Endpoints (Initial Implementation)

### Gallery Management

#### Delete Image
```
DELETE /api/v1/gallery/images
```
**Request Body:**
```json
{
  "url": "https://example.com/image.jpg",
  "reason": "Deleted via gallery"  // optional
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Image marked as deleted",
    "url": "https://example.com/image.jpg"
  }
}
```
**Database Effect:** Immediately updates `user_images` table, sets `is_active = 0`

#### Get Gallery Lock Status
```
GET /api/v1/gallery/locks
```
**Response:**
```json
{
  "success": true,
  "data": {
    "locks": [
      { "username": "Spazztik", "isLocked": true },
      { "username": "hildolfr", "isLocked": false }
    ]
  }
}
```

#### Update Gallery Lock
```
PUT /api/v1/gallery/locks/:username
```
**Request Body:**
```json
{
  "locked": true
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "username": "hildolfr",
    "locked": true
  }
}
```

### User Statistics (Read-Only)

#### Get User Stats
```
GET /api/v1/stats/users/:username
```
**Response:**
```json
{
  "success": true,
  "data": {
    "username": "Spazztik",
    "firstSeen": "2025-06-29T10:30:00.000Z",
    "lastSeen": "2025-06-30T04:45:00.000Z",
    "messageCount": 156,
    "bongCount": 23,
    "drinkCount": 45,
    "balance": 420,
    "criminalRecord": "Stole 6 bucks from hildolfr"
  }
}
```

#### Get Leaderboard
```
GET /api/v1/stats/leaderboard/:type
```
**Types:** `bongs`, `drinks`, `money`, `criminal`, `messages`
**Query Params:** `?limit=10` (default: 10, max: 50)
**Response:**
```json
{
  "success": true,
  "data": {
    "type": "bongs",
    "leaderboard": [
      { "rank": 1, "username": "Spazztik", "count": 420 },
      { "rank": 2, "username": "hildolfr", "count": 69 }
    ]
  }
}
```

#### Get Channel Stats
```
GET /api/v1/stats/channel
```
**Response:**
```json
{
  "success": true,
  "data": {
    "totalMessages": 15234,
    "uniqueUsers": 45,
    "activeToday": 12,
    "currentVideo": "Bargearse - Episode 4",
    "uptime": 3600
  }
}
```

### System Endpoints

#### Health Check
```
GET /api/v1/health
```
**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "uptime": 3600,
    "version": "1.0.0",
    "endpoints": 12
  }
}
```

## WebSocket Events (Socket.IO)

### Connection
```javascript
const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling']
});
```

### Events Published by Server

#### Gallery Updates
```javascript
socket.on('gallery:image:added', (data) => {
  // { username: 'Spazztik', url: 'https://...', timestamp: 1234567890 }
});

socket.on('gallery:image:deleted', (data) => {
  // { url: 'https://...', reason: 'Deleted via gallery' }
});

socket.on('gallery:lock:changed', (data) => {
  // { username: 'hildolfr', locked: true }
});
```

#### Real-time Stats
```javascript
socket.on('stats:user:update', (data) => {
  // { username: 'Spazztik', balance: 420, messageCount: 157 }
});

socket.on('stats:channel:activity', (data) => {
  // { activeUsers: 12, event: 'user_joined', username: 'NewUser' }
});
```

#### Chat Activity (Future)
```javascript
socket.on('chat:message', (data) => {
  // { username: 'Spazztik', message: '!bong', timestamp: 1234567890 }
});
```

## Implementation Details

### File Structure
```
src/
├── api/
│   ├── server.js          // Main API server class
│   ├── middleware/
│   │   ├── cors.js        // CORS configuration
│   │   ├── errorHandler.js
│   │   └── rateLimiter.js
│   ├── routes/
│   │   ├── gallery.js     // Gallery endpoints
│   │   ├── stats.js       // Statistics endpoints
│   │   └── health.js      // System endpoints
│   └── websocket/
│       └── events.js      // Socket.IO event handlers
```

### Server Class Structure
```javascript
// src/api/server.js
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';

export class ApiServer {
    constructor(bot, port = 3001) {
        this.bot = bot;
        this.port = port;
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new SocketIOServer(this.server, {
            cors: {
                origin: ["https://hildolfr.github.io", "http://localhost:*"],
                methods: ["GET", "POST", "PUT", "DELETE"]
            }
        });
    }

    async start() {
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        
        return new Promise((resolve) => {
            this.server.listen(this.port, () => {
                this.bot.logger.info(`API server started on port ${this.port}`);
                console.log(`[API] Server listening on http://localhost:${this.port}`);
                resolve();
            });
        });
    }

    async stop() {
        return new Promise((resolve) => {
            this.server.close(() => {
                this.bot.logger.info('API server stopped');
                resolve();
            });
        });
    }
}
```

### CORS Configuration
```javascript
// Strict CORS for production
const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = [
            'https://hildolfr.github.io',
            /^http:\/\/localhost(:\d+)?$/  // Any localhost port
        ];
        
        if (!origin || allowedOrigins.some(allowed => 
            allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
        )) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
};
```

### Error Handling
All errors are:
1. Logged to console with full stack trace
2. Sent to client with sanitized message
3. Include correlation ID for debugging

```javascript
app.use((err, req, res, next) => {
    const errorId = Date.now().toString(36);
    
    // Log full error
    console.error(`[API Error ${errorId}]`, err);
    this.bot.logger.error('API Error', {
        id: errorId,
        path: req.path,
        method: req.method,
        error: err.message,
        stack: err.stack
    });
    
    // Send sanitized response
    res.status(err.status || 500).json({
        error: true,
        message: err.message || 'Internal server error',
        code: err.code || 'INTERNAL_ERROR',
        id: errorId
    });
});
```

### Integration with Bot

#### Startup
```javascript
// In bot initialization
import { ApiServer } from './api/server.js';

// After database init
this.apiServer = new ApiServer(this, 3001);
await this.apiServer.start();
```

#### Shutdown
```javascript
// In bot shutdown
if (this.apiServer) {
    await this.apiServer.stop();
}
```

#### Event Broadcasting
```javascript
// When image is added to gallery
this.apiServer?.io.emit('gallery:image:added', {
    username,
    url,
    timestamp: Date.now()
});
```

## Gallery JavaScript Updates

### API Integration
```javascript
// gallery.js updates
const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:3001/api/v1'
    : 'http://YOUR_HOME_SERVER:3001/api/v1';  // TODO: Configure this

async function deleteImage(url) {
    try {
        const response = await fetch(`${API_BASE}/gallery/images`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
            // Remove from DOM immediately
            removeImageFromGallery(url);
            showNotification('Image deleted successfully');
        } else {
            showError(result.message);
        }
    } catch (error) {
        console.error('Delete failed:', error);
        showError('Failed to connect to server');
    }
}

// WebSocket connection for real-time updates
const socket = io(API_BASE.replace('/api/v1', ''));

socket.on('gallery:image:deleted', (data) => {
    if (data.url) {
        removeImageFromGallery(data.url);
    }
});

socket.on('gallery:lock:changed', (data) => {
    updateLockStatus(data.username, data.locked);
});
```

## Testing Strategy

### Manual Testing Checklist
- [ ] CORS blocks requests from unauthorized domains
- [ ] CORS allows GitHub Pages requests
- [ ] CORS allows localhost during development
- [ ] Gallery delete actually removes images
- [ ] WebSocket events broadcast correctly
- [ ] Errors appear in console log
- [ ] API starts/stops with bot

### Automated Tests
```javascript
// test/api.test.js
describe('API Server', () => {
    it('should reject non-CORS origins', async () => {
        const response = await fetch('http://localhost:3001/api/v1/health', {
            headers: { 'Origin': 'https://evil.com' }
        });
        expect(response.ok).toBe(false);
    });
    
    it('should accept GitHub Pages origin', async () => {
        const response = await fetch('http://localhost:3001/api/v1/health', {
            headers: { 'Origin': 'https://hildolfr.github.io' }
        });
        expect(response.ok).toBe(true);
    });
});
```

## Future Enhancements

### Phase 2 Features
- Webhook system for external integrations
- Public read-only endpoints (no CORS)
- Admin authentication for sensitive operations
- Request signing for enhanced security
- GraphQL endpoint for complex queries

### Phase 3 Features
- Admin dashboard web interface
- API key management system
- Usage analytics and monitoring
- CDN/caching layer
- Multi-region support

## Configuration

### Environment Variables
```env
# API Configuration
API_PORT=3001
API_CORS_ORIGINS=https://hildolfr.github.io,http://localhost:*
API_RATE_LIMIT_WINDOW=15
API_RATE_LIMIT_MAX=100
API_LOG_LEVEL=info
```

### Home Server Considerations
- No HTTPS required initially
- Ensure port 3001 is accessible
- Consider dynamic DNS for stable addressing
- Monitor bandwidth usage
- Setup firewall rules if needed

## Deployment Notes

1. **Port Forwarding**: If behind NAT, forward port 3001
2. **Domain Setup**: Consider setting up `api.dazza.bot` subdomain
3. **Process Management**: API runs within bot process
4. **Monitoring**: Check `logs/console_log.txt` for API logs
5. **Updates**: API updates require bot restart

## Success Criteria

- [ ] Gallery can delete images without page refresh
- [ ] Stats display real-time user information  
- [ ] WebSocket connections remain stable
- [ ] No unauthorized access from other domains
- [ ] All errors logged to console_log.txt
- [ ] Graceful shutdown with bot
- [ ] Minimal performance impact on bot