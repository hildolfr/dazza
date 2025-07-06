import Database from '../services/database.js';

async function populateLeaderboards() {
    const db = new Database('./cytube_stats_modular.db');
    await db.init();
    
    try {
        console.log('=== GAMBLING & FISHING LEADERBOARD ANALYSIS ===\n');
        
        // Check existing gambling wins
        console.log('📊 GAMBLING WINS:\n');
        const gamblingWins = await db.all(`
            SELECT username, amount, transaction_type, description, created_at
            FROM economy_transactions
            WHERE transaction_type IN ('pokies', 'scratchie', 'tab')
            AND amount > 0
            ORDER BY amount DESC
            LIMIT 20
        `);
        
        if (gamblingWins.length > 0) {
            console.log('Top gambling wins found:');
            gamblingWins.forEach((win, i) => {
                const date = new Date(win.created_at).toLocaleDateString();
                console.log(`${i+1}. ${win.username}: $${win.amount} (${win.transaction_type}) - ${date}`);
            });
        } else {
            console.log('No gambling wins found yet.');
        }
        
        // Check if we need to analyze messages for historical pokies/scratchie wins
        console.log('\n\n📊 HISTORICAL GAMBLING ANALYSIS:\n');
        
        // Look for pokies jackpot messages
        const pokiesJackpots = await db.all(`
            SELECT username, message, timestamp
            FROM messages
            WHERE message LIKE '%JACKPOT%' 
            AND message LIKE '%won $%'
            AND username = ?
            ORDER BY timestamp DESC
            LIMIT 20
        `, [db.botUsername]);
        
        if (pokiesJackpots.length > 0) {
            console.log('Found historical pokies jackpots:');
            for (const jackpot of pokiesJackpots) {
                // Extract win amount from message
                const match = jackpot.message.match(/won \$(\d+)/);
                if (match) {
                    const amount = parseInt(match[1]);
                    const userMatch = jackpot.message.match(/-(\w+)/);
                    if (userMatch) {
                        console.log(`- ${userMatch[1]} won $${amount} at pokies`);
                    }
                }
            }
        }
        
        // Check fishing data
        console.log('\n\n📊 FISHING RECORDS:\n');
        const fishingRecords = await db.all(`
            SELECT username, 
                   description,
                   CAST(SUBSTR(description, 1, INSTR(description, 'kg') - 1) AS REAL) as weight
            FROM economy_transactions
            WHERE transaction_type = 'fishing'
            AND description LIKE '%kg%'
            ORDER BY weight DESC
            LIMIT 20
        `);
        
        if (fishingRecords.length > 0) {
            console.log('Top fishing catches found:');
            fishingRecords.forEach((catch_, i) => {
                console.log(`${i+1}. ${catch_.username}: ${catch_.weight}kg - ${catch_.description}`);
            });
        } else {
            console.log('No fishing records found yet.');
        }
        
        // Look for historical fishing messages
        console.log('\n\n📊 HISTORICAL FISHING ANALYSIS:\n');
        const fishingMessages = await db.all(`
            SELECT username, message, timestamp
            FROM messages
            WHERE message LIKE '%caught a%kg%'
            AND username = ?
            ORDER BY timestamp DESC
            LIMIT 50
        `, [db.botUsername]);
        
        if (fishingMessages.length > 0) {
            console.log('Found historical fishing messages:');
            const fishData = [];
            
            for (const msg of fishingMessages) {
                // Extract fish data from messages like "caught a 15.2kg Snapper!"
                const match = msg.message.match(/caught a ([\d.]+)kg ([^!]+)/);
                if (match) {
                    const weight = parseFloat(match[1]);
                    const fishType = match[2].trim();
                    const userMatch = msg.message.match(/-(\w+)/);
                    if (userMatch) {
                        fishData.push({
                            username: userMatch[1],
                            weight: weight,
                            fishType: fishType,
                            timestamp: msg.timestamp
                        });
                    }
                }
            }
            
            // Sort by weight and show top catches
            fishData.sort((a, b) => b.weight - a.weight);
            console.log('\nBiggest historical catches:');
            fishData.slice(0, 10).forEach((fish, i) => {
                console.log(`${i+1}. ${fish.username}: ${fish.weight}kg ${fish.fishType}`);
            });
        }
        
        // Test the new database methods
        console.log('\n\n=== TESTING NEW LEADERBOARD METHODS ===\n');
        
        const topGamblers = await db.getTopGamblers(5);
        console.log('Top Gamblers:', topGamblers);
        
        const topFishers = await db.getTopFishers(5);
        console.log('Top Fishers:', topFishers);
        
    } catch (error) {
        console.error('Error analyzing leaderboards:', error);
    } finally {
        await db.close();
    }
}

// Run the analysis
populateLeaderboards().catch(console.error);