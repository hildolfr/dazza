import { Router } from 'express';
import { asyncHandler, ValidationError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { strictCorsMiddleware } from '../middleware/cors.js';
import { extractImageMetadata } from '../../services/imageMetadata.js';

export function createGalleryRoutes(apiServer) {
    const router = Router();
    
    // Apply strict CORS to all gallery routes
    router.use(strictCorsMiddleware(apiServer));
    
    // DELETE /api/v1/gallery/images - Mark an image as deleted
    router.delete('/images', asyncHandler(async (req, res) => {
        const { url, username, reason = 'Deleted via gallery' } = req.body;
        
        // Validate input
        if (!url) {
            throw new ValidationError('URL is required', 'url');
        }
        
        if (!username) {
            throw new ValidationError('Username is required', 'username');
        }
        
        if (typeof url !== 'string' || !url.trim()) {
            throw new ValidationError('URL must be a non-empty string', 'url');
        }
        
        if (typeof username !== 'string' || !username.trim()) {
            throw new ValidationError('Username must be a non-empty string', 'username');
        }
        
        // Find the image in database
        const image = await apiServer.bot.db.get(
            `SELECT 
                ui.*,
                gl.is_locked 
            FROM user_images ui
            LEFT JOIN user_gallery_locks gl ON ui.username = gl.username
            WHERE ui.url = ? AND ui.username = ? AND ui.is_active = 1`,
            [url, username.toLowerCase()]
        );
        
        if (!image) {
            throw new NotFoundError('Image');
        }
        
        // Check if user's gallery is locked
        if (image.is_locked) {
            throw new ForbiddenError(`Gallery for user ${image.username} is locked`);
        }
        
        // Mark image as deleted
        await apiServer.bot.db.run(
            'UPDATE user_images SET is_active = 0, pruned_reason = ? WHERE url = ? AND username = ?',
            [reason, url, username.toLowerCase()]
        );
        
        // Log the deletion
        apiServer.bot.logger.info(`[API] Image deleted: ${url} (user: ${image.username}, originalPoster: ${image.original_poster}, reason: ${reason})`);
        
        // Broadcast deletion event via WebSocket
        apiServer.broadcast('gallery:image:deleted', {
            url,
            username: image.username,
            originalPoster: image.original_poster,
            reason,
            timestamp: Date.now()
        });
        
        res.json({
            success: true,
            data: {
                message: 'Image marked as deleted',
                url,
                username: image.username,
                originalPoster: image.original_poster
            }
        });
    }));
    
    // GET /api/v1/gallery/locks - Get all gallery lock statuses
    router.get('/locks', asyncHandler(async (req, res) => {
        const locks = await apiServer.bot.db.all(`
            SELECT 
                gl.username,
                gl.is_locked as isLocked,
                gl.locked_at as lockedAt,
                COUNT(ui.id) as imageCount
            FROM user_gallery_locks gl
            LEFT JOIN user_images ui ON gl.username = ui.username AND ui.is_active = 1
            GROUP BY gl.username
            ORDER BY gl.username ASC
        `);
        
        res.json({
            success: true,
            data: {
                locks: locks.map(lock => ({
                    username: lock.username,
                    isLocked: Boolean(lock.isLocked),
                    lockedAt: lock.lockedAt,
                    imageCount: lock.imageCount
                }))
            }
        });
    }));
    
    // GET /api/v1/gallery/locks/:username - Get specific user's lock status
    router.get('/locks/:username', asyncHandler(async (req, res) => {
        const { username } = req.params;
        
        if (!username) {
            throw new ValidationError('Username is required', 'username');
        }
        
        const lockData = await apiServer.bot.db.get(`
            SELECT 
                gl.username,
                gl.is_locked as isLocked,
                gl.locked_at as lockedAt,
                COUNT(ui.id) as imageCount
            FROM user_gallery_locks gl
            LEFT JOIN user_images ui ON gl.username = ui.username AND ui.is_active = 1
            WHERE gl.username = ?
            GROUP BY gl.username
        `, [username.toLowerCase()]);
        
        if (!lockData) {
            // User has no lock entry, return unlocked status
            const imageCount = await apiServer.bot.db.get(
                'SELECT COUNT(*) as count FROM user_images WHERE username = ? AND is_active = 1',
                [username.toLowerCase()]
            );
            
            res.json({
                success: true,
                data: {
                    username: username.toLowerCase(),
                    isLocked: false,
                    lockedAt: null,
                    imageCount: imageCount.count
                }
            });
            return;
        }
        
        res.json({
            success: true,
            data: {
                username: lockData.username,
                isLocked: Boolean(lockData.isLocked),
                lockedAt: lockData.lockedAt,
                imageCount: lockData.imageCount
            }
        });
    }));
    
    // PUT /api/v1/gallery/locks/:username - Update gallery lock status
    router.put('/locks/:username', asyncHandler(async (req, res) => {
        const { username } = req.params;
        const { locked } = req.body;
        
        // Validate input
        if (!username) {
            throw new ValidationError('Username is required', 'username');
        }
        
        if (typeof locked !== 'boolean') {
            throw new ValidationError('Locked must be a boolean', 'locked');
        }
        
        const normalizedUsername = username.toLowerCase();
        const now = Date.now();
        
        // Check if lock entry exists
        const existing = await apiServer.bot.db.get(
            'SELECT username FROM user_gallery_locks WHERE username = ?',
            [normalizedUsername]
        );
        
        if (existing) {
            // Update existing lock
            await apiServer.bot.db.run(
                'UPDATE user_gallery_locks SET is_locked = ?, locked_at = ? WHERE username = ?',
                [locked ? 1 : 0, locked ? now : null, normalizedUsername]
            );
        } else {
            // Create new lock entry
            await apiServer.bot.db.run(
                'INSERT INTO user_gallery_locks (username, is_locked, locked_at) VALUES (?, ?, ?)',
                [normalizedUsername, locked ? 1 : 0, locked ? now : null]
            );
        }
        
        // Log the change
        apiServer.bot.logger.info(`[API] Gallery lock status changed: ${normalizedUsername} = ${locked}`);
        
        // Broadcast lock change event
        apiServer.broadcast('gallery:lock:changed', {
            username: normalizedUsername,
            isLocked: locked,
            timestamp: now
        });
        
        res.json({
            success: true,
            data: {
                username: normalizedUsername,
                locked
            }
        });
    }));
    
    // GET /api/v1/gallery/images/:username - Get user's images
    router.get('/images/:username', asyncHandler(async (req, res) => {
        const { username } = req.params;
        const { limit = 100, offset = 0, includeDeleted = false } = req.query;
        
        if (!username) {
            throw new ValidationError('Username is required', 'username');
        }
        
        const normalizedUsername = username.toLowerCase();
        const activeClause = includeDeleted === 'true' ? '' : 'AND is_active = 1';
        
        const images = await apiServer.bot.db.all(`
            SELECT 
                id,
                url,
                timestamp,
                is_active as isActive,
                pruned_reason as prunedReason,
                created_at as createdAt,
                original_poster as originalPoster,
                most_recent_poster as mostRecentPoster,
                original_timestamp as originalTimestamp
            FROM user_images 
            WHERE username = ? ${activeClause}
            ORDER BY timestamp DESC
            LIMIT ? OFFSET ?
        `, [normalizedUsername, parseInt(limit), parseInt(offset)]);
        
        const total = await apiServer.bot.db.get(
            `SELECT COUNT(*) as count FROM user_images WHERE username = ? ${activeClause}`,
            [normalizedUsername]
        );
        
        res.json({
            success: true,
            data: {
                username: normalizedUsername,
                images: images.map(img => ({
                    id: img.id,
                    url: img.url,
                    timestamp: img.timestamp,
                    isActive: Boolean(img.isActive),
                    prunedReason: img.prunedReason,
                    createdAt: img.createdAt,
                    originalPoster: img.originalPoster,
                    mostRecentPoster: img.mostRecentPoster,
                    originalTimestamp: img.originalTimestamp,
                    isSharedFrom: img.originalPoster !== normalizedUsername ? img.originalPoster : null
                })),
                pagination: {
                    total: total.count,
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }
            }
        });
    }));
    
    // GET /api/v1/gallery/activity - Get recent gallery activity
    router.get('/activity', asyncHandler(async (req, res) => {
        const { limit = 50, offset = 0, type = 'all' } = req.query;
        
        let query;
        const params = [];
        
        if (type === 'added') {
            // Show only recently added images
            query = `
                SELECT 
                    ui.id,
                    ui.username,
                    ui.url,
                    ui.timestamp,
                    ui.is_active as isActive,
                    'added' as activityType,
                    ui.created_at as activityTime,
                    ui.original_poster as originalPoster,
                    ui.most_recent_poster as mostRecentPoster,
                    ui.original_timestamp as originalTimestamp
                FROM user_images ui
                WHERE ui.is_active = 1
                ORDER BY ui.timestamp DESC
                LIMIT ? OFFSET ?
            `;
            params.push(parseInt(limit), parseInt(offset));
        } else if (type === 'deleted') {
            // Show only recently deleted images
            query = `
                SELECT 
                    ui.id,
                    ui.username,
                    ui.url,
                    ui.timestamp,
                    ui.is_active as isActive,
                    ui.pruned_reason as reason,
                    'deleted' as activityType,
                    ui.created_at as activityTime,
                    ui.original_poster as originalPoster,
                    ui.most_recent_poster as mostRecentPoster,
                    ui.original_timestamp as originalTimestamp
                FROM user_images ui
                WHERE ui.is_active = 0
                AND ui.pruned_reason IS NOT NULL
                ORDER BY ui.created_at DESC
                LIMIT ? OFFSET ?
            `;
            params.push(parseInt(limit), parseInt(offset));
        } else {
            // Show all activity (both added and deleted)
            query = `
                SELECT * FROM (
                    SELECT 
                        ui.id,
                        ui.username,
                        ui.url,
                        ui.timestamp,
                        ui.is_active as isActive,
                        ui.pruned_reason as reason,
                        CASE 
                            WHEN ui.is_active = 1 THEN 'added'
                            ELSE 'deleted'
                        END as activityType,
                        ui.timestamp as activityTime,
                        ui.original_poster as originalPoster,
                        ui.most_recent_poster as mostRecentPoster,
                        ui.original_timestamp as originalTimestamp
                    FROM user_images ui
                    WHERE ui.is_active = 1
                    
                    UNION ALL
                    
                    SELECT 
                        ui.id,
                        ui.username,
                        ui.url,
                        ui.timestamp,
                        ui.is_active as isActive,
                        ui.pruned_reason as reason,
                        'deleted' as activityType,
                        ui.created_at as activityTime,
                        ui.original_poster as originalPoster,
                        ui.most_recent_poster as mostRecentPoster,
                        ui.original_timestamp as originalTimestamp
                    FROM user_images ui
                    WHERE ui.is_active = 0
                    AND ui.pruned_reason IS NOT NULL
                ) combined
                ORDER BY activityTime DESC
                LIMIT ? OFFSET ?
            `;
            params.push(parseInt(limit), parseInt(offset));
        }
        
        const activities = await apiServer.bot.db.all(query, params);
        
        // Get total count
        let countQuery;
        const countParams = [];
        
        if (type === 'added') {
            countQuery = 'SELECT COUNT(*) as count FROM user_images WHERE is_active = 1';
        } else if (type === 'deleted') {
            countQuery = 'SELECT COUNT(*) as count FROM user_images WHERE is_active = 0 AND pruned_reason IS NOT NULL';
        } else {
            countQuery = 'SELECT COUNT(*) as count FROM user_images';
        }
        
        const total = await apiServer.bot.db.get(countQuery, countParams);
        
        res.json({
            success: true,
            data: {
                activities: activities.map(activity => ({
                    id: activity.id,
                    username: activity.username,
                    url: activity.url,
                    timestamp: activity.timestamp,
                    isActive: Boolean(activity.isActive),
                    activityType: activity.activityType,
                    activityTime: activity.activityTime,
                    reason: activity.reason,
                    originalPoster: activity.originalPoster,
                    mostRecentPoster: activity.mostRecentPoster,
                    originalTimestamp: activity.originalTimestamp,
                    isSharedFrom: activity.originalPoster !== activity.username ? activity.originalPoster : null
                })),
                pagination: {
                    total: total.count,
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }
            }
        });
    }));
    
    // POST /api/v1/gallery/images/metadata - Get metadata for an image URL
    router.post('/images/metadata', asyncHandler(async (req, res) => {
        const { url } = req.body;
        
        if (!url) {
            throw new ValidationError('URL is required', 'url');
        }
        
        if (typeof url !== 'string' || !url.trim()) {
            throw new ValidationError('URL must be a non-empty string', 'url');
        }
        
        // Extract metadata
        const metadata = await extractImageMetadata(url);
        
        res.json({
            success: true,
            data: metadata
        });
    }));
    
    // POST /api/v1/gallery/health-check - Manually trigger health check for a user
    router.post('/health-check', asyncHandler(async (req, res) => {
        const { username } = req.body;
        
        if (!username) {
            throw new ValidationError('Username is required', 'username');
        }
        
        // Run health check
        const result = await apiServer.bot.imageHealthChecker.checkUserImages(username);
        
        // Emit event
        if (result.dead > 0) {
            apiServer.broadcast('gallery:health:check', {
                username,
                checked: result.checked,
                dead: result.dead,
                timestamp: Date.now()
            });
        }
        
        res.json({
            success: true,
            data: {
                username,
                imagesChecked: result.checked,
                deadImagesFound: result.dead
            }
        });
    }));
    
    // GET /api/v1/gallery/images - Get all gallery images
    router.get('/images', asyncHandler(async (req, res) => {
        const galleries = await apiServer.bot.db.all(`
            SELECT 
                ui.username,
                ui.url,
                ui.timestamp,
                ui.original_poster,
                ui.most_recent_poster,
                ui.original_timestamp,
                COALESCE(gl.is_locked, 0) as is_locked
            FROM user_images ui
            LEFT JOIN user_gallery_locks gl ON ui.username = gl.username
            WHERE ui.is_active = 1
            ORDER BY ui.username ASC, ui.timestamp DESC
        `);
        
        // Group by user
        const groupedGalleries = {};
        galleries.forEach(img => {
            if (!groupedGalleries[img.username]) {
                groupedGalleries[img.username] = {
                    images: [],
                    isLocked: Boolean(img.is_locked)
                };
            }
            groupedGalleries[img.username].images.push({
                url: img.url,
                timestamp: img.timestamp,
                originalPoster: img.original_poster,
                mostRecentPoster: img.most_recent_poster,
                originalTimestamp: img.original_timestamp,
                isSharedFrom: img.original_poster !== img.username ? img.original_poster : null
            });
        });
        
        // Get storage size estimate
        const sizeStats = await apiServer.bot.db.get(`
            SELECT 
                COUNT(*) as totalImages,
                COUNT(DISTINCT username) as totalUsers
            FROM user_images
            WHERE is_active = 1
        `);
        
        // Estimate 500KB per image average
        const estimatedSizeMB = ((sizeStats.totalImages * 500) / 1024 / 1024).toFixed(1);
        
        res.json({
            success: true,
            data: {
                galleries: groupedGalleries,
                stats: {
                    totalImages: sizeStats.totalImages,
                    totalUsers: sizeStats.totalUsers,
                    storageSize: `${estimatedSizeMB} MB`
                }
            }
        });
    }));
    
    // GET /api/v1/gallery/stats - Get gallery statistics
    router.get('/stats', asyncHandler(async (req, res) => {
        const stats = await apiServer.bot.db.get(`
            SELECT 
                COUNT(DISTINCT username) as totalUsers,
                COUNT(*) as totalImages,
                COUNT(CASE WHEN is_active = 1 THEN 1 END) as activeImages,
                COUNT(CASE WHEN is_active = 0 THEN 1 END) as deletedImages
            FROM user_images
        `);
        
        // Estimate storage size (500KB per image average)
        const estimatedSizeMB = ((stats.activeImages * 500) / 1024 / 1024).toFixed(1);
        
        res.json({
            success: true,
            data: {
                totalImages: stats.activeImages,
                totalUsers: stats.totalUsers,
                storageSize: `${estimatedSizeMB} MB`
            }
        });
    }));
    
    // GET /api/v1/gallery/pruned - Get recently pruned images
    router.get('/pruned', asyncHandler(async (req, res) => {
        const { limit = 100, offset = 0 } = req.query;
        const sixMonthsAgo = Date.now() - (6 * 30 * 24 * 60 * 60 * 1000); // Rough 6 months
        
        const prunedImages = await apiServer.bot.db.all(`
            SELECT 
                id,
                username,
                url,
                timestamp,
                pruned_reason as prunedReason,
                failure_count as failureCount,
                first_failure_at as firstFailureAt,
                last_check_at as lastCheckAt,
                next_check_at as nextCheckAt,
                recheck_count as recheckCount,
                created_at as createdAt,
                original_poster as originalPoster,
                most_recent_poster as mostRecentPoster,
                original_timestamp as originalTimestamp
            FROM user_images 
            WHERE is_active = 0 
            AND pruned_reason IS NOT NULL
            AND timestamp >= ?
            ORDER BY last_check_at DESC, timestamp DESC
            LIMIT ? OFFSET ?
        `, [sixMonthsAgo, parseInt(limit), parseInt(offset)]);
        
        const total = await apiServer.bot.db.get(
            `SELECT COUNT(*) as count FROM user_images 
             WHERE is_active = 0 AND pruned_reason IS NOT NULL AND timestamp >= ?`,
            [sixMonthsAgo]
        );
        
        // Calculate gravestone threshold (48 hours from first failure)
        const gravestoneThreshold = 48 * 60 * 60 * 1000;
        const now = Date.now();
        
        res.json({
            success: true,
            data: {
                images: prunedImages.map(img => ({
                    id: img.id,
                    username: img.username,
                    url: img.url,
                    timestamp: img.timestamp,
                    prunedReason: img.prunedReason,
                    failureCount: img.failureCount,
                    firstFailureAt: img.firstFailureAt,
                    lastCheckAt: img.lastCheckAt,
                    nextCheckAt: img.nextCheckAt,
                    recheckCount: img.recheckCount,
                    createdAt: img.createdAt,
                    originalPoster: img.originalPoster,
                    mostRecentPoster: img.mostRecentPoster,
                    originalTimestamp: img.originalTimestamp,
                    isSharedFrom: img.originalPoster !== img.username ? img.originalPoster : null,
                    // Add gravestone flag if it's been dead for over 48 hours
                    hasGravestone: img.firstFailureAt && (now - img.firstFailureAt) > gravestoneThreshold
                })),
                pagination: {
                    total: total.count,
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }
            }
        });
    }));
    
    // POST /api/v1/gallery/pruned/:id/recheck - Manually recheck a pruned image
    router.post('/pruned/:id/recheck', asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        if (!id) {
            throw new ValidationError('Image ID is required', 'id');
        }
        
        try {
            const result = await apiServer.bot.imageHealthChecker.recheckImage(parseInt(id));
            
            if (result.accessible) {
                res.json({
                    success: true,
                    data: {
                        message: 'Image is accessible and has been restored',
                        accessible: true
                    }
                });
            } else {
                res.json({
                    success: true,
                    data: {
                        message: 'Image is still inaccessible',
                        accessible: false,
                        error: result.error
                    }
                });
            }
        } catch (error) {
            if (error.message === 'Image not found') {
                throw new NotFoundError('Image');
            }
            throw error;
        }
    }));
    
    // GET /api/v1/gallery/images/by-url - Get all instances of an image URL across galleries
    router.get('/images/by-url', asyncHandler(async (req, res) => {
        const { url } = req.query;
        
        if (!url) {
            throw new ValidationError('URL is required', 'url');
        }
        
        const images = await apiServer.bot.db.all(`
            SELECT 
                ui.id,
                ui.username,
                ui.url,
                ui.timestamp,
                ui.is_active as isActive,
                ui.pruned_reason as prunedReason,
                ui.created_at as createdAt,
                ui.original_poster as originalPoster,
                ui.most_recent_poster as mostRecentPoster,
                ui.original_timestamp as originalTimestamp,
                COALESCE(gl.is_locked, 0) as isLocked
            FROM user_images ui
            LEFT JOIN user_gallery_locks gl ON ui.username = gl.username
            WHERE ui.url = ?
            ORDER BY ui.original_timestamp ASC, ui.timestamp ASC
        `, [url]);
        
        if (images.length === 0) {
            throw new NotFoundError('Image with specified URL');
        }
        
        // Find the original poster (earliest instance)
        const originalInstance = images[0];
        
        res.json({
            success: true,
            data: {
                url,
                originalPoster: originalInstance.originalPoster,
                originalTimestamp: originalInstance.originalTimestamp,
                instances: images.map(img => ({
                    id: img.id,
                    username: img.username,
                    timestamp: img.timestamp,
                    isActive: Boolean(img.isActive),
                    isLocked: Boolean(img.isLocked),
                    prunedReason: img.prunedReason,
                    createdAt: img.createdAt,
                    isOriginal: img.username === originalInstance.originalPoster && img.timestamp === originalInstance.originalTimestamp
                })),
                totalInstances: images.length,
                activeInstances: images.filter(img => img.isActive).length
            }
        });
    }));
    
    // Register endpoints
    apiServer.registerEndpoint('GET', '/api/v1/gallery/images');
    apiServer.registerEndpoint('DELETE', '/api/v1/gallery/images');
    apiServer.registerEndpoint('GET', '/api/v1/gallery/locks');
    apiServer.registerEndpoint('GET', '/api/v1/gallery/locks/:username');
    apiServer.registerEndpoint('PUT', '/api/v1/gallery/locks/:username');
    apiServer.registerEndpoint('GET', '/api/v1/gallery/images/:username');
    apiServer.registerEndpoint('GET', '/api/v1/gallery/images/by-url');
    apiServer.registerEndpoint('GET', '/api/v1/gallery/activity');
    apiServer.registerEndpoint('POST', '/api/v1/gallery/images/metadata');
    apiServer.registerEndpoint('POST', '/api/v1/gallery/health-check');
    apiServer.registerEndpoint('GET', '/api/v1/gallery/stats');
    apiServer.registerEndpoint('GET', '/api/v1/gallery/pruned');
    apiServer.registerEndpoint('POST', '/api/v1/gallery/pruned/:id/recheck');
    
    return router;
}