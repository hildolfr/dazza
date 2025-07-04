import GalleryGenerator from '../services/galleryGenerator.js';
import DynamicGalleryGenerator from '../services/dynamicGalleryGenerator.js';
import gitService from '../services/git.js';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class GalleryUpdater {
    constructor(database, logger) {
        this.db = database;
        this.logger = logger;
        this.generator = new GalleryGenerator(database);
        this.dynamicGenerator = new DynamicGalleryGenerator(database);
        this.useDynamicGallery = process.env.ENABLE_DYNAMIC_GALLERY === 'true';
        this.updateInterval = 5 * 60 * 1000; // 5 minutes
        this.intervalId = null;
        this.isUpdating = false;
        this.lastUpdateHash = null;
    }

    async checkImageHealth(url) {
        try {
            // Try GET request instead of HEAD (more compatible)
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; DazzaBot/1.0)'
                },
                timeout: 10000, // Increase timeout to 10 seconds
                redirect: 'follow'
            });
            
            // Check if response is ok (2xx status)
            if (!response.ok) {
                // Only mark as unhealthy for specific error codes
                if (response.status === 404 || response.status === 410) {
                    return false;
                }
                // For other errors (403, 500, etc), assume image is still valid
                return true;
            }
            
            return true;
        } catch (error) {
            // Network errors or timeouts - don't prune these
            // Could be temporary issues or CORS restrictions
            this.logger.debug(`Skipping health check for ${url}: ${error.message}`);
            return true; // Assume healthy on error
        }
    }

    async pruneDeadImages() {
        const images = await this.db.getUserImages(null, true);
        let prunedCount = 0;
        const minAgeForPruning = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        const now = Date.now();
        
        for (const image of images) {
            // Only check images older than 24 hours
            const imageAge = now - image.timestamp;
            if (imageAge < minAgeForPruning) {
                continue; // Skip recent images
            }
            
            const isHealthy = await this.checkImageHealth(image.url);
            if (!isHealthy) {
                await this.db.pruneUserImage(image.url, 'Link broken - 404 not found');
                prunedCount++;
                this.logger.info(`Pruned dead image: ${image.url}`);
            }
        }
        
        return prunedCount;
    }

    async processPendingDeletions() {
        const galleryPath = path.join(__dirname, '../../docs/gallery/index.html');
        
        try {
            const html = await fs.readFile(galleryPath, 'utf8');
            const dom = new JSDOM(html);
            const document = dom.window.document;
            
            // Find all images marked for deletion
            const markedElements = document.querySelectorAll('.image-item.marked-for-deletion');
            const deletions = [];
            
            markedElements.forEach(element => {
                const url = element.getAttribute('data-url');
                const deleteBtn = element.querySelector('.delete-btn');
                const username = deleteBtn ? deleteBtn.getAttribute('data-username') : 'Unknown';
                
                if (url) {
                    deletions.push({ url, username });
                }
            });
            
            // Process each deletion
            for (const { url, username } of deletions) {
                await this.db.pruneUserImage(url, `Deleted via gallery by community`);
                this.logger.info(`Processed deletion: ${url} from ${username}'s gallery`);
            }
            
            return deletions.length;
        } catch (error) {
            // File might not exist yet or be malformed
            this.logger.debug('No pending deletions found or error reading gallery:', error.message);
            return 0;
        }
    }

    async generateContentHash() {
        const images = await this.db.getAllUserImagesGrouped(true);
        const prunedImages = await this.db.getPrunedImages();
        
        // Create a simple hash of the content
        const content = JSON.stringify({ images, prunedImages });
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(16);
    }

    async update() {
        if (this.isUpdating) {
            this.logger.debug('Gallery update already in progress, skipping');
            return;
        }

        this.isUpdating = true;

        try {
            // Check if content has changed
            const currentHash = await this.generateContentHash();
            if (currentHash === this.lastUpdateHash) {
                this.logger.debug('Gallery content unchanged, skipping update');
                this.isUpdating = false;
                return;
            }

            this.logger.info('Starting gallery update');
            
            // Process pending deletions first
            const deletedCount = await this.processPendingDeletions();
            if (deletedCount > 0) {
                this.logger.info(`Processed ${deletedCount} pending deletions from gallery`);
            }

            // Prune dead images
            const prunedCount = await this.pruneDeadImages();
            if (prunedCount > 0) {
                this.logger.info(`Pruned ${prunedCount} dead images`);
            }

            // Generate the gallery HTML
            let galleryPath;
            if (this.useDynamicGallery) {
                this.logger.info('Generating dynamic gallery with API integration');
                galleryPath = await this.dynamicGenerator.updateGallery();
            } else {
                galleryPath = await this.generator.updateGallery();
            }
            this.logger.info(`Gallery HTML generated at ${galleryPath}`);

            // Commit and push changes
            const gitResult = await gitService.commitAndPush(
                'docs/gallery/',
                `Update gallery - ${new Date().toLocaleString('en-AU')}`,
                'main'
            );

            if (gitResult.success) {
                if (gitResult.nothingToCommit) {
                    this.logger.debug('No changes to commit to gallery');
                } else {
                    this.logger.info('Gallery updated and pushed to GitHub');
                }
                this.lastUpdateHash = currentHash;
            } else {
                // Log only the error message, not the full error object
                const errorMsg = typeof gitResult.error === 'string' ? gitResult.error : 'Unknown error';
                this.logger.error('Failed to push gallery update:', errorMsg.split('\n')[0]); // Only first line
            }

        } catch (error) {
            this.logger.error('Gallery update failed:', error);
        } finally {
            this.isUpdating = false;
        }
    }

    start() {
        if (this.intervalId) {
            this.logger.warn('Gallery updater already running');
            return;
        }

        // Run initial update
        this.update();

        // Set up periodic updates
        this.intervalId = setInterval(() => {
            this.update();
        }, this.updateInterval);

        this.logger.info('Gallery updater started (5-minute intervals)');
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.logger.info('Gallery updater stopped');
        }
    }
}

export default GalleryUpdater;