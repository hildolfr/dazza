# SSL Setup for Dazza Bot API

This directory contains SSL certificates for enabling HTTPS on the API server.

## ⚠️ IMPORTANT SECURITY NOTICE

**NEVER commit SSL certificates or private keys to version control!**

- All `.crt`, `.key`, `.pem`, and `.csr` files in this directory are ignored by git
- If you accidentally commit certificates, you must regenerate them immediately
- The current certificates in this directory are for local use only

## Quick Start

### For Development (Self-Signed Certificate)

1. Generate a self-signed certificate:
   ```bash
   ./generate-self-signed-cert.sh
   ```

2. The bot will automatically detect the certificates and enable HTTPS on port 3443.

### For Production (Let's Encrypt)

For production use, you should use proper SSL certificates from Let's Encrypt or another trusted CA:

1. Install certbot:
   ```bash
   sudo apt-get update
   sudo apt-get install certbot
   ```

2. Generate certificates (replace `yourdomain.com` with your actual domain):
   ```bash
   sudo certbot certonly --standalone -d yourdomain.com
   ```

3. Copy the certificates to this directory:
   ```bash
   sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./server.key
   sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./server.crt
   sudo chown $USER:$USER server.key server.crt
   sudo chmod 600 server.key
   ```

## Configuration

- **Port**: 3001 (used for both HTTP and HTTPS)
- The server automatically uses HTTPS when SSL certificates are present
- Falls back to HTTP when certificates are not found

## Files

- `server.key` - Private key (keep this secret!)
- `server.crt` - SSL certificate
- `generate-self-signed-cert.sh` - Script to generate self-signed certificates for development

## Security Notes

- Never commit SSL private keys to version control
- The `.gitignore` file is configured to exclude all certificate files
- For production, always use certificates from a trusted CA
- Self-signed certificates will show browser warnings - this is normal for development