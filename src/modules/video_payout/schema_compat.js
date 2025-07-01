/**
 * Compatibility schema for existing video payout tables
 */

export const videoPayoutSchema = {
    async initialize(database) {
        // Tables already exist, just ensure indexes are created
        try {
            await database.run('CREATE INDEX IF NOT EXISTS idx_video_payouts_username ON video_payouts(username)');
            await database.run('CREATE INDEX IF NOT EXISTS idx_video_payouts_video_id ON video_payouts(video_id)');
            await database.run('CREATE INDEX IF NOT EXISTS idx_video_payouts_queued ON video_payouts(status, queued_at)');
            await database.run('CREATE INDEX IF NOT EXISTS idx_video_payouts_timestamp ON video_payouts(created_at)');
            await database.run('CREATE INDEX IF NOT EXISTS idx_video_sessions_start_time ON video_sessions(start_time)');
            await database.run('CREATE INDEX IF NOT EXISTS idx_video_watchers_session_id ON video_watchers(session_id)');
            await database.run('CREATE INDEX IF NOT EXISTS idx_video_watchers_username ON video_watchers(username)');
            await database.run('CREATE INDEX IF NOT EXISTS idx_video_watchers_rewarded ON video_watchers(rewarded)');
        } catch (error) {
            console.log('Some video payout indexes may already exist, continuing...');
        }
        
        console.log('Video payout tables compatibility check completed');
    }
};