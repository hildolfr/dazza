import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GALLERY_PATH = path.join(__dirname, '../../docs/gallery');

class DynamicGalleryGenerator {
    constructor(database) {
        this.db = database;
    }

    async ensureGalleryDirectory() {
        try {
            await fs.mkdir(GALLERY_PATH, { recursive: true });
        } catch (error) {
            console.error('Failed to create gallery directory:', error);
        }
    }

    generateCss() {
        return `
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    background: #1a1a1a;
    color: #00ff00;
    font-family: 'Courier New', monospace;
    padding: 20px;
    min-height: 100vh;
}

.api-status {
    position: fixed;
    top: 10px;
    right: 10px;
    padding: 10px 15px;
    background: rgba(0, 0, 0, 0.8);
    border: 2px solid #00ff00;
    border-radius: 5px;
    font-size: 0.9em;
    z-index: 1000;
}

.api-status.connected {
    border-color: #00ff00;
    color: #00ff00;
}

.api-status.disconnected {
    border-color: #ff0000;
    color: #ff0000;
}

.api-status.connecting {
    border-color: #ffff00;
    color: #ffff00;
}

.header {
    text-align: center;
    margin-bottom: 40px;
    animation: glow 2s ease-in-out infinite alternate;
}

@keyframes glow {
    from { text-shadow: 0 0 10px #00ff00, 0 0 20px #00ff00, 0 0 30px #00ff00; }
    to { text-shadow: 0 0 20px #00ff00, 0 0 30px #00ff00, 0 0 40px #00ff00; }
}

h1 {
    font-size: 3em;
    margin-bottom: 10px;
    text-transform: uppercase;
}

.subtitle {
    font-size: 1.2em;
    color: #ffff00;
    animation: blink 1s step-end infinite;
}

@keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
}

.live-indicator {
    display: inline-block;
    width: 10px;
    height: 10px;
    background: #ff0000;
    border-radius: 50%;
    margin-left: 10px;
    animation: pulse 2s infinite;
}

.live-indicator.active {
    background: #00ff00;
}

@keyframes pulse {
    0% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.2); }
    100% { opacity: 1; transform: scale(1); }
}

.stats-bar {
    text-align: center;
    margin-bottom: 30px;
    padding: 15px;
    background: rgba(0, 255, 0, 0.1);
    border: 1px solid #00ff00;
}

.stats-bar span {
    margin: 0 15px;
}

.activity-feed {
    position: fixed;
    left: 10px;
    top: 100px;
    width: 300px;
    max-height: 400px;
    background: rgba(0, 0, 0, 0.9);
    border: 2px solid #00ff00;
    padding: 15px;
    overflow-y: auto;
    display: none;
}

.activity-feed.active {
    display: block;
}

.activity-feed h3 {
    color: #ff00ff;
    margin-bottom: 10px;
}

.activity-item {
    margin-bottom: 10px;
    padding: 5px;
    border-bottom: 1px solid #333;
    font-size: 0.9em;
}

.activity-item.added {
    color: #00ff00;
}

.activity-item.deleted {
    color: #ff0000;
}

.user-section {
    margin-bottom: 60px;
    border: 2px dashed #00ff00;
    padding: 20px;
    background: rgba(0, 255, 0, 0.05);
}

.user-section h2 {
    color: #ff00ff;
    margin-bottom: 20px;
    font-size: 2em;
    text-shadow: 2px 2px 4px #000;
}

.gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 20px;
}

.image-item {
    position: relative;
    overflow: hidden;
    border: 3px solid #00ff00;
    background: #000;
    cursor: pointer;
    transition: all 0.3s ease;
    height: 250px;
}

.image-item.new-image {
    animation: newImageFlash 2s ease-out;
}

@keyframes newImageFlash {
    0% { border-color: #ffff00; box-shadow: 0 0 20px #ffff00; }
    100% { border-color: #00ff00; box-shadow: none; }
}

.image-item:hover {
    transform: scale(1.05) rotate(2deg);
    border-color: #ff00ff;
    box-shadow: 0 0 20px #ff00ff;
}

.image-item img, .image-item video {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.image-controls {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    flex-direction: column;
}

.timestamp {
    color: #00ff00;
    padding: 5px;
    font-size: 0.8em;
    text-align: center;
    border-bottom: 1px solid #00ff00;
}

.copy-url-btn {
    background: rgba(0, 255, 0, 0.1);
    border: 1px solid #00ff00;
    color: #00ff00;
    padding: 8px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.9em;
    transition: all 0.3s ease;
    text-transform: uppercase;
}

.copy-url-btn:hover {
    background: rgba(0, 255, 0, 0.3);
    color: #ff00ff;
    border-color: #ff00ff;
    text-shadow: 0 0 5px #ff00ff;
}

.delete-btn {
    background: rgba(255, 0, 0, 0.1);
    border: 1px solid #ff0000;
    color: #ff0000;
    padding: 8px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.9em;
    transition: all 0.3s ease;
    text-transform: uppercase;
}

.delete-btn:hover {
    background: rgba(255, 0, 0, 0.3);
    color: #ffffff;
    text-shadow: 0 0 5px #ff0000;
}

.delete-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.modal {
    display: none;
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
}

.modal.active {
    display: flex;
    align-items: center;
    justify-content: center;
}

.modal-content {
    max-width: 90%;
    max-height: 90%;
    position: relative;
}

.modal-content img, .modal-content video {
    max-width: 100%;
    max-height: 90vh;
    border: 5px solid #00ff00;
    box-shadow: 0 0 30px #00ff00;
}

.close {
    position: absolute;
    top: -40px;
    right: -40px;
    color: #ff0000;
    font-size: 40px;
    font-weight: bold;
    cursor: pointer;
    text-shadow: 0 0 10px #ff0000;
}

.close:hover {
    color: #ff00ff;
    transform: rotate(180deg);
    transition: all 0.3s ease;
}

.loading {
    text-align: center;
    padding: 40px;
    color: #ffff00;
}

.error-message {
    text-align: center;
    padding: 40px;
    color: #ff0000;
    border: 2px solid #ff0000;
    background: rgba(255, 0, 0, 0.1);
    margin: 20px;
}

.toggle-activity {
    position: fixed;
    left: 10px;
    top: 60px;
    background: rgba(0, 255, 0, 0.2);
    border: 1px solid #00ff00;
    color: #00ff00;
    padding: 8px 15px;
    cursor: pointer;
    font-family: inherit;
    z-index: 1000;
}

.toggle-activity:hover {
    background: rgba(0, 255, 0, 0.3);
}
`;
    }

    generateJs() {
        return `
// Configuration
const API_BASE = window.location.protocol === 'https:' 
    ? 'https://seg.tplinkdns.com:3001' 
    : 'http://seg.tplinkdns.com:3001';
const WS_URL = window.location.protocol === 'https:' 
    ? 'wss://seg.tplinkdns.com:3001' 
    : 'ws://seg.tplinkdns.com:3001';
const FALLBACK_MODE = true; // Use static content if API fails

// Global state
let apiConnected = false;
let ws = null;
let galleryData = {};
let activityFeedVisible = false;
let lockStatus = {};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎨 Dynamic Gallery Initializing...');
    
    // Try to connect to API
    initializeAPI();
    
    // Setup UI handlers
    setupUIHandlers();
    
    // Load initial data
    loadGalleryData();
});

async function initializeAPI() {
    updateAPIStatus('connecting');
    
    try {
        // Test API connection
        const response = await fetch(\`\${API_BASE}/api/v1/health\`, {
            mode: 'cors',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (response.ok) {
            apiConnected = true;
            updateAPIStatus('connected');
            console.log('✅ API Connected');
            
            // Initialize WebSocket
            initializeWebSocket();
            
            // Load gallery stats
            loadGalleryStats();
        } else {
            throw new Error('API not responding');
        }
    } catch (error) {
        console.error('❌ API Connection Failed:', error);
        apiConnected = false;
        updateAPIStatus('disconnected');
        
        if (FALLBACK_MODE) {
            console.log('📄 Using static gallery content');
        }
    }
}

function initializeWebSocket() {
    if (!apiConnected) return;
    
    console.log('🔌 Connecting to WebSocket...');
    
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
        console.log('✅ WebSocket Connected');
        
        // Subscribe to gallery events
        ws.send(JSON.stringify({
            type: 'subscribe',
            topics: ['gallery']
        }));
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    };
    
    ws.onerror = (error) => {
        console.error('❌ WebSocket Error:', error);
    };
    
    ws.onclose = () => {
        console.log('🔌 WebSocket Disconnected');
        apiConnected = false;
        updateAPIStatus('disconnected');
        
        // Attempt reconnection after 5 seconds
        setTimeout(initializeAPI, 5000);
    };
}

function handleWebSocketMessage(data) {
    console.log('📨 WebSocket Event:', data.type);
    
    switch (data.type) {
        case 'gallery:image:added':
            handleNewImage(data.data);
            break;
            
        case 'gallery:image:deleted':
            handleImageDeleted(data.data);
            break;
            
        case 'gallery:lock:changed':
            handleLockChanged(data.data);
            break;
            
        case 'welcome':
            console.log('👋 WebSocket Welcome:', data);
            break;
    }
}

function handleNewImage(data) {
    console.log('🖼️ New image:', data);
    
    // Add to activity feed
    addActivityItem(\`\${data.username} posted a new image\`, 'added');
    
    // Flash notification
    showNotification(\`New image from \${data.username}!\`);
    
    // Reload gallery section for this user
    if (galleryData[data.username]) {
        loadUserImages(data.username);
    }
}

function handleImageDeleted(data) {
    console.log('❌ Image deleted:', data);
    
    // Add to activity feed
    addActivityItem(\`Image deleted from \${data.username}'s gallery\`, 'deleted');
    
    // Remove image from DOM
    const imageElement = document.querySelector(\`.image-item[data-url="\${data.url}"]\`);
    if (imageElement) {
        imageElement.style.animation = 'fadeOut 0.5s';
        setTimeout(() => imageElement.remove(), 500);
    }
}

function handleLockChanged(data) {
    console.log('🔒 Lock status changed:', data);
    
    lockStatus[data.username] = data.locked;
    
    // Update UI
    const lockElement = document.querySelector(\`.user-section[data-username="\${data.username}"] .lock-status\`);
    if (lockElement) {
        lockElement.textContent = data.locked ? '🔒 LOCKED' : '🔓 UNLOCKED';
        lockElement.className = \`lock-status \${data.locked ? 'locked' : 'unlocked'}\`;
    }
}

async function loadGalleryData() {
    if (apiConnected) {
        try {
            // Load lock status
            const locksResponse = await fetch(\`\${API_BASE}/api/v1/gallery/locks\`);
            if (locksResponse.ok) {
                const locksData = await locksResponse.json();
                locksData.data.locks.forEach(lock => {
                    lockStatus[lock.username] = lock.isLocked;
                });
            }
            
            // Load images for each user (would need user list endpoint)
            // For now, use static content and enhance with API data
        } catch (error) {
            console.error('Failed to load gallery data:', error);
        }
    }
}

async function loadGalleryStats() {
    if (!apiConnected) return;
    
    try {
        const response = await fetch(\`\${API_BASE}/api/v1/gallery/stats\`);
        if (response.ok) {
            const data = await response.json();
            updateStatsBar(data.data.overview);
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

function updateStatsBar(stats) {
    const statsBar = document.getElementById('statsBar');
    if (statsBar && stats) {
        statsBar.innerHTML = \`
            <span>👥 Users: \${stats.totalUsers}</span>
            <span>🖼️ Total Images: \${stats.totalImages}</span>
            <span>✅ Active: \${stats.activeImages}</span>
            <span>❌ Deleted: \${stats.deletedImages}</span>
        \`;
    }
}

async function deleteImage(url, username) {
    if (!apiConnected) {
        showNotification('API not connected!', 'error');
        return;
    }
    
    // Check if gallery is locked
    if (lockStatus[username]) {
        showNotification('Gallery is locked!', 'error');
        return;
    }
    
    try {
        const response = await fetch(\`\${API_BASE}/api/v1/gallery/images\`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: url,
                reason: 'Deleted via gallery interface'
            })
        });
        
        if (response.ok) {
            showNotification('Image deleted successfully!', 'success');
            // WebSocket will handle UI update
        } else if (response.status === 403) {
            showNotification('Gallery is locked!', 'error');
        } else {
            throw new Error('Delete failed');
        }
    } catch (error) {
        console.error('Delete error:', error);
        showNotification('Failed to delete image', 'error');
    }
}

function setupUIHandlers() {
    const modal = document.getElementById('imageModal');
    const modalContent = document.getElementById('modalImage');
    const closeBtn = document.querySelector('.close');
    const toggleBtn = document.getElementById('toggleActivity');
    
    // Image click handler
    document.addEventListener('click', function(e) {
        if (e.target.matches('.image-item img, .image-item video')) {
            const imgSrc = e.target.src;
            const isVideo = e.target.tagName === 'VIDEO';
            
            if (isVideo) {
                modalContent.innerHTML = '<video src="' + imgSrc + '" controls autoplay></video>';
            } else {
                modalContent.innerHTML = '<img src="' + imgSrc + '" alt="Gallery image">';
            }
            
            modal.classList.add('active');
        }
        
        // Delete button handler
        if (e.target.matches('.delete-btn')) {
            const url = e.target.getAttribute('data-url');
            const username = e.target.getAttribute('data-username');
            
            if (confirm('Delete this image?')) {
                deleteImage(url, username);
            }
        }
        
        // Copy URL handler
        if (e.target.matches('.copy-url-btn')) {
            e.stopPropagation();
            const url = e.target.getAttribute('data-url');
            copyToClipboard(url, e.target);
        }
    });
    
    // Modal close handlers
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            modalContent.innerHTML = '';
        });
    }
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            modalContent.innerHTML = '';
        }
    });
    
    // Activity feed toggle
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            activityFeedVisible = !activityFeedVisible;
            document.getElementById('activityFeed').classList.toggle('active', activityFeedVisible);
        });
    }
}

async function copyToClipboard(text, button) {
    try {
        await navigator.clipboard.writeText(text);
        
        const originalText = button.textContent;
        button.textContent = 'COPIED!';
        button.classList.add('copied');
        
        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
        }, 2000);
    } catch (err) {
        // Fallback method
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            button.textContent = 'COPIED!';
        } catch (err) {
            button.textContent = 'COPY FAILED!';
        }
        
        document.body.removeChild(textArea);
    }
}

function updateAPIStatus(status) {
    const statusElement = document.getElementById('apiStatus');
    if (statusElement) {
        statusElement.className = \`api-status \${status}\`;
        statusElement.innerHTML = \`
            API: \${status.toUpperCase()}
            <span class="live-indicator \${status === 'connected' ? 'active' : ''}"></span>
        \`;
    }
}

function addActivityItem(message, type) {
    const feed = document.getElementById('activityList');
    if (!feed) return;
    
    const item = document.createElement('div');
    item.className = \`activity-item \${type}\`;
    item.textContent = \`[\${new Date().toLocaleTimeString()}] \${message}\`;
    
    feed.insertBefore(item, feed.firstChild);
    
    // Keep only last 20 items
    while (feed.children.length > 20) {
        feed.removeChild(feed.lastChild);
    }
}

function showNotification(message, type = 'info') {
    // Simple notification (can be enhanced with a proper notification library)
    const notification = document.createElement('div');
    notification.style.cssText = \`
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 15px 25px;
        background: \${type === 'error' ? 'rgba(255,0,0,0.8)' : 'rgba(0,255,0,0.8)'};
        color: white;
        border-radius: 5px;
        z-index: 2000;
        animation: slideDown 0.3s ease-out;
    \`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = \`
    @keyframes fadeOut {
        to { opacity: 0; transform: scale(0.8); }
    }
    @keyframes slideDown {
        from { transform: translate(-50%, -100%); }
        to { transform: translate(-50%, 0); }
    }
    @keyframes slideUp {
        from { transform: translate(-50%, 0); }
        to { transform: translate(-50%, -100%); }
    }
\`;
document.head.appendChild(style);
`;
    }

    generateEnhancedHtml(staticHtml) {
        // Parse the existing static HTML and enhance it
        const enhancedHtml = staticHtml.replace('</head>', `
    <style>${this.generateCss()}</style>
</head>`);

        // Add API status indicator and activity feed
        const bodyEnhancements = `
    <div id="apiStatus" class="api-status disconnected">
        API: CONNECTING...
        <span class="live-indicator"></span>
    </div>
    
    <button id="toggleActivity" class="toggle-activity">📊 Activity Feed</button>
    
    <div id="activityFeed" class="activity-feed">
        <h3>🔴 LIVE Activity</h3>
        <div id="activityList"></div>
    </div>
    
    <div id="statsBar" class="stats-bar">
        <span>Loading stats...</span>
    </div>
`;

        const enhancedBody = enhancedHtml.replace('<body>', '<body>' + bodyEnhancements);
        
        // Add the dynamic JavaScript
        return enhancedBody.replace('</body>', `
    <script>${this.generateJs()}</script>
</body>`);
    }

    async generateDynamicGallery() {
        // First generate static gallery as fallback
        const GalleryGenerator = (await import('./galleryGenerator.js')).default;
        const galleryGenerator = new GalleryGenerator(this.db);
        const staticHtml = await galleryGenerator.generateGalleryHtml();
        
        // Enhance with dynamic features
        const dynamicHtml = this.generateEnhancedHtml(staticHtml);
        
        return dynamicHtml;
    }

    async updateGallery() {
        await this.ensureGalleryDirectory();
        
        const html = await this.generateDynamicGallery();
        const indexPath = path.join(GALLERY_PATH, 'index.html');
        
        await fs.writeFile(indexPath, html, 'utf8');
        
        return indexPath;
    }
}

export default DynamicGalleryGenerator;