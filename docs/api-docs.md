# Dazza Bot API Documentation

## Overview

Dazza Bot runs an HTTP/HTTPS API server on port 3001 for external integrations.

- **Base URL**: `https://your-server:3001/api/v1`
- **WebSocket**: `wss://your-server:3001`
- **CORS**: Configured for specific origins (see server configuration)

## Authentication

Currently, the API uses CORS origin validation. Requests must come from allowed origins.

## Endpoints

### Health Check

#### GET /api/v1/health
Check if API is running.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "uptime": 300,
    "version": "1.0.0",
    "endpoints": 19,
    "connections": {
      "bot": true,
      "database": true,
      "websocket": 2
    },
    "timestamp": "2025-06-30T12:00:00.000Z"
  }
}
```

#### GET /api/v1/health/detailed
Extended health information with memory and database statistics.

### Gallery Management

#### DELETE /api/v1/gallery/images
Delete an image from a user's gallery.

**Request Body:**
```json
{
  "username": "hildolfr",
  "url": "https://example.com/image.jpg",
  "reason": "User requested deletion"
}
```

#### GET /api/v1/gallery/images
Get all user galleries with images.

#### GET /api/v1/gallery/images/:username
Get a specific user's gallery images.

#### GET /api/v1/gallery/locks
Get all gallery lock statuses.

#### GET /api/v1/gallery/locks/:username
Get a specific user's gallery lock status.

#### PUT /api/v1/gallery/locks/:username
Update gallery lock status.

**Request Body:**
```json
{
  "locked": true
}
```

### User Statistics

#### GET /api/v1/stats/users/:username
Get comprehensive user statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "username": "hildolfr",
    "firstSeen": 1700000000000,
    "lastSeen": 1700100000000,
    "messageCount": 150,
    "bongs": { "total": 25, "lastHit": 1700090000000 },
    "drinks": { "total": 10, "lastDrink": 1700080000000 },
    "economy": { "balance": 2500, "trust": 75 },
    "criminal": { "muggings": 5, "timesArrested": 2 }
  }
}
```

#### GET /api/v1/stats/recent/activity
Get recent channel activity (last 5 minutes).

### Leaderboards

#### GET /api/v1/stats/leaderboard/:type
Get rankings for various categories.

**Types:** `bongs`, `drinks`, `money`, `criminal`, `messages`, `images`

**Query Parameters:**
- `limit`: Number of results (max 50, default 10)

### Channel Statistics

#### GET /api/v1/stats/channel
Get channel-wide statistics.

#### GET /api/v1/stats/daily/:type
Get daily statistics for the past N days.

**Types:** `bongs`, `drinks`, `messages`

**Query Parameters:**
- `days`: Number of days to retrieve (default 7, max 30)

### Activity

#### GET /api/v1/gallery/activity
Get recent gallery activity (images added/deleted).

**Query Parameters:**
- `limit`: Number of results (default 50)
- `offset`: Pagination offset
- `type`: Filter by activity type (`added`, `deleted`, `all`)

## WebSocket Events

Real-time updates via Socket.IO.

### Connection
```javascript
const socket = io('wss://your-server:3001', {
    transports: ['websocket', 'polling']
});

// Subscribe to topics
socket.emit('subscribe', ['gallery', 'stats', 'chat', 'bot']);
```

### Available Topics
- `gallery`: Gallery updates (image added/deleted, lock changes)
- `stats`: User and channel statistics updates
- `chat`: Chat events (messages, user join/leave)
- `bot`: Bot status updates

### Events

#### Gallery Events
- `gallery:image:added` - New image added to gallery
- `gallery:image:deleted` - Image removed from gallery
- `gallery:lock:changed` - Gallery lock status changed
- `gallery:updated` - General gallery update

#### Stats Events
- `stats:user:update` - User statistics updated
- `stats:channel:activity` - Channel activity update
- `stats:heartbeat` - Periodic stats broadcast

#### Chat Events
- `chat:message` - New chat message (non-command)
- `chat:user:join` - User joined channel
- `chat:user:leave` - User left channel
- `chat:media:change` - Currently playing media changed

## Rate Limiting

- **Default:** 100 requests per 15 minutes per IP
- **Headers:**
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp
- **429 Response:** Includes `Retry-After` header

## Error Responses

All errors follow a consistent format:

```json
{
  "error": true,
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "id": "unique-error-id"
}
```

### Common Error Codes
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Invalid request data
- `CORS_FORBIDDEN`: Origin not allowed
- `RATE_LIMIT`: Rate limit exceeded
- `INTERNAL_ERROR`: Server error

## CORS Configuration

The API allows requests from configured origins. To add your domain:
1. Set `API_CORS_ORIGINS` environment variable
2. Or modify the `getAllowedOrigins()` method in server.js

## SSL/TLS

The API supports HTTPS when SSL certificates are provided:
1. Place `server.key` and `server.crt` in the `ssl/` directory
2. The server will automatically use HTTPS

## Example Usage

### Fetch User Stats
```javascript
const response = await fetch('https://api.example.com:3001/api/v1/stats/users/hildolfr');
const data = await response.json();
console.log(data.data);
```

### WebSocket Connection
```javascript
const socket = io('wss://api.example.com:3001');

socket.on('connect', () => {
    socket.emit('subscribe', ['gallery', 'stats']);
});

socket.on('gallery:image:added', (data) => {
    console.log('New image:', data);
});
```