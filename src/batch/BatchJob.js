export class BatchJob {
    constructor(name, db, logger) {
        this.name = name;
        this.db = db;
        this.logger = logger;
    }

    async execute() {
        throw new Error('BatchJob.execute() must be implemented by subclass');
    }

    async run() {
        const startTime = Date.now();
        let recordsProcessed = 0;
        
        try {
            this.logger.info(`[${this.name}] Starting batch job`);
            recordsProcessed = await this.execute();
            const duration = Date.now() - startTime;
            this.logger.info(`[${this.name}] Completed: ${recordsProcessed} records in ${duration}ms`);
            
            return {
                success: true,
                recordsProcessed,
                duration
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error(`[${this.name}] Failed after ${duration}ms:`, error);
            throw error;
        }
    }

    // Helper method for batch processing with transactions
    async processBatch(query, params, batchSize, processor) {
        let offset = 0;
        let totalProcessed = 0;
        let hasMore = true;

        while (hasMore) {
            const batch = await this.db.all(
                `${query} LIMIT ? OFFSET ?`,
                [...params, batchSize, offset]
            );

            if (batch.length === 0) {
                hasMore = false;
                break;
            }

            // Process batch in a transaction
            await this.db.run('BEGIN TRANSACTION');
            try {
                for (const item of batch) {
                    await processor(item);
                }
                await this.db.run('COMMIT');
                totalProcessed += batch.length;
                this.logger.debug(`[${this.name}] Processed batch: ${batch.length} items`);
            } catch (error) {
                await this.db.run('ROLLBACK');
                throw error;
            }

            offset += batchSize;
            hasMore = batch.length === batchSize;

            // Small delay to prevent overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return totalProcessed;
    }

    // Helper for updating cache tables with proper timestamps
    async updateCache(table, key, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map(() => '?').join(', ');
        const updates = keys.map(k => `${k} = excluded.${k}`).join(', ');

        await this.db.run(
            `INSERT INTO ${table} (${keys.join(', ')}, updated_at) 
             VALUES (${placeholders}, CURRENT_TIMESTAMP)
             ON CONFLICT(${key}) DO UPDATE SET
             ${updates}, updated_at = CURRENT_TIMESTAMP`,
            values
        );
    }
}