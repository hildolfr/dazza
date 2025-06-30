import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GALLERY_PATH = path.join(__dirname, '../../docs/gallery');

class GalleryGenerator {
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

.copy-url-btn:active {
    transform: scale(0.95);
}

.copy-url-btn.copied {
    background: rgba(255, 0, 255, 0.3);
    color: #ffff00;
    border-color: #ffff00;
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

.pruned-section {
    margin-top: 100px;
    padding: 20px;
    border: 2px solid #ff0000;
    background: rgba(255, 0, 0, 0.1);
}

.pruned-section h2 {
    color: #ff0000;
    margin-bottom: 20px;
}

.pruned-list {
    list-style: none;
}

.pruned-item {
    margin-bottom: 10px;
    color: #ff6666;
    font-size: 0.9em;
}

.no-images {
    text-align: center;
    color: #666;
    font-style: italic;
    padding: 40px;
}

.flash-text {
    animation: flash 0.5s ease-in-out infinite;
}

@keyframes flash {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
}
`;
    }

    generateJs() {
        return `
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('imageModal');
    const modalContent = document.getElementById('modalImage');
    const closeBtn = document.querySelector('.close');
    
    // Open modal when image is clicked (but not on button click)
    document.querySelectorAll('.image-item img, .image-item video').forEach(media => {
        media.addEventListener('click', function() {
            const imgSrc = this.src;
            const isVideo = this.tagName === 'VIDEO';
            
            if (isVideo) {
                modalContent.innerHTML = '<video src="' + imgSrc + '" controls autoplay></video>';
            } else {
                modalContent.innerHTML = '<img src="' + imgSrc + '" alt="Gallery image">';
            }
            
            modal.classList.add('active');
        });
    });
    
    // Copy URL functionality
    document.querySelectorAll('.copy-url-btn').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.stopPropagation(); // Prevent modal from opening
            const url = this.getAttribute('data-url');
            
            try {
                await navigator.clipboard.writeText(url);
                
                // Visual feedback
                const originalText = this.textContent;
                this.textContent = 'COPIED!';
                this.classList.add('copied');
                
                setTimeout(() => {
                    this.textContent = originalText;
                    this.classList.remove('copied');
                }, 2000);
            } catch (err) {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = url;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                document.body.appendChild(textArea);
                textArea.select();
                
                try {
                    document.execCommand('copy');
                    this.textContent = 'COPIED!';
                    this.classList.add('copied');
                    
                    setTimeout(() => {
                        this.textContent = 'GRAB URL';
                        this.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    this.textContent = 'COPY FAILED!';
                }
                
                document.body.removeChild(textArea);
            }
        });
    });
    
    // Close modal
    closeBtn.addEventListener('click', function() {
        modal.classList.remove('active');
        modalContent.innerHTML = '';
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.classList.remove('active');
            modalContent.innerHTML = '';
        }
    });
    
    // Add random glitch effect
    setInterval(function() {
        const elements = document.querySelectorAll('.user-section h2');
        const randomElement = elements[Math.floor(Math.random() * elements.length)];
        if (randomElement) {
            randomElement.style.transform = 'translateX(' + (Math.random() * 4 - 2) + 'px)';
            setTimeout(() => {
                randomElement.style.transform = 'translateX(0)';
            }, 100);
        }
    }, 3000);
});
`;
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('en-AU');
    }

    isVideoUrl(url) {
        return url.toLowerCase().includes('.webm');
    }

    generateImageHtml(image) {
        const formattedTime = this.formatTimestamp(image.timestamp);
        const isVideo = this.isVideoUrl(image.url);
        
        if (isVideo) {
            return `
                <div class="image-item">
                    <video src="${image.url}" muted loop preload="metadata"></video>
                    <div class="image-controls">
                        <div class="timestamp">${formattedTime}</div>
                        <button class="copy-url-btn" data-url="${image.url}">GRAB URL</button>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="image-item">
                    <img src="${image.url}" alt="Posted by ${image.username}" loading="lazy">
                    <div class="image-controls">
                        <div class="timestamp">${formattedTime}</div>
                        <button class="copy-url-btn" data-url="${image.url}">GRAB URL</button>
                    </div>
                </div>
            `;
        }
    }

    async generateGalleryHtml() {
        const activeImages = await this.db.getAllUserImagesGrouped(true);
        const prunedImages = await this.db.getPrunedImages();
        
        let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dazza's Fuckin' Art Gallery</title>
    <style>${this.generateCss()}</style>
</head>
<body>
    <div class="header">
        <h1>🍺 Dazza's Fuckin' Art Gallery 🍺</h1>
        <p class="subtitle flash-text">ALL THE SHIT YOU CUNTS POST</p>
    </div>
`;

        // Generate sections for each user
        const users = Object.keys(activeImages).sort();
        
        if (users.length === 0) {
            html += '<div class="no-images">No fuckin\' images yet, ya lazy cunts!</div>';
        } else {
            for (const username of users) {
                const userImages = activeImages[username];
                if (userImages.length > 0) {
                    html += `
    <div class="user-section">
        <h2>${username}'s Collection (${userImages.length} ${userImages.length === 1 ? 'pic' : 'pics'})</h2>
        <div class="gallery-grid">
`;
                    
                    for (const image of userImages) {
                        html += this.generateImageHtml(image);
                    }
                    
                    html += `
        </div>
    </div>
`;
                }
            }
        }

        // Add pruned images section if any exist
        if (prunedImages.length > 0) {
            html += `
    <div class="pruned-section">
        <h2>🚫 Dead Links (RIP) 🚫</h2>
        <ul class="pruned-list">
`;
            for (const image of prunedImages) {
                html += `
            <li class="pruned-item">
                <strong>${image.username}</strong> - ${image.url} 
                <em>(${image.pruned_reason || 'Link broken'})</em>
            </li>
`;
            }
            html += `
        </ul>
    </div>
`;
        }

        html += `
    <div class="modal" id="imageModal">
        <span class="close">&times;</span>
        <div class="modal-content" id="modalImage"></div>
    </div>
    
    <script>${this.generateJs()}</script>
</body>
</html>`;

        return html;
    }

    async updateGallery() {
        await this.ensureGalleryDirectory();
        
        const html = await this.generateGalleryHtml();
        const indexPath = path.join(GALLERY_PATH, 'index.html');
        
        await fs.writeFile(indexPath, html, 'utf8');
        
        return indexPath;
    }
}

export default GalleryGenerator;