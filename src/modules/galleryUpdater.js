import GalleryGenerator from '../services/galleryGenerator.js';
import gitService from '../services/git.js';
import fetch from 'node-fetch';

class GalleryUpdater {
    constructor(database, logger) {
        this.db = database;
        this.logger = logger;
        this.generator = new GalleryGenerator(database);
        this.updateInterval = 5 * 60 * 1000; // 5 minutes
        this.intervalId = null;
        this.isUpdating = false;
        this.lastUpdateHash = null;
    }

    async checkImageHealth(url) {
        try {
            const response = await fetch(url, {
                method: 'HEAD',
                timeout: 5000
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async pruneDeadImages() {
        const images = await this.db.getUserImages(null, true);
        let prunedCount = 0;
        
        for (const image of images) {
            const isHealthy = await this.checkImageHealth(image.url);
            if (!isHealthy) {
                await this.db.pruneUserImage(image.url, 'Link broken - 404 or timeout');
                prunedCount++;
                this.logger.info(`Pruned dead image: ${image.url}`);
            }
        }
        
        return prunedCount;
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

            // Prune dead images first
            const prunedCount = await this.pruneDeadImages();
            if (prunedCount > 0) {
                this.logger.info(`Pruned ${prunedCount} dead images`);
            }

            // Generate the gallery HTML
            const galleryPath = await this.generator.updateGallery();
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
                this.logger.error('Failed to push gallery update:', gitResult.error);
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