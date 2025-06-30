# Dazza Bot API Implementation

## Overview
The Dazza Bot now includes a fully-featured HTTP API server with WebSocket support for real-time updates. The API runs on port 3001 and provides access to bot statistics, gallery management, and real-time event streaming.

## Implementation Summary

### Architecture
- **Framework**: Express.js with Socket.IO for WebSocket support
- **Port**: 3001 (configurable via `config.api.port`)
- **Authentication**: Domain-based CORS (allows https://hildolfr.github.io and localhost)
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **API Version**: v1 (accessible at `/api/v1/*`)

### Directory Structure
```
src/api/
├── server.js              # Main API server class
├── middleware/
│   ├── cors.js           # CORS configuration
│   ├── errorHandler.js   # Error handling and custom error classes
│   └── rateLimiter.js    # Rate limiting implementation
├── routes/
│   ├── gallery.js        # Gallery management endpoints
│   ├── health.js         # System health endpoints
│   └── stats.js          # Statistics endpoints
└── websocket/
    └── events.js         # WebSocket event handlers
```

### Key Features Implemented

#### 1. REST API Endpoints
- **Health Check**: `/api/v1/health` and `/api/v1/health/detailed`
- **Gallery Management**: 
  - Delete images: `DELETE /api/v1/gallery/images`
  - Manage locks: `GET/PUT /api/v1/gallery/locks/:username`
  - Get user images: `GET /api/v1/gallery/images/:username`
- **Statistics**:
  - User stats: `GET /api/v1/stats/users/:username`
  - Leaderboards: `GET /api/v1/stats/leaderboard/:type`
  - Channel stats: `GET /api/v1/stats/channel`
  - Daily stats: `GET /api/v1/stats/daily/:type`
  - Recent activity: `GET /api/v1/stats/recent/activity`

#### 2. WebSocket Events
Real-time updates are broadcast for:
- Gallery changes (image additions, deletions, lock updates)
- User activity (joins, leaves, messages)
- Media changes
- Bot connection status
- Statistical updates

#### 3. Security Features
- Strict CORS policy (only allows specified origins)
- Rate limiting with configurable limits
- Error sanitization (no stack traces in production)
- Request logging for debugging

### Integration with Bot
The API server is fully integrated into the bot's lifecycle:
- Starts automatically when bot initializes
- Gracefully shuts down with the bot
- Emits events from bot actions for real-time updates
- Has access to bot's database and state

### Testing
A test script is provided at `test-api.js` to verify:
- REST endpoint functionality
- WebSocket connectivity
- CORS enforcement
- Error handling

### Configuration
Environment variables:
- `API_PORT`: Server port (default: 3001)
- `API_CORS_ORIGINS`: Additional allowed origins (comma-separated)
- `API_RATE_LIMIT_WINDOW`: Rate limit window in minutes (default: 15)
- `API_RATE_LIMIT_MAX`: Max requests per window (default: 100)

### Usage Example
```javascript
// REST API
const response = await fetch('http://localhost:3001/api/v1/stats/users/dazza');
const userData = await response.json();

// WebSocket
const socket = io('http://localhost:3001');
socket.emit('subscribe', ['gallery', 'stats']);
socket.on('gallery:image:added', (data) => {
    console.log('New image:', data);
});
```

## Documentation
API documentation has been added to the bot's command manual at:
https://hildolfr.github.io/dazza/commands.html#api

## Future Enhancements
The API is designed to be extensible. Potential future additions:
- Authentication system for admin endpoints
- GraphQL endpoint for complex queries
- Webhook system for external integrations
- Public read-only endpoints
- CDN/caching layer for performance

## Notes
- The API server runs within the bot process (not a separate service)
- All API activity is logged to the bot's standard log files
- WebSocket connections are cleaned up properly on disconnect
- Rate limiting is per-IP and includes cleanup of old entries

Created with 🍺 by Dazza Bot