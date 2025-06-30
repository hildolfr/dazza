// ===== DAZZA'S HALL OF SHAME - LEADERBOARD SCRIPT =====

// Configuration - Both HTTP and HTTPS use port 3001
const API_BASE = window.location.protocol === 'https:' 
    ? 'https://seg.tplinkdns.com:3001/api/v1' 
    : 'http://seg.tplinkdns.com:3001/api/v1';
const WS_URL = window.location.protocol === 'https:' 
    ? 'https://seg.tplinkdns.com:3001' 
    : 'http://seg.tplinkdns.com:3001';
const UPDATE_INTERVAL = 30000; // 30 seconds
const CHAT_HISTORY_SIZE = 10;

// State
let currentCategory = 'all';
let leaderboardData = {};
let socket = null;
let updateTimer = null;
let chatMessages = [];
let wsConnected = false;

// DOM Elements
const elements = {
    container: document.getElementById('leaderboards-container'),
    categoryTabs: document.querySelectorAll('.tab-button'),
    searchInput: document.getElementById('user-search'),
    showAchievements: document.getElementById('show-achievements'),
    animateChanges: document.getElementById('animate-changes'),
    modal: document.getElementById('user-modal'),
    modalContent: document.getElementById('user-details'),
    modalClose: document.querySelector('.modal-close'),
    chatMessages: document.getElementById('chat-messages'),
    chatWidget: document.querySelector('.chat-widget'),
    chatToggle: document.querySelector('.chat-toggle'),
    toastContainer: document.getElementById('toast-container')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadLeaderboards();
    initializeWebSocket();
    initializeChat();
    startAutoUpdate();
});

// Event Listeners
function initializeEventListeners() {
    // Category tabs
    elements.categoryTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const category = tab.dataset.category;
            setActiveCategory(category);
        });
    });

    // Search
    elements.searchInput.addEventListener('input', debounce(handleSearch, 300));

    // Modal
    elements.modalClose.addEventListener('click', closeModal);
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) closeModal();
    });

    // Chat widget toggle
    elements.chatToggle.addEventListener('click', toggleChat);
    elements.chatWidget.querySelector('.chat-header').addEventListener('click', toggleChat);
}

// API Functions
async function loadLeaderboards() {
    try {
        showLoading();
        
        const endpoint = currentCategory === 'all' 
            ? `${API_BASE}/stats/leaderboard/all?limit=5`
            : `${API_BASE}/stats/leaderboard/${currentCategory}?limit=10`;
            
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: { 
                'Accept': 'application/json',
                'Origin': window.location.origin
            }
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        
        if (data.success) {
            if (currentCategory === 'all') {
                leaderboardData = data.data.leaderboards;
                renderAllLeaderboards(leaderboardData);
            } else {
                renderSingleLeaderboard(data.data);
            }
        }
    } catch (error) {
        console.error('Failed to load leaderboards:', error);
        showError('Failed to load leaderboards. Are you running the bot?');
    }
}

async function loadUserRanks(username) {
    try {
        const response = await fetch(`${API_BASE}/stats/users/${username}/ranks`, {
            method: 'GET',
            headers: { 
                'Accept': 'application/json',
                'Origin': window.location.origin
            }
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        return data.success ? data.data : null;
    } catch (error) {
        console.error('Failed to load user ranks:', error);
        return null;
    }
}

// WebSocket Functions
function initializeWebSocket() {
    try {
        socket = io(WS_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        socket.on('connect', () => {
            wsConnected = true;
            console.log('WebSocket connected');
            socket.emit('subscribe', ['stats', 'chat']);
        });

        socket.on('disconnect', () => {
            wsConnected = false;
            console.log('WebSocket disconnected');
        });

        socket.on('stats:user:update', (data) => {
            if (elements.animateChanges.checked) {
                handleLiveUpdate(data);
            }
        });

        socket.on('chat:message', (data) => {
            addChatMessage(data);
        });

        socket.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
    }
}

// Chat Functions
async function initializeChat() {
    try {
        const response = await fetch(`${API_BASE}/chat/recent?limit=${CHAT_HISTORY_SIZE}`, {
            method: 'GET',
            headers: { 
                'Accept': 'application/json',
                'Origin': window.location.origin
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data.messages) {
                chatMessages = data.data.messages;
                renderChatMessages();
            }
        }
    } catch (error) {
        console.error('Failed to load chat history:', error);
    }
}

function addChatMessage(message) {
    chatMessages.push(message);
    if (chatMessages.length > CHAT_HISTORY_SIZE) {
        chatMessages.shift();
    }
    renderChatMessages();
}

function renderChatMessages() {
    if (chatMessages.length === 0) {
        elements.chatMessages.innerHTML = '<div class="chat-loading">No messages yet...</div>';
        return;
    }

    elements.chatMessages.innerHTML = chatMessages.map(msg => `
        <div class="chat-message">
            <span class="chat-username">${escapeHtml(msg.username)}:</span>
            <span class="chat-text">${escapeHtml(msg.message)}</span>
            <span class="chat-time">${msg.timeAgo || 'now'}</span>
        </div>
    `).join('');

    // Auto-scroll to bottom
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function toggleChat() {
    elements.chatWidget.classList.toggle('minimized');
}

// Render Functions
function showLoading() {
    elements.container.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Loading legends...</p>
        </div>
    `;
}

function showError(message) {
    elements.container.innerHTML = `
        <div class="loading-state">
            <p style="color: #ce1126;">❌ ${message}</p>
        </div>
    `;
}

function renderAllLeaderboards(leaderboards) {
    const filteredLeaderboards = filterLeaderboards(leaderboards);
    
    elements.container.innerHTML = filteredLeaderboards.map(board => `
        <div class="leaderboard-card" data-category="${board.type}">
            <div class="leaderboard-header">${board.title}</div>
            <div class="leaderboard-list">
                ${board.data.length > 0 ? board.data.map(item => renderLeaderboardItem(item, board.type)).join('') : '<p style="text-align: center; padding: 20px; color: #999;">No data yet</p>'}
            </div>
        </div>
    `).join('');
    
    // Add click handlers for user details
    document.querySelectorAll('.leaderboard-item').forEach(item => {
        item.addEventListener('click', () => {
            const username = item.dataset.username;
            const category = item.dataset.category;
            showUserDetails(username, category);
        });
    });
}

function renderSingleLeaderboard(data) {
    const board = {
        type: data.type,
        title: getCategoryTitle(data.type),
        data: data.leaderboard
    };
    
    renderAllLeaderboards([board]);
}

function renderLeaderboardItem(item, category) {
    const showAchievements = elements.showAchievements.checked;
    const rankClass = item.rank === 1 ? 'gold' : item.rank === 2 ? 'silver' : item.rank === 3 ? 'bronze' : '';
    
    return `
        <div class="leaderboard-item" data-username="${item.username}" data-category="${category}">
            <div class="rank ${rankClass}">#${item.rank}</div>
            <div class="user-info">
                <div class="username">${escapeHtml(item.username)}</div>
                <div class="user-value">${escapeHtml(item.value)}</div>
                ${item.extra ? `<div class="user-extra">${escapeHtml(item.extra)}</div>` : ''}
            </div>
            ${showAchievements && item.achievement ? `<div class="achievement">${item.achievement}</div>` : ''}
        </div>
    `;
}

// User Modal
async function showUserDetails(username, category) {
    elements.modalContent.innerHTML = '<div class="loading-spinner"></div>';
    elements.modal.style.display = 'block';
    
    try {
        // Fetch category-specific details
        const response = await fetch(`${API_BASE}/stats/users/${username}/category/${category}`, {
            method: 'GET',
            headers: { 
                'Accept': 'application/json',
                'Origin': window.location.origin
            }
        });

        if (!response.ok) {
            // If category data fails, fall back to showing all ranks
            const userRanks = await loadUserRanks(username);
            showAllRanks(username, userRanks);
            return;
        }
        
        const data = await response.json();
        
        if (data.success) {
            renderCategoryDetails(username, category, data.data);
        } else {
            throw new Error('Failed to load stats');
        }
    } catch (error) {
        console.error('Failed to load user details:', error);
        elements.modalContent.innerHTML = '<p>Failed to load user details.</p>';
    }
}

function renderCategoryDetails(username, category, data) {
    let content = `<h2 style="color: var(--vb-green); margin-bottom: 20px;">${escapeHtml(username)}'s ${getCategoryTitle(category)} Stats</h2>`;
    
    switch (category) {
        case 'pissers':
            content += renderPisserStats(data);
            break;
        case 'sign_spinning':
            content += renderSignSpinningStats(data);
            break;
        case 'gamblers':
            content += renderGamblerStats(data);
            break;
        case 'fishing':
            content += renderFishingStats(data);
            break;
        case 'beggars':
            content += renderBeggarStats(data);
            break;
        case 'bottles':
        case 'cashie':
            content += renderJobStats(data, category);
            break;
        case 'bongs':
        case 'drinks':
            content += renderConsumptionStats(data, category);
            break;
        default:
            content += renderBasicStats(data);
    }
    
    // Add "View All Rankings" button
    content += `
        <div style="margin-top: 30px; text-align: center;">
            <button class="view-all-ranks-btn" data-username="${username}">View All Rankings</button>
        </div>
    `;
    
    elements.modalContent.innerHTML = content;
    
    // Add click handler for view all ranks button
    document.querySelector('.view-all-ranks-btn')?.addEventListener('click', async (e) => {
        const user = e.target.dataset.username;
        const userRanks = await loadUserRanks(user);
        showAllRanks(user, userRanks);
    });
}

function renderPisserStats(data) {
    const stats = data.stats;
    const winRate = stats.total_matches > 0 ? ((stats.wins / stats.total_matches) * 100).toFixed(1) : 0;
    
    let html = `
        <div class="stat-section">
            <h3>Overall Performance</h3>
            <div class="stat-grid">
                <div class="stat-item">
                    <span class="stat-label">Record:</span>
                    <span class="stat-value">${stats.wins}W - ${stats.losses}L (${winRate}%)</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Money Won:</span>
                    <span class="stat-value">$${stats.money_won}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Money Lost:</span>
                    <span class="stat-value">$${stats.money_lost}</span>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>Personal Bests</h3>
            <div class="stat-grid">
                <div class="stat-item">
                    <span class="stat-label">📏 Distance:</span>
                    <span class="stat-value">${stats.best_distance.toFixed(1)}m</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${(stats.best_distance / 6) * 100}%"></div>
                    </div>
                </div>
                <div class="stat-item">
                    <span class="stat-label">💧 Volume:</span>
                    <span class="stat-value">${Math.round(stats.best_volume)}mL</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${(stats.best_volume / 2500) * 100}%"></div>
                    </div>
                </div>
                <div class="stat-item">
                    <span class="stat-label">🎯 Aim:</span>
                    <span class="stat-value">${Math.round(stats.best_aim)}%</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${stats.best_aim}%"></div>
                    </div>
                </div>
                <div class="stat-item">
                    <span class="stat-label">⏱️ Duration:</span>
                    <span class="stat-value">${Math.round(stats.best_duration)}s</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${(stats.best_duration / 40) * 100}%"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    if (data.recentMatches && data.recentMatches.length > 0) {
        html += `
            <div class="stat-section">
                <h3>Recent Matches</h3>
                <div class="match-list">
                    ${data.recentMatches.map(match => `
                        <div class="match-item ${match.won ? 'won' : 'lost'}">
                            <span class="match-opponent">vs ${escapeHtml(match.opponent)}</span>
                            <span class="match-result">${match.won ? 'W' : 'L'} ($${match.amount})</span>
                            <span class="match-stats">
                                📏${match.performance.distance.toFixed(1)}m 
                                💧${Math.round(match.performance.volume)}mL
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    return html;
}

function renderSignSpinningStats(data) {
    const stats = data.stats;
    
    return `
        <div class="stat-section">
            <h3>Career Stats</h3>
            <div class="stat-grid">
                <div class="stat-item">
                    <span class="stat-label">Total Shifts:</span>
                    <span class="stat-value">${stats.total_spins}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Total Earnings:</span>
                    <span class="stat-value">$${stats.total_earnings}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Avg Per Shift:</span>
                    <span class="stat-value">$${data.efficiency}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Best Shift:</span>
                    <span class="stat-value">$${stats.best_shift}</span>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>Performance Metrics</h3>
            <div class="stat-grid">
                <div class="stat-item">
                    <span class="stat-label">🌟 Perfect Days:</span>
                    <span class="stat-value">${stats.perfect_days}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">🚗 Cars Hit:</span>
                    <span class="stat-value">${stats.cars_hit}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">👮 Cops Called:</span>
                    <span class="stat-value">${stats.cops_called} (${data.copRate}%)</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">💸 Worst Shift:</span>
                    <span class="stat-value">$${stats.worst_shift}</span>
                </div>
            </div>
        </div>
    `;
}

function renderGamblerStats(data) {
    const netClass = data.totalProfit >= 0 ? 'profit' : 'loss';
    
    let html = `
        <div class="stat-section">
            <h3>Overall Gambling Stats</h3>
            <div class="stat-grid">
                <div class="stat-item">
                    <span class="stat-label">Total Games:</span>
                    <span class="stat-value">${data.totalGames}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Net Profit:</span>
                    <span class="stat-value ${netClass}">$${data.totalProfit}</span>
                </div>
            </div>
        </div>
    `;
    
    if (data.gameStats && data.gameStats.length > 0) {
        html += `
            <div class="stat-section">
                <h3>Game Breakdown</h3>
                <div class="game-stats">
                    ${data.gameStats.map(game => {
                        const winRate = game.plays > 0 ? ((game.wins / game.plays) * 100).toFixed(1) : 0;
                        const profitClass = game.net_profit >= 0 ? 'profit' : 'loss';
                        return `
                            <div class="game-stat-card">
                                <h4>${game.game.toUpperCase()}</h4>
                                <div class="game-stat-grid">
                                    <div>Plays: ${game.plays}</div>
                                    <div>Win Rate: ${winRate}%</div>
                                    <div>Biggest Win: $${game.biggest_win}</div>
                                    <div class="${profitClass}">Net: $${game.net_profit}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    if (data.topWins && data.topWins.length > 0) {
        html += `
            <div class="stat-section">
                <h3>Biggest Wins</h3>
                <div class="win-list">
                    ${data.topWins.slice(0, 5).map(win => `
                        <div class="win-item">
                            <span class="win-game">${win.game}</span>
                            <span class="win-amount">$${win.amount}</span>
                            <span class="win-desc">${escapeHtml(win.description || '')}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    return html;
}

function renderFishingStats(data) {
    return `
        <div class="stat-section">
            <h3>Fishing Career</h3>
            <div class="stat-grid">
                <div class="stat-item">
                    <span class="stat-label">Total Catches:</span>
                    <span class="stat-value">${data.totalCatches}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Total Weight:</span>
                    <span class="stat-value">${data.totalWeight}kg</span>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>Top Catches</h3>
            <div class="catch-list">
                ${data.topCatches.map((fishCatch, i) => `
                    <div class="catch-item ${i < 3 ? 'trophy' : ''}">
                        <span class="catch-rank">#${i + 1}</span>
                        <span class="catch-weight">${fishCatch.weight.toFixed(1)}kg</span>
                        <span class="catch-type">${escapeHtml(fishCatch.fish_type)}</span>
                        <span class="catch-value">$${fishCatch.amount}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        
        ${data.fishTypes && data.fishTypes.length > 0 ? `
            <div class="stat-section">
                <h3>Fish Collection</h3>
                <div class="fish-type-grid">
                    ${data.fishTypes.map(type => `
                        <div class="fish-type-card">
                            <div class="fish-name">${escapeHtml(type.fish_type)}</div>
                            <div class="fish-stats">
                                <span>Caught: ${type.count}</span>
                                <span>Total: ${type.total_weight.toFixed(1)}kg</span>
                                <span>Biggest: ${type.biggest.toFixed(1)}kg</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
    `;
}

function renderBeggarStats(data) {
    const allTime = data.allTime;
    const successRate = allTime.total_begs > 0 
        ? ((allTime.total_earned > 0 ? allTime.total_begs : 0) / allTime.total_begs * 100).toFixed(1) 
        : 0;
    
    return `
        <div class="stat-section">
            <h3>Lifetime Begging Stats</h3>
            <div class="stat-grid">
                <div class="stat-item">
                    <span class="stat-label">Total Begs:</span>
                    <span class="stat-value">${allTime.total_begs}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Total Earned:</span>
                    <span class="stat-value">$${allTime.total_earned}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Total Lost:</span>
                    <span class="stat-value">$${allTime.total_lost}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Success Rate:</span>
                    <span class="stat-value">${successRate}%</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Best Handout:</span>
                    <span class="stat-value">$${allTime.best_handout || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Worst Robbery:</span>
                    <span class="stat-value">$${allTime.worst_robbery || 0}</span>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>Shame Level</h3>
            <div class="shame-meter">
                <div class="shame-bar" style="width: ${Math.min(allTime.total_begs / 50 * 100, 100)}%"></div>
                <span class="shame-label">${getShameLevel(allTime.total_begs)}</span>
            </div>
        </div>
    `;
}

function renderJobStats(data, category) {
    const jobName = category === 'bottles' ? 'Bottle Collection' : 'Cash Jobs';
    const allTime = data.allTime;
    
    return `
        <div class="stat-section">
            <h3>${jobName} Career</h3>
            <div class="stat-grid">
                <div class="stat-item">
                    <span class="stat-label">Total Jobs:</span>
                    <span class="stat-value">${allTime.total_jobs}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Total Earned:</span>
                    <span class="stat-value">$${allTime.total_earned}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Avg Per Job:</span>
                    <span class="stat-value">$${allTime.avg_per_job.toFixed(2)}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Best Job:</span>
                    <span class="stat-value">$${allTime.best_job}</span>
                </div>
            </div>
        </div>
    `;
}

function renderConsumptionStats(data, category) {
    const itemName = category === 'bongs' ? 'Cones' : 'Drinks';
    const total = data.dailyStats.reduce((sum, d) => sum + d.count, 0);
    
    return `
        <div class="stat-section">
            <h3>Total ${itemName}</h3>
            <div class="big-stat">${total}</div>
            <div class="stat-subtitle">Average ${data.avgPerDay} per day</div>
        </div>
    `;
}

function renderBasicStats(data) {
    return `
        <div class="stat-section">
            <p>No detailed stats available for this category.</p>
        </div>
    `;
}

function showAllRanks(username, userRanks) {
    if (userRanks) {
        const ranksHtml = Object.entries(userRanks.ranks)
            .filter(([_, rank]) => rank !== null)
            .map(([category, rank]) => `
                <div class="user-rank-item">
                    <span class="rank-category">${getCategoryTitle(category)}:</span>
                    <span class="rank-position">#${rank.rank} / ${rank.total}</span>
                    <span class="rank-value">${rank.value}</span>
                </div>
            `).join('');
            
        elements.modalContent.innerHTML = `
            <h2 style="color: var(--vb-green); margin-bottom: 20px;">${escapeHtml(username)}'s Rankings</h2>
            <div class="user-ranks">
                ${ranksHtml || '<p>No rankings found for this user.</p>'}
            </div>
        `;
    } else {
        elements.modalContent.innerHTML = '<p>Failed to load user details.</p>';
    }
}

function getShameLevel(begs) {
    if (begs >= 100) return "ABSOLUTELY SHAMELESS 🤡💩";
    if (begs >= 50) return "NO DIGNITY LEFT 🤡";
    if (begs >= 20) return "PROFESSIONAL BEGGAR 😔";
    if (begs >= 10) return "GETTING DESPERATE";
    if (begs >= 5) return "OCCASIONAL BEGGAR";
    return "STILL HAS SOME PRIDE";
}

function closeModal() {
    elements.modal.style.display = 'none';
}

// Category Management
function setActiveCategory(category) {
    currentCategory = category;
    
    // Update tab styles
    elements.categoryTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.category === category);
    });
    
    // Reload data
    loadLeaderboards();
}

function getCategoryTitle(category) {
    const titles = {
        talkers: 'Top Yappers',
        bongs: '🌿 Most Cooked Cunts',
        drinks: '🍺 Top Piss-heads',
        quoted: '💬 Quotable Legends',
        gamblers: '🎰 Lucky Bastards',
        fishing: '🎣 Master Baiters',
        bottles: '♻️ Eco Warriors',
        cashie: '💪 Hardest Workers',
        sign_spinning: '🪧 Sign Spinners',
        beggars: '🤲 Shameless Beggars',
        pissers: '🏆 Top Pissers'
    };
    return titles[category] || category;
}

// Search/Filter
function handleSearch() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    
    if (searchTerm) {
        // Filter visible items
        document.querySelectorAll('.leaderboard-item').forEach(item => {
            const username = item.dataset.username.toLowerCase();
            const matches = username.includes(searchTerm);
            item.style.display = matches ? 'flex' : 'none';
            
            if (matches) {
                item.classList.add('highlight');
                setTimeout(() => item.classList.remove('highlight'), 1000);
            }
        });
    } else {
        // Show all items
        document.querySelectorAll('.leaderboard-item').forEach(item => {
            item.style.display = 'flex';
        });
    }
}

function filterLeaderboards(leaderboards) {
    const searchTerm = elements.searchInput.value.toLowerCase();
    
    if (!searchTerm) return leaderboards;
    
    return leaderboards.map(board => ({
        ...board,
        data: board.data.filter(item => 
            item.username.toLowerCase().includes(searchTerm)
        )
    }));
}

// Live Updates
function handleLiveUpdate(data) {
    // Show toast notification
    showToast(`${data.username} just ${data.event}!`, 'info');
    
    // Refresh leaderboards with animation
    setTimeout(() => loadLeaderboards(), 1000);
}

function startAutoUpdate() {
    if (updateTimer) clearInterval(updateTimer);
    
    updateTimer = setInterval(() => {
        if (elements.animateChanges.checked) {
            loadLeaderboards();
        }
    }, UPDATE_INTERVAL);
}

// Toast Notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
        <span>${escapeHtml(message)}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'toastSlide 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Utility Functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Error Handling
window.addEventListener('error', (e) => {
    console.error('Global error:', e);
    showToast('Something went wrong!', 'error');
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (socket) socket.close();
    if (updateTimer) clearInterval(updateTimer);
});