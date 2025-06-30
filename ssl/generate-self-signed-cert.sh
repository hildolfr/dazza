#!/bin/bash

# Generate a self-signed SSL certificate for testing
# DO NOT use this in production - use proper certificates from Let's Encrypt or another CA

echo "Generating self-signed SSL certificate for testing..."

# Generate private key
openssl genrsa -out server.key 2048

# Generate certificate signing request
openssl req -new -key server.key -out server.csr -subj "/C=AU/ST=NSW/L=Sydney/O=Dazza Bot/CN=localhost"

# Generate self-signed certificate (valid for 365 days)
openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt

# Clean up CSR file
rm server.csr

echo "Self-signed certificate generated!"
echo "Files created:"
echo "  - server.key (private key)"
echo "  - server.crt (certificate)"
echo ""
echo "WARNING: This is a self-signed certificate for development only!"
echo "Browsers will show security warnings when accessing the HTTPS server."
echo ""
echo "For production, use certificates from Let's Encrypt or another trusted CA."