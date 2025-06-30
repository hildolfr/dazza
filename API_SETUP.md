# API Server Setup Guide

## Current Status
- **Domain**: seg.tplinkdns.com
- **Port**: 3001
- **API Status**: Currently not accessible externally

## Setup Steps

### 1. Ensure Bot is Running
```bash
npm start
# The API server starts automatically on port 3001
```

### 2. Configure Firewall (if using UFW)
```bash
# Allow port 3001
sudo ufw allow 3001

# Check status
sudo ufw status
```

### 3. Router Port Forwarding (TP-Link)

1. Access your router's web interface:
   - Open browser and go to `192.168.1.1` (or `192.168.0.1`)
   - Login with your admin credentials

2. Navigate to port forwarding:
   - Go to **Advanced** → **NAT Forwarding** → **Port Forwarding**

3. Add new port forwarding rule:
   - **Service Name**: Dazza API
   - **Device**: Select your computer from the list
   - **External Port**: 3001
   - **Internal Port**: 3001
   - **Protocol**: TCP
   - **Status**: Enabled

4. Save and apply changes

5. Some routers may require a reboot

### 4. Verify Dynamic DNS
- Ensure `seg.tplinkdns.com` is pointing to your current public IP
- Check at: https://www.tplinkdns.com/

### 5. Test Connection
```bash
# Run the diagnostic script
node check-api-access.js
```

### 6. Enable Dynamic Gallery
To enable the dynamic gallery with API integration:

```bash
# Set environment variable
export ENABLE_DYNAMIC_GALLERY=true

# Or add to .env file
echo "ENABLE_DYNAMIC_GALLERY=true" >> .env

# Restart the bot
npm start
```

## Security Considerations

### Current Security Features
- CORS enabled (only allows GitHub Pages domain)
- Rate limiting on API endpoints
- WebSocket authentication ready
- Gallery lock protection

### Recommended Additional Security
1. **Use HTTPS** (requires SSL certificate)
2. **Add API authentication**
3. **Implement IP whitelisting**
4. **Monitor access logs**

## Troubleshooting

### Connection Refused
- Check if bot is running: `ps aux | grep node`
- Verify port is listening: `netstat -tuln | grep 3001`
- Check firewall: `sudo ufw status`
- Verify port forwarding in router

### CORS Errors
- The API already allows `https://hildolfr.github.io`
- Check browser console for specific CORS errors
- Ensure you're using HTTPS for GitHub Pages

### ISP Blocking
Some ISPs block incoming connections:
- Try a different port (80, 443, 8080)
- Use a VPN or tunneling service
- Consider cloud hosting

## API Endpoints

Once connected, these endpoints are available:

### Gallery Endpoints
- `GET /api/v1/gallery/images/:username` - Get user's images
- `GET /api/v1/gallery/activity` - Recent gallery activity
- `GET /api/v1/gallery/stats` - Gallery statistics
- `DELETE /api/v1/gallery/images` - Delete an image
- `GET /api/v1/gallery/locks` - Get lock statuses
- `PUT /api/v1/gallery/locks/:username` - Update lock status

### WebSocket Events
- `gallery:image:added` - New image posted
- `gallery:image:deleted` - Image deleted
- `gallery:lock:changed` - Lock status changed

## Testing the API

Test from command line:
```bash
# Test health endpoint
curl http://seg.tplinkdns.com:3001/api/v1/health

# Test gallery stats
curl http://seg.tplinkdns.com:3001/api/v1/gallery/stats
```

Test from browser console:
```javascript
fetch('http://seg.tplinkdns.com:3001/api/v1/gallery/stats')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```