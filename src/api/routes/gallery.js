import { Router } from 'express';
import { asyncHandler, ValidationError, NotFoundError, ForbiddenError } from '../middleware/errorHandler.js';
import { strictCorsMiddleware } from '../middleware/cors.js';

export function createGalleryRoutes(apiServer) {
    const router = Router();
    
    // Apply strict CORS to all gallery routes
    router.use(strictCorsMiddleware(apiServer));
    
    // DELETE /api/v1/gallery/images - Mark an image as deleted
    router.delete('/images', asyncHandler(async (req, res) => {
        const { url, reason = 'Deleted via gallery' } = req.body;
        
        // Validate input
        if (!url) {
            throw new ValidationError('URL is required', 'url');
        }
        
        if (typeof url !== 'string' || !url.trim()) {
            throw new ValidationError('URL must be a non-empty string', 'url');
        }
        
        // Find the image in database
        const image = await apiServer.bot.db.get(
            'SELECT * FROM user_images WHERE url = ? AND is_active = 1',
            [url]
        );
        
        if (!image) {
            throw new NotFoundError('Image');
        }
        
        // Check if user's gallery is locked
        const lockStatus = await apiServer.bot.db.get(
            'SELECT is_locked FROM user_gallery_locks WHERE username = ?',
            [image.username]
        );
        
        if (lockStatus && lockStatus.is_locked) {
            throw new ForbiddenError(`Gallery for user ${image.username} is locked`);
        }
        
        // Mark image as deleted
        await apiServer.bot.db.run(
            'UPDATE user_images SET is_active = 0, pruned_reason = ? WHERE url = ?',
            [reason, url]
        );
        
        // Log the deletion
        apiServer.bot.logger.info(`[API] Image deleted: ${url} (user: ${image.username}, reason: ${reason})`);
        
        // Broadcast deletion event
        apiServer.broadcast('gallery:image:deleted', {
            url,
            username: image.username,
            reason,
            timestamp: Date.now()
        });
        
        res.json({
            success: true,
            data: {
                message: 'Image marked as deleted',
                url,
                username: image.username
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
            locked,
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
                created_at as createdAt
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
                    createdAt: img.createdAt
                })),
                pagination: {
                    total: total.count,
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }
            }
        });
    }));
    
    // Register endpoints
    apiServer.registerEndpoint('DELETE', '/api/v1/gallery/images');
    apiServer.registerEndpoint('GET', '/api/v1/gallery/locks');
    apiServer.registerEndpoint('GET', '/api/v1/gallery/locks/:username');
    apiServer.registerEndpoint('PUT', '/api/v1/gallery/locks/:username');
    apiServer.registerEndpoint('GET', '/api/v1/gallery/images/:username');
    
    return router;
}