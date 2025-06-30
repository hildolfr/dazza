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
            content += renderPisserStats(data, username);
            break;
        case 'sign_spinning':
            content += renderSignSpinningStats(data, username);
            break;
        case 'gamblers':
            content += renderGamblerStats(data, username);
            break;
        case 'fishing':
            content += renderFishingStats(data, username);
            break;
        case 'beggars':
            content += renderBeggarStats(data, username);
            break;
        case 'bottles':
        case 'cashie':
            content += renderJobStats(data, category, username);
            break;
        case 'bongs':
        case 'drinks':
            content += renderConsumptionStats(data, category, username);
            break;
        case 'talkers':
            content += renderTalkerStats(data, username);
            break;
        case 'quoted':
            content += renderQuotedStats(data, username);
            break;
        default:
            content += renderBasicStats(data, username);
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

function renderPisserStats(data, username) {
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
    
    if (data.characteristicStats && data.characteristicStats.length > 0) {
        html += `
            <div class="stat-section">
                <h3>Dick Characteristics Used</h3>
                <div class="characteristic-grid">
                    ${data.characteristicStats.map(char => `
                        <div class="characteristic-item">
                            <span class="characteristic-name">${escapeHtml(char.characteristic)}</span>
                            <span class="characteristic-count">${char.count} times</span>
                        </div>
                    `).join('')}
                </div>
                ${stats.rarest_characteristic ? `<div class="rarest-badge">🏆 Rarest: ${escapeHtml(stats.rarest_characteristic)}</div>` : ''}
            </div>
        `;
    }
    
    if (data.locationStats && data.locationStats.length > 0) {
        html += `
            <div class="stat-section">
                <h3>Performance by Location</h3>
                <div class="location-stats">
                    ${data.locationStats.map(loc => {
                        const winRate = loc.matches > 0 ? ((loc.wins / loc.matches) * 100).toFixed(1) : 0;
                        return `
                            <div class="location-item">
                                <div class="location-name">${escapeHtml(loc.location)}</div>
                                <div class="location-data">
                                    <span>${loc.matches} matches</span>
                                    <span>${loc.wins}W (${winRate}%)</span>
                                    <span>Avg: ${loc.avg_score.toFixed(0)}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                ${stats.favorite_location ? `<div class="favorite-badge">⭐ Favorite: ${escapeHtml(stats.favorite_location)}</div>` : ''}
            </div>
        `;
    }
    
    if (data.weatherStats && data.weatherStats.length > 0) {
        html += `
            <div class="stat-section">
                <h3>Weather Performance</h3>
                <div class="weather-stats">
                    ${data.weatherStats.map(weather => {
                        const winRate = weather.matches > 0 ? ((weather.wins / weather.matches) * 100).toFixed(1) : 0;
                        return `
                            <div class="weather-item">
                                <div class="weather-name">${escapeHtml(weather.weather)}</div>
                                <div class="weather-data">
                                    <span>${weather.matches} matches (${winRate}% win)</span>
                                    <span>📏 ${weather.avg_distance.toFixed(1)}m avg</span>
                                    <span>💧 ${Math.round(weather.avg_volume)}mL avg</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    if (data.recentMatches && data.recentMatches.length > 0) {
        html += `
            <div class="stat-section">
                <h3>Recent Matches</h3>
                <div class="match-list">
                    ${data.recentMatches.slice(0, 10).map(match => `
                        <div class="match-item ${match.won ? 'won' : 'lost'}">
                            <div class="match-header">
                                <span class="match-opponent">${escapeHtml(username)} '${escapeHtml(match.characteristic || 'Unknown')}' vs ${escapeHtml(match.opponent)} '${escapeHtml(match.opponentCharacteristic || 'Unknown')}'</span>
                                <span class="match-result">${match.won ? 'W' : 'L'} ($${match.amount})</span>
                            </div>
                            <div class="match-details">
                                ${match.location ? `<span class="match-location">📍 ${escapeHtml(match.location)}</span>` : ''}
                                ${match.weather ? `<span class="match-weather">🌤️ ${escapeHtml(match.weather)}</span>` : ''}
                            </div>
                            <div class="match-stats">
                                <div class="player-stats">
                                    <span class="stats-label">${escapeHtml(username)}:</span>
                                    <span>📏 ${match.performance.distance.toFixed(1)}m</span>
                                    <span>💧 ${Math.round(match.performance.volume)}mL</span>
                                    <span>🎯 ${Math.round(match.performance.aim)}%</span>
                                    <span>⏱️ ${Math.round(match.performance.duration)}s</span>
                                    <span class="match-total">Total: ${match.performance.total}</span>
                                </div>
                                ${match.opponentPerformance ? `
                                <div class="player-stats">
                                    <span class="stats-label">${escapeHtml(match.opponent)}:</span>
                                    <span>📏 ${match.opponentPerformance.distance.toFixed(1)}m</span>
                                    <span>💧 ${Math.round(match.opponentPerformance.volume)}mL</span>
                                    <span>🎯 ${Math.round(match.opponentPerformance.aim)}%</span>
                                    <span>⏱️ ${Math.round(match.opponentPerformance.duration)}s</span>
                                    <span class="match-total">Total: ${match.opponentPerformance.total}</span>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    return html;
}

function renderSignSpinningStats(data, username) {
    const stats = data.stats;
    const perfectRate = stats.total_spins > 0 ? ((stats.perfect_days / stats.total_spins) * 100).toFixed(1) : 0;
    const carHitRate = stats.total_spins > 0 ? ((stats.cars_hit / stats.total_spins) * 100).toFixed(1) : 0;
    const dangerLevel = Math.min(((stats.cops_called + stats.cars_hit) / stats.total_spins * 100) || 0, 100);
    
    let html = `
        <div class="stat-section premium-section">
            <div class="section-header">
                <h3>🪧 Career Overview</h3>
                <div class="header-badge">${stats.total_spins} SHIFTS COMPLETED</div>
            </div>
            <div class="stat-grid fancy-grid">
                <div class="stat-item glass-card">
                    <div class="stat-icon">💼</div>
                    <span class="stat-label">Total Shifts</span>
                    <span class="stat-value large-value">${stats.total_spins}</span>
                    <div class="stat-sparkline"></div>
                </div>
                <div class="stat-item glass-card">
                    <div class="stat-icon">💰</div>
                    <span class="stat-label">Career Earnings</span>
                    <span class="stat-value large-value money-value">$${stats.total_earnings}</span>
                    <div class="money-glow"></div>
                </div>
                <div class="stat-item glass-card">
                    <div class="stat-icon">📊</div>
                    <span class="stat-label">Average Per Shift</span>
                    <span class="stat-value large-value">$${data.efficiency}</span>
                    <div class="efficiency-indicator ${data.efficiency >= 20 ? 'high' : data.efficiency >= 10 ? 'medium' : 'low'}"></div>
                </div>
                <div class="stat-item glass-card highlight-card">
                    <div class="stat-icon">🏆</div>
                    <span class="stat-label">Personal Best</span>
                    <span class="stat-value large-value trophy-value">$${stats.best_shift}</span>
                    <div class="trophy-glow"></div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>⚡ Performance Metrics</h3>
            <div class="performance-grid">
                <div class="performance-card perfect-days">
                    <div class="perf-header">
                        <span class="perf-icon">🌟</span>
                        <span class="perf-title">Perfect Days</span>
                    </div>
                    <div class="perf-value">${stats.perfect_days}</div>
                    <div class="fancy-progress-bar">
                        <div class="progress-track">
                            <div class="progress-fill gold-gradient" style="width: ${perfectRate}%">
                                <span class="progress-label">${perfectRate}%</span>
                            </div>
                        </div>
                    </div>
                    <div class="perf-description">No cops called!</div>
                </div>
                
                <div class="performance-card car-hits">
                    <div class="perf-header">
                        <span class="perf-icon">🚗</span>
                        <span class="perf-title">Vehicle Incidents</span>
                    </div>
                    <div class="perf-value">${stats.cars_hit}</div>
                    <div class="fancy-progress-bar">
                        <div class="progress-track">
                            <div class="progress-fill orange-gradient" style="width: ${carHitRate}%">
                                <span class="progress-label">${carHitRate}%</span>
                            </div>
                        </div>
                    </div>
                    <div class="perf-description">Oops moments</div>
                </div>
                
                <div class="performance-card cop-calls">
                    <div class="perf-header">
                        <span class="perf-icon">👮</span>
                        <span class="perf-title">Police Encounters</span>
                    </div>
                    <div class="perf-value">${stats.cops_called}</div>
                    <div class="fancy-progress-bar">
                        <div class="progress-track">
                            <div class="progress-fill red-gradient" style="width: ${data.copRate}%">
                                <span class="progress-label">${data.copRate}%</span>
                            </div>
                        </div>
                    </div>
                    <div class="perf-description">Unwanted attention</div>
                </div>
            </div>
            
            <div class="danger-meter-container">
                <h4>Danger Level</h4>
                <div class="danger-meter">
                    <div class="danger-zones">
                        <span class="zone safe">SAFE</span>
                        <span class="zone risky">RISKY</span>
                        <span class="zone danger">DANGER</span>
                    </div>
                    <div class="danger-track">
                        <div class="danger-fill" style="width: ${dangerLevel}%"></div>
                        <div class="danger-needle" style="left: ${dangerLevel}%"></div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>🎯 Efficiency Analysis</h3>
            <div class="efficiency-display">
                <div class="efficiency-circle">
                    <svg viewBox="0 0 200 200" class="efficiency-svg">
                        <circle cx="100" cy="100" r="90" class="efficiency-track-circle"/>
                        <circle cx="100" cy="100" r="90" class="efficiency-fill-circle" 
                                style="stroke-dashoffset: ${565 - (565 * Math.min((data.efficiency / 30), 1))}"/>
                    </svg>
                    <div class="efficiency-center">
                        <div class="efficiency-number">$${data.efficiency}</div>
                        <div class="efficiency-label">per shift</div>
                    </div>
                </div>
                <div class="efficiency-badge ${getSpinnerClass(data.efficiency)}">
                    <span class="badge-icon">${getSpinnerIcon(data.efficiency)}</span>
                    <span class="badge-text">${getSpinnerRating(data.efficiency)}</span>
                </div>
            </div>
            
            <div class="earnings-comparison">
                <div class="comparison-item worst">
                    <span class="comp-label">Worst Shift</span>
                    <span class="comp-value">$${stats.worst_shift}</span>
                </div>
                <div class="comparison-bar">
                    <div class="bar-worst" style="width: ${(stats.worst_shift / stats.best_shift) * 100}%"></div>
                    <div class="bar-avg" style="width: ${(data.efficiency / stats.best_shift) * 100}%"></div>
                    <div class="bar-best" style="width: 100%"></div>
                </div>
                <div class="comparison-item best">
                    <span class="comp-label">Best Shift</span>
                    <span class="comp-value">$${stats.best_shift}</span>
                </div>
            </div>
        </div>
    `;
    
    // Add recent shifts with fancy styling
    if (data.recentShifts && data.recentShifts.length > 0) {
        html += `
            <div class="stat-section">
                <h3>📋 Recent Performance</h3>
                <div class="shifts-timeline">
                    ${data.recentShifts.slice(0, 10).map((shift, index) => {
                        const shiftClass = shift.amount >= 25 ? 'legendary' : 
                                         shift.amount >= 20 ? 'excellent' : 
                                         shift.amount >= 15 ? 'good' : 
                                         shift.amount >= 10 ? 'average' : 
                                         shift.amount >= 5 ? 'poor' : 'terrible';
                        return `
                            <div class="timeline-item ${shiftClass}" style="animation-delay: ${index * 0.1}s">
                                <div class="timeline-marker"></div>
                                <div class="timeline-content">
                                    <div class="shift-header">
                                        <span class="shift-amount">$${shift.amount}</span>
                                        <span class="shift-badge ${shiftClass}">${getShiftLabel(shift.amount)}</span>
                                    </div>
                                    <div class="shift-details">
                                        <span class="shift-desc">${escapeHtml(shift.description || 'Sign spinning shift')}</span>
                                        <span class="shift-time">${shift.timeAgo || 'recently'}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    return html;
}

function getSpinnerRating(avgEarnings) {
    if (avgEarnings >= 25) return "LEGENDARY SPINNER";
    if (avgEarnings >= 20) return "PROFESSIONAL SPINNER";
    if (avgEarnings >= 15) return "SKILLED SPINNER";
    if (avgEarnings >= 10) return "AMATEUR SPINNER";
    if (avgEarnings >= 5) return "STRUGGLING SPINNER";
    return "TERRIBLE SPINNER";
}

function getSpinnerClass(avgEarnings) {
    if (avgEarnings >= 25) return "legendary";
    if (avgEarnings >= 20) return "professional";
    if (avgEarnings >= 15) return "skilled";
    if (avgEarnings >= 10) return "amateur";
    if (avgEarnings >= 5) return "struggling";
    return "terrible";
}

function getSpinnerIcon(avgEarnings) {
    if (avgEarnings >= 25) return "🌟";
    if (avgEarnings >= 20) return "💪";
    if (avgEarnings >= 15) return "👍";
    if (avgEarnings >= 10) return "👌";
    if (avgEarnings >= 5) return "😅";
    return "💩";
}

function getShiftLabel(amount) {
    if (amount >= 25) return "LEGENDARY";
    if (amount >= 20) return "EXCELLENT";
    if (amount >= 15) return "GOOD";
    if (amount >= 10) return "AVERAGE";
    if (amount >= 5) return "POOR";
    return "TERRIBLE";
}

function renderGamblerStats(data, username) {
    const netClass = data.totalProfit >= 0 ? 'profit' : 'loss';
    const totalWins = data.gameStats ? data.gameStats.reduce((sum, g) => sum + g.wins, 0) : 0;
    const totalLosses = data.gameStats ? data.gameStats.reduce((sum, g) => sum + g.losses, 0) : 0;
    const overallWinRate = data.totalGames > 0 ? ((totalWins / data.totalGames) * 100).toFixed(1) : 0;
    const luckMeter = calculateLuckLevel(data.totalProfit, data.totalGames);
    
    let html = `
        <div class="stat-section premium-section">
            <div class="section-header">
                <h3>🎰 Casino Performance</h3>
                <div class="header-badge ${netClass}">${netClass === 'profit' ? '💰 IN PROFIT' : '📉 IN THE RED'}</div>
            </div>
            <div class="stat-grid fancy-grid">
                <div class="stat-item glass-card">
                    <div class="stat-icon">🎲</div>
                    <span class="stat-label">Total Games</span>
                    <span class="stat-value large-value">${data.totalGames}</span>
                    <div class="stat-sparkline"></div>
                </div>
                <div class="stat-item glass-card">
                    <div class="stat-icon">📊</div>
                    <span class="stat-label">Win Rate</span>
                    <span class="stat-value large-value">${overallWinRate}%</span>
                    <div class="win-rate-mini-chart">
                        <div class="mini-chart-fill" style="width: ${overallWinRate}%"></div>
                    </div>
                </div>
                <div class="stat-item glass-card ${netClass === 'profit' ? 'profit-card' : 'loss-card'}">
                    <div class="stat-icon">${netClass === 'profit' ? '💵' : '💸'}</div>
                    <span class="stat-label">Net Position</span>
                    <span class="stat-value large-value ${netClass}">$${Math.abs(data.totalProfit)}</span>
                    <div class="${netClass}-glow"></div>
                </div>
                <div class="stat-item glass-card">
                    <div class="stat-icon">🏆</div>
                    <span class="stat-label">Win/Loss Record</span>
                    <span class="stat-value large-value">${totalWins}W - ${totalLosses}L</span>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>🍀 Luck Analysis</h3>
            <div class="luck-meter-container">
                <div class="luck-meter">
                    <div class="luck-zones">
                        <span class="luck-zone cursed">CURSED</span>
                        <span class="luck-zone unlucky">UNLUCKY</span>
                        <span class="luck-zone average">AVERAGE</span>
                        <span class="luck-zone lucky">LUCKY</span>
                        <span class="luck-zone blessed">BLESSED</span>
                    </div>
                    <div class="luck-track">
                        <div class="luck-fill" style="width: ${luckMeter}%"></div>
                        <div class="luck-indicator" style="left: ${luckMeter}%">
                            <span class="luck-emoji">${getLuckEmoji(luckMeter)}</span>
                        </div>
                    </div>
                </div>
                <p class="luck-description">${getLuckDescription(luckMeter, data.totalProfit)}</p>
            </div>
        </div>
    `;
    
    if (data.gameStats && data.gameStats.length > 0) {
        html += `
            <div class="stat-section">
                <h3>🎮 Game Performance</h3>
                <div class="game-cards-container">
                    ${data.gameStats.map(game => {
                        const winRate = game.plays > 0 ? ((game.wins / game.plays) * 100).toFixed(1) : 0;
                        const profitClass = game.net_profit >= 0 ? 'profit' : 'loss';
                        const gameIcon = getGameIcon(game.game);
                        const riskLevel = calculateRiskLevel(game.biggest_win, game.net_profit, game.plays);
                        
                        return `
                            <div class="game-performance-card ${profitClass}">
                                <div class="game-card-header">
                                    <div class="game-title">
                                        <span class="game-icon">${gameIcon}</span>
                                        <span class="game-name">${game.game.toUpperCase()}</span>
                                    </div>
                                    <div class="game-profit-badge ${profitClass}">
                                        ${profitClass === 'profit' ? '↑' : '↓'} $${Math.abs(game.net_profit)}
                                    </div>
                                </div>
                                
                                <div class="game-stats-visual">
                                    <div class="win-loss-chart">
                                        <div class="chart-bar wins" style="height: ${(game.wins / game.plays) * 100}%">
                                            <span class="bar-label">${game.wins}W</span>
                                        </div>
                                        <div class="chart-bar losses" style="height: ${(game.losses / game.plays) * 100}%">
                                            <span class="bar-label">${game.losses}L</span>
                                        </div>
                                    </div>
                                    
                                    <div class="game-metrics">
                                        <div class="metric">
                                            <span class="metric-label">Plays</span>
                                            <span class="metric-value">${game.plays}</span>
                                        </div>
                                        <div class="metric">
                                            <span class="metric-label">Win Rate</span>
                                            <span class="metric-value">${winRate}%</span>
                                        </div>
                                        <div class="metric highlight">
                                            <span class="metric-label">Best Win</span>
                                            <span class="metric-value">$${game.biggest_win}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="risk-meter">
                                    <span class="risk-label">Risk Level</span>
                                    <div class="risk-bar">
                                        <div class="risk-fill ${riskLevel}" style="width: ${getRiskPercentage(riskLevel)}%"></div>
                                    </div>
                                    <span class="risk-text">${riskLevel.toUpperCase()}</span>
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
                <h3>💰 Hall of Fame</h3>
                <div class="wins-showcase">
                    ${data.topWins.slice(0, 5).map((win, index) => `
                        <div class="win-showcase-item ${index === 0 ? 'jackpot' : ''}" style="animation-delay: ${index * 0.1}s">
                            <div class="win-rank">${index === 0 ? '👑' : `#${index + 1}`}</div>
                            <div class="win-details">
                                <div class="win-header">
                                    <span class="win-game-name">${getGameIcon(win.game)} ${win.game.toUpperCase()}</span>
                                    <span class="win-amount-big">$${win.amount}</span>
                                </div>
                                ${win.description ? `<div class="win-description">${escapeHtml(win.description)}</div>` : ''}
                                <div class="win-time">${win.timeAgo || 'Some time ago'}</div>
                            </div>
                            ${index === 0 ? '<div class="jackpot-glow"></div>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    if (data.recentGames && data.recentGames.length > 0) {
        html += `
            <div class="stat-section">
                <h3>📈 Recent Activity</h3>
                <div class="gambling-timeline">
                    ${data.recentGames.slice(0, 10).map((game, index) => {
                        const isWin = game.amount > 0;
                        return `
                            <div class="gambling-event ${isWin ? 'win' : 'loss'}" style="animation-delay: ${index * 0.05}s">
                                <div class="event-marker ${isWin ? 'win' : 'loss'}"></div>
                                <div class="event-content">
                                    <div class="event-header">
                                        <span class="event-game">${getGameIcon(game.game)} ${game.game}</span>
                                        <span class="event-amount ${isWin ? 'win' : 'loss'}">
                                            ${isWin ? '+' : ''}$${Math.abs(game.amount)}
                                        </span>
                                    </div>
                                    <div class="event-time">${game.timeAgo || 'recently'}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    return html;
}

function calculateLuckLevel(profit, games) {
    if (games === 0) return 50;
    const profitPerGame = profit / games;
    if (profitPerGame > 50) return 90;
    if (profitPerGame > 20) return 75;
    if (profitPerGame > 0) return 60;
    if (profitPerGame > -10) return 40;
    if (profitPerGame > -30) return 25;
    return 10;
}

function getLuckEmoji(luckLevel) {
    if (luckLevel >= 80) return "🍀";
    if (luckLevel >= 60) return "🎲";
    if (luckLevel >= 40) return "😐";
    if (luckLevel >= 20) return "😰";
    return "💀";
}

function getLuckDescription(luckLevel, profit) {
    if (luckLevel >= 80) return "Lady Luck is on your side, mate! Keep riding that wave!";
    if (luckLevel >= 60) return "Not bad, you're doing alright at the tables!";
    if (luckLevel >= 40) return "Win some, lose some. That's gambling for ya!";
    if (luckLevel >= 20) return "Rough patch there, might be time for a break...";
    return "The house always wins in the end, doesn't it?";
}

function getGameIcon(game) {
    const icons = {
        'pokies': '🎰',
        'scratchie': '🎟️',
        'tab': '🏇',
        'blackjack': '🃏',
        'roulette': '🎡',
        'dice': '🎲'
    };
    return icons[game.toLowerCase()] || '🎮';
}

function calculateRiskLevel(biggestWin, netProfit, plays) {
    const avgBet = biggestWin / plays;
    if (avgBet > 100) return 'extreme';
    if (avgBet > 50) return 'high';
    if (avgBet > 20) return 'moderate';
    return 'low';
}

function getRiskPercentage(level) {
    const percentages = {
        'extreme': 100,
        'high': 75,
        'moderate': 50,
        'low': 25
    };
    return percentages[level] || 50;
}

function renderFishingStats(data, username) {
    const avgWeight = data.totalCatches > 0 ? (data.totalWeight / data.totalCatches).toFixed(1) : 0;
    const totalValue = data.topCatches ? data.topCatches.reduce((sum, c) => sum + c.amount, 0) : 0;
    const fisherLevel = calculateFisherLevel(data.totalCatches, avgWeight);
    
    let html = `
        <div class="stat-section aquatic-section">
            <div class="water-effect"></div>
            <div class="section-header">
                <h3>🎣 Fishing Career</h3>
                <div class="header-badge fisher-badge">${getFisherTitle(fisherLevel)}</div>
            </div>
            <div class="stat-grid fancy-grid">
                <div class="stat-item glass-card water-card">
                    <div class="stat-icon">🐟</div>
                    <span class="stat-label">Total Catches</span>
                    <span class="stat-value large-value">${data.totalCatches}</span>
                    <div class="fish-bubbles"></div>
                </div>
                <div class="stat-item glass-card water-card">
                    <div class="stat-icon">⚖️</div>
                    <span class="stat-label">Total Weight</span>
                    <span class="stat-value large-value">${data.totalWeight}kg</span>
                    <div class="weight-indicator">Avg: ${avgWeight}kg</div>
                </div>
                <div class="stat-item glass-card water-card">
                    <div class="stat-icon">💰</div>
                    <span class="stat-label">Total Value</span>
                    <span class="stat-value large-value money-value">$${totalValue}</span>
                </div>
                <div class="stat-item glass-card water-card highlight-card">
                    <div class="stat-icon">🏆</div>
                    <span class="stat-label">Fisher Level</span>
                    <span class="stat-value large-value">${fisherLevel}</span>
                    <div class="level-stars">${'⭐'.repeat(Math.min(fisherLevel, 5))}</div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>🏆 Trophy Wall</h3>
            <div class="trophy-display">
                ${data.topCatches.slice(0, 5).map((fishCatch, i) => {
                    const sizeClass = getSizeClass(fishCatch.weight);
                    const rarityClass = getRarityClass(fishCatch.fish_type);
                    return `
                        <div class="trophy-fish ${i === 0 ? 'biggest-catch' : ''}" style="animation-delay: ${i * 0.15}s">
                            <div class="trophy-rank ${i < 3 ? 'podium' : ''}">${getTrophyIcon(i)}</div>
                            <div class="fish-plaque">
                                <div class="fish-icon-display">
                                    <span class="fish-emoji">${getFishEmoji(fishCatch.fish_type)}</span>
                                    ${i === 0 ? '<div class="trophy-shine"></div>' : ''}
                                </div>
                                <div class="fish-details">
                                    <div class="fish-species ${rarityClass}">${escapeHtml(fishCatch.fish_type)}</div>
                                    <div class="fish-measurements">
                                        <span class="weight-badge ${sizeClass}">${fishCatch.weight.toFixed(1)}kg</span>
                                        <span class="value-badge">$${fishCatch.amount}</span>
                                    </div>
                                    <div class="catch-date">${fishCatch.timeAgo || 'Some time ago'}</div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    if (data.fishTypes && data.fishTypes.length > 0) {
        const sortedTypes = [...data.fishTypes].sort((a, b) => b.biggest - a.biggest);
        html += `
            <div class="stat-section">
                <h3>🐠 Fish Collection</h3>
                <div class="fish-collection">
                    ${sortedTypes.map(type => {
                        const rarity = getRarityClass(type.fish_type);
                        const avgTypeWeight = (type.total_weight / type.count).toFixed(1);
                        return `
                            <div class="fish-species-card ${rarity}">
                                <div class="species-header">
                                    <span class="species-emoji">${getFishEmoji(type.fish_type)}</span>
                                    <span class="species-name">${escapeHtml(type.fish_type)}</span>
                                </div>
                                <div class="species-stats">
                                    <div class="stat-row">
                                        <span class="stat-icon">📊</span>
                                        <span class="stat-text">Caught: ${type.count} times</span>
                                    </div>
                                    <div class="stat-row">
                                        <span class="stat-icon">⚖️</span>
                                        <span class="stat-text">Total: ${type.total_weight.toFixed(1)}kg</span>
                                    </div>
                                    <div class="stat-row highlight">
                                        <span class="stat-icon">🏆</span>
                                        <span class="stat-text">Record: ${type.biggest.toFixed(1)}kg</span>
                                    </div>
                                    <div class="stat-row">
                                        <span class="stat-icon">📏</span>
                                        <span class="stat-text">Average: ${avgTypeWeight}kg</span>
                                    </div>
                                </div>
                                <div class="rarity-indicator ${rarity}">
                                    <span class="rarity-label">${rarity.toUpperCase()}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    // Add size distribution chart if we have enough data
    if (data.topCatches && data.topCatches.length > 0) {
        const sizeDistribution = calculateSizeDistribution(data.topCatches);
        html += `
            <div class="stat-section">
                <h3>📊 Catch Size Distribution</h3>
                <div class="size-distribution">
                    <div class="distribution-chart">
                        ${Object.entries(sizeDistribution).map(([range, count]) => {
                            const percentage = (count / data.topCatches.length) * 100;
                            return `
                                <div class="size-bar-container">
                                    <div class="size-bar" style="height: ${percentage * 2}px">
                                        <span class="bar-count">${count}</span>
                                    </div>
                                    <span class="size-label">${range}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="distribution-legend">
                        <div class="legend-item"><span class="legend-color small"></span>Small (0-5kg)</div>
                        <div class="legend-item"><span class="legend-color medium"></span>Medium (5-15kg)</div>
                        <div class="legend-item"><span class="legend-color large"></span>Large (15-30kg)</div>
                        <div class="legend-item"><span class="legend-color monster"></span>Monster (30kg+)</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Add recent catches timeline
    if (data.recentCatches && data.recentCatches.length > 0) {
        html += `
            <div class="stat-section">
                <h3>🌊 Recent Activity</h3>
                <div class="fishing-timeline">
                    <div class="water-line"></div>
                    ${data.recentCatches.slice(0, 10).map((fishCatch, index) => {
                        const sizeClass = getSizeClass(fishCatch.weight);
                        return `
                            <div class="fishing-event ${sizeClass}" style="animation-delay: ${index * 0.1}s">
                                <div class="event-hook"></div>
                                <div class="catch-card">
                                    <div class="catch-info">
                                        <span class="fish-type">${getFishEmoji(fishCatch.fish_type)} ${escapeHtml(fishCatch.fish_type)}</span>
                                        <span class="fish-weight ${sizeClass}">${fishCatch.weight.toFixed(1)}kg</span>
                                    </div>
                                    <div class="catch-meta">
                                        <span class="catch-value">$${fishCatch.amount}</span>
                                        <span class="catch-time">${fishCatch.timeAgo || 'recently'}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    return html;
}

function calculateFisherLevel(totalCatches, avgWeight) {
    const catchScore = Math.min(totalCatches / 20, 5);
    const weightScore = Math.min(parseFloat(avgWeight) / 10, 5);
    return Math.ceil((catchScore + weightScore) / 2);
}

function getFisherTitle(level) {
    const titles = [
        "NOVICE ANGLER",
        "AMATEUR FISHER",
        "SEASONED ANGLER",
        "EXPERT FISHER",
        "MASTER ANGLER",
        "LEGENDARY FISHERMAN"
    ];
    return titles[Math.min(level - 1, 5)] || "BEGINNER";
}

function getSizeClass(weight) {
    if (weight >= 30) return 'monster';
    if (weight >= 15) return 'large';
    if (weight >= 5) return 'medium';
    return 'small';
}

function getRarityClass(fishType) {
    // Mock rarity based on fish name patterns
    const lowerType = fishType.toLowerCase();
    if (lowerType.includes('shark') || lowerType.includes('marlin') || lowerType.includes('tuna')) return 'legendary';
    if (lowerType.includes('salmon') || lowerType.includes('bass') || lowerType.includes('cod')) return 'rare';
    if (lowerType.includes('trout') || lowerType.includes('perch')) return 'uncommon';
    return 'common';
}

function getFishEmoji(fishType) {
    const lowerType = fishType.toLowerCase();
    if (lowerType.includes('shark')) return '🦈';
    if (lowerType.includes('whale')) return '🐋';
    if (lowerType.includes('octopus')) return '🐙';
    if (lowerType.includes('crab')) return '🦀';
    if (lowerType.includes('lobster')) return '🦞';
    if (lowerType.includes('shrimp')) return '🦐';
    if (lowerType.includes('squid')) return '🦑';
    if (lowerType.includes('tuna') || lowerType.includes('marlin')) return '🐟';
    return '🐠';
}

function getTrophyIcon(rank) {
    if (rank === 0) return '🥇';
    if (rank === 1) return '🥈';
    if (rank === 2) return '🥉';
    return `#${rank + 1}`;
}

function calculateSizeDistribution(catches) {
    const distribution = {
        '0-5kg': 0,
        '5-15kg': 0,
        '15-30kg': 0,
        '30kg+': 0
    };
    
    catches.forEach(c => {
        if (c.weight < 5) distribution['0-5kg']++;
        else if (c.weight < 15) distribution['5-15kg']++;
        else if (c.weight < 30) distribution['15-30kg']++;
        else distribution['30kg+']++;
    });
    
    return distribution;
}

function renderBeggarStats(data, username) {
    const allTime = data.allTime;
    const successfulBegs = allTime.total_earned > 0 ? Math.floor(allTime.total_begs * (allTime.total_earned / (allTime.total_earned + allTime.total_lost))) : 0;
    const successRate = allTime.total_begs > 0 ? ((successfulBegs / allTime.total_begs) * 100).toFixed(1) : 0;
    const netEarnings = allTime.total_earned - allTime.total_lost;
    const avgPerBeg = allTime.total_begs > 0 ? (netEarnings / allTime.total_begs).toFixed(2) : 0;
    const desperation = calculateDesperationLevel(allTime.total_begs, successRate);
    
    let html = `
        <div class="stat-section street-section">
            <div class="grunge-overlay"></div>
            <div class="section-header">
                <h3>🤲 Street Performance</h3>
                <div class="header-badge ${netEarnings >= 0 ? 'surviving' : 'struggling'}">
                    ${netEarnings >= 0 ? '💰 SURVIVING' : '💸 STRUGGLING'}
                </div>
            </div>
            <div class="stat-grid fancy-grid">
                <div class="stat-item glass-card street-card">
                    <div class="stat-icon">🙏</div>
                    <span class="stat-label">Total Attempts</span>
                    <span class="stat-value large-value">${allTime.total_begs}</span>
                    <div class="street-dust"></div>
                </div>
                <div class="stat-item glass-card street-card ${netEarnings >= 0 ? 'profit' : 'loss'}">
                    <div class="stat-icon">${netEarnings >= 0 ? '💵' : '🚫'}</div>
                    <span class="stat-label">Net Position</span>
                    <span class="stat-value large-value ${netEarnings >= 0 ? 'profit' : 'loss'}">
                        ${netEarnings >= 0 ? '+' : ''}$${Math.abs(netEarnings)}
                    </span>
                    <div class="stat-extra">Avg: $${avgPerBeg} per beg</div>
                </div>
                <div class="stat-item glass-card street-card">
                    <div class="stat-icon">✅</div>
                    <span class="stat-label">Success Rate</span>
                    <span class="stat-value large-value">${successRate}%</span>
                    <div class="success-meter-mini">
                        <div class="meter-fill" style="width: ${successRate}%"></div>
                    </div>
                </div>
                <div class="stat-item glass-card street-card highlight-card">
                    <div class="stat-icon">🏆</div>
                    <span class="stat-label">Best Handout</span>
                    <span class="stat-value large-value trophy-value">$${allTime.best_handout || 0}</span>
                    <div class="handout-glow"></div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>💸 Financial Breakdown</h3>
            <div class="financial-display">
                <div class="money-flow">
                    <div class="flow-item earned">
                        <div class="flow-icon">📈</div>
                        <div class="flow-details">
                            <span class="flow-label">Total Received</span>
                            <span class="flow-amount">+$${allTime.total_earned}</span>
                            <span class="flow-count">${successfulBegs} successful begs</span>
                        </div>
                    </div>
                    <div class="flow-divider"></div>
                    <div class="flow-item lost">
                        <div class="flow-icon">📉</div>
                        <div class="flow-details">
                            <span class="flow-label">Total Robbed</span>
                            <span class="flow-amount">-$${allTime.total_lost}</span>
                            <span class="flow-count">${allTime.total_begs - successfulBegs} bad encounters</span>
                        </div>
                    </div>
                </div>
                <div class="worst-robbery">
                    <span class="robbery-label">Worst Robbery:</span>
                    <span class="robbery-amount">-$${allTime.worst_robbery || 0}</span>
                    <span class="robbery-icon">😭</span>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>😳 Shame & Desperation Meter</h3>
            <div class="desperation-display">
                <div class="shame-level-indicator">
                    <div class="shame-emoji">${getShameEmoji(allTime.total_begs)}</div>
                    <div class="shame-title">${getShameLevel(allTime.total_begs)}</div>
                </div>
                <div class="desperation-meter">
                    <div class="meter-track">
                        <div class="desperation-zones">
                            <span class="zone dignified">DIGNIFIED</span>
                            <span class="zone desperate">DESPERATE</span>
                            <span class="zone shameless">SHAMELESS</span>
                        </div>
                        <div class="desperation-fill" style="width: ${desperation}%">
                            <div class="desperation-pulse"></div>
                        </div>
                    </div>
                    <div class="meter-stats">
                        <div class="meter-stat">
                            <span class="stat-label">Pride Lost:</span>
                            <span class="stat-value">${Math.min(allTime.total_begs * 2, 100)}%</span>
                        </div>
                        <div class="meter-stat">
                            <span class="stat-label">Shame Gained:</span>
                            <span class="stat-value">${Math.min(allTime.total_begs * 3, 150)}%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>📊 Begging Analytics</h3>
            <div class="analytics-grid">
                <div class="analytic-card">
                    <h4>Success Breakdown</h4>
                    <div class="pie-chart">
                        <svg viewBox="0 0 100 100" class="donut-chart">
                            <circle cx="50" cy="50" r="40" class="donut-track"/>
                            <circle cx="50" cy="50" r="40" class="donut-segment success" 
                                    style="stroke-dasharray: ${successRate * 2.51} ${251 - (successRate * 2.51)}; stroke-dashoffset: 0;"/>
                            <circle cx="50" cy="50" r="40" class="donut-segment fail" 
                                    style="stroke-dasharray: ${(100 - successRate) * 2.51} ${251 - ((100 - successRate) * 2.51)}; stroke-dashoffset: -${successRate * 2.51};"/>
                        </svg>
                        <div class="chart-center">
                            <span class="chart-value">${successRate}%</span>
                            <span class="chart-label">Success</span>
                        </div>
                    </div>
                    <div class="chart-legend">
                        <div class="legend-item success"><span></span>Handouts: ${successfulBegs}</div>
                        <div class="legend-item fail"><span></span>Robberies: ${allTime.total_begs - successfulBegs}</div>
                    </div>
                </div>
                
                <div class="analytic-card">
                    <h4>Begging Efficiency</h4>
                    <div class="efficiency-metrics">
                        <div class="eff-metric">
                            <span class="eff-icon">⏱️</span>
                            <span class="eff-label">Per Attempt:</span>
                            <span class="eff-value ${avgPerBeg >= 0 ? 'positive' : 'negative'}">$${avgPerBeg}</span>
                        </div>
                        <div class="eff-metric">
                            <span class="eff-icon">💰</span>
                            <span class="eff-label">Best Hour:</span>
                            <span class="eff-value">$${Math.round(allTime.best_handout * 0.6)}/hr</span>
                        </div>
                        <div class="eff-metric">
                            <span class="eff-icon">📈</span>
                            <span class="eff-label">Daily Goal:</span>
                            <span class="eff-value">$${Math.round(avgPerBeg * 20)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add recent begging activity if available
    if (data.recentBegs && data.recentBegs.length > 0) {
        html += `
            <div class="stat-section">
                <h3>🚶 Recent Activity</h3>
                <div class="begging-timeline">
                    <div class="street-line"></div>
                    ${data.recentBegs.slice(0, 10).map((beg, index) => {
                        const isSuccess = beg.amount > 0;
                        return `
                            <div class="beg-event ${isSuccess ? 'success' : 'fail'}" style="animation-delay: ${index * 0.1}s">
                                <div class="event-marker ${isSuccess ? 'handout' : 'robbery'}">
                                    ${isSuccess ? '💵' : '🚫'}
                                </div>
                                <div class="beg-details">
                                    <div class="beg-result">
                                        <span class="result-text">${isSuccess ? 'Received handout' : 'Got robbed'}</span>
                                        <span class="result-amount ${isSuccess ? 'earned' : 'lost'}">
                                            ${isSuccess ? '+' : '-'}$${Math.abs(beg.amount)}
                                        </span>
                                    </div>
                                    <div class="beg-time">${beg.timeAgo || 'recently'}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }
    
    return html;
}

function calculateDesperationLevel(totalBegs, successRate) {
    const desperation = Math.min((totalBegs / 100) * 100, 100);
    const successModifier = (100 - parseFloat(successRate)) / 100;
    return Math.min(desperation * (1 + successModifier), 100);
}

function getShameEmoji(begs) {
    if (begs >= 100) return "🤡";
    if (begs >= 50) return "😭";
    if (begs >= 20) return "😔";
    if (begs >= 10) return "😕";
    if (begs >= 5) return "😐";
    return "😊";
}

function renderJobStats(data, category, username) {
    if (category === 'bottles') {
        return renderBottleStats(data, username);
    } else {
        return renderCashieStats(data, username);
    }
}

function renderBottleStats(data, username) {
    const allTime = data.allTime;
    const efficiency = allTime.total_jobs > 0 ? ((allTime.total_bottles / allTime.total_jobs) || 10).toFixed(1) : 0;
    const avgBottlesPerJob = allTime.total_jobs > 0 ? (allTime.total_bottles / allTime.total_jobs).toFixed(1) : 0;
    const recyclingRate = 98.5; // Recycling efficiency percentage
    const hazardLevel = Math.min(((allTime.injuries || 0) / allTime.total_jobs * 100) || 0, 100);
    
    let html = `
        <div class="stat-section eco-section">
            <div class="recycling-pattern"></div>
            <div class="section-header">
                <h3>♻️ Recycling Career</h3>
                <div class="header-badge eco-badge">
                    ${allTime.total_bottles || 0} BOTTLES SAVED
                </div>
            </div>
            <div class="stat-grid fancy-grid">
                <div class="stat-item glass-card eco-card">
                    <div class="stat-icon">🧹</div>
                    <span class="stat-label">Collection Runs</span>
                    <span class="stat-value large-value">${allTime.total_jobs}</span>
                    <div class="eco-sparkle"></div>
                </div>
                <div class="stat-item glass-card eco-card">
                    <div class="stat-icon">♻️</div>
                    <span class="stat-label">Bottles Collected</span>
                    <span class="stat-value large-value">${allTime.total_bottles || 0}</span>
                    <div class="bottle-shine"></div>
                </div>
                <div class="stat-item glass-card eco-card">
                    <div class="stat-icon">💵</div>
                    <span class="stat-label">Total Earnings</span>
                    <span class="stat-value large-value money-value">$${allTime.total_earned}</span>
                    <div class="money-glow"></div>
                </div>
                <div class="stat-item glass-card eco-card highlight-card">
                    <div class="stat-icon">🏆</div>
                    <span class="stat-label">Best Haul</span>
                    <span class="stat-value large-value trophy-value">$${allTime.best_job}</span>
                    <div class="trophy-glow"></div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>🗺️ Route Efficiency</h3>
            <div class="route-display">
                <div class="efficiency-meter">
                    <div class="meter-header">
                        <span class="meter-title">Collection Efficiency</span>
                        <span class="meter-value">${efficiency} bottles/run</span>
                    </div>
                    <div class="circular-progress">
                        <svg viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" class="progress-track"/>
                            <circle cx="50" cy="50" r="45" class="progress-fill efficiency-gradient" 
                                    style="stroke-dasharray: ${efficiency * 2.83} ${283 - (efficiency * 2.83)}"/>
                        </svg>
                        <div class="progress-center">
                            <span class="progress-value">${avgBottlesPerJob}</span>
                            <span class="progress-label">avg/run</span>
                        </div>
                    </div>
                </div>
                <div class="route-stats">
                    <div class="route-stat">
                        <span class="route-icon">🚶</span>
                        <span class="route-label">Distance Covered:</span>
                        <span class="route-value">${(allTime.total_jobs * 3.2).toFixed(1)} km</span>
                    </div>
                    <div class="route-stat">
                        <span class="route-icon">⏱️</span>
                        <span class="route-label">Time Invested:</span>
                        <span class="route-value">${(allTime.total_jobs * 2.5).toFixed(0)} hours</span>
                    </div>
                    <div class="route-stat">
                        <span class="route-icon">💰</span>
                        <span class="route-label">Hourly Rate:</span>
                        <span class="route-value">$${(allTime.total_earned / (allTime.total_jobs * 2.5 || 1)).toFixed(2)}/hr</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>📍 Location Analysis</h3>
            <div class="location-heatmap">
                <div class="heatmap-header">Top Collection Spots</div>
                <div class="location-grid">
                    <div class="location-spot hot">
                        <span class="spot-name">Park Bins</span>
                        <span class="spot-yield">~${Math.round(avgBottlesPerJob * 1.5)} bottles</span>
                        <div class="heat-indicator"></div>
                    </div>
                    <div class="location-spot warm">
                        <span class="spot-name">Beach Area</span>
                        <span class="spot-yield">~${Math.round(avgBottlesPerJob * 1.2)} bottles</span>
                        <div class="heat-indicator"></div>
                    </div>
                    <div class="location-spot medium">
                        <span class="spot-name">Shopping Center</span>
                        <span class="spot-yield">~${Math.round(avgBottlesPerJob * 0.9)} bottles</span>
                        <div class="heat-indicator"></div>
                    </div>
                    <div class="location-spot cool">
                        <span class="spot-name">Residential</span>
                        <span class="spot-yield">~${Math.round(avgBottlesPerJob * 0.6)} bottles</span>
                        <div class="heat-indicator"></div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>🛒 Equipment Progression</h3>
            <div class="equipment-display">
                <div class="equipment-timeline">
                    <div class="timeline-track"></div>
                    <div class="equipment-stage ${allTime.total_jobs >= 1 ? 'unlocked' : 'locked'}">
                        <div class="stage-icon">🤲</div>
                        <div class="stage-info">
                            <span class="stage-name">Bare Hands</span>
                            <span class="stage-desc">Started from the bottom</span>
                        </div>
                    </div>
                    <div class="equipment-stage ${allTime.total_jobs >= 10 ? 'unlocked' : 'locked'}">
                        <div class="stage-icon">🎒</div>
                        <div class="stage-info">
                            <span class="stage-name">Backpack</span>
                            <span class="stage-desc">+50% capacity</span>
                        </div>
                    </div>
                    <div class="equipment-stage ${allTime.total_jobs >= 50 ? 'unlocked' : 'locked'}">
                        <div class="stage-icon">🛒</div>
                        <div class="stage-info">
                            <span class="stage-name">Shopping Trolley</span>
                            <span class="stage-desc">+200% capacity</span>
                        </div>
                    </div>
                    <div class="equipment-stage ${allTime.total_jobs >= 100 ? 'unlocked' : 'locked'}">
                        <div class="stage-icon">🚐</div>
                        <div class="stage-info">
                            <span class="stage-name">Collection Van</span>
                            <span class="stage-desc">Industrial scale!</span>
                        </div>
                    </div>
                </div>
                <div class="current-loadout">
                    <span class="loadout-label">Current Setup:</span>
                    <span class="loadout-value">${getEquipmentLevel(allTime.total_jobs)}</span>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>⚠️ Hazards & Safety</h3>
            <div class="hazard-display">
                <div class="danger-meter">
                    <div class="meter-header">
                        <span class="meter-title">Danger Level</span>
                        <span class="meter-emoji">${getHazardEmoji(hazardLevel)}</span>
                    </div>
                    <div class="danger-bar">
                        <div class="danger-track">
                            <div class="danger-zones">
                                <span class="zone safe">SAFE</span>
                                <span class="zone caution">CAUTION</span>
                                <span class="zone danger">DANGER</span>
                            </div>
                            <div class="danger-fill" style="width: ${hazardLevel}%">
                                <div class="danger-pulse"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="hazard-stats">
                    <div class="hazard-item">
                        <span class="hazard-icon">🩹</span>
                        <span class="hazard-label">Injuries:</span>
                        <span class="hazard-value">${allTime.injuries || 0}</span>
                    </div>
                    <div class="hazard-item">
                        <span class="hazard-icon">🦝</span>
                        <span class="hazard-label">Raccoon Encounters:</span>
                        <span class="hazard-value">${Math.round(allTime.total_jobs * 0.15)}</span>
                    </div>
                    <div class="hazard-item">
                        <span class="hazard-icon">💉</span>
                        <span class="hazard-label">Sketchy Finds:</span>
                        <span class="hazard-value">${Math.round(allTime.total_jobs * 0.08)}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>🌍 Environmental Impact</h3>
            <div class="impact-display">
                <div class="impact-card positive">
                    <div class="impact-icon">🌱</div>
                    <div class="impact-info">
                        <span class="impact-label">Carbon Saved</span>
                        <span class="impact-value">${(allTime.total_bottles * 0.082).toFixed(1)} kg CO₂</span>
                    </div>
                </div>
                <div class="impact-card positive">
                    <div class="impact-icon">🌊</div>
                    <div class="impact-info">
                        <span class="impact-label">Ocean Protected</span>
                        <span class="impact-value">${allTime.total_bottles} bottles</span>
                    </div>
                </div>
                <div class="impact-card positive">
                    <div class="impact-icon">♻️</div>
                    <div class="impact-info">
                        <span class="impact-label">Recycling Rate</span>
                        <span class="impact-value">${recyclingRate}%</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return html;
}

function renderCashieStats(data, username) {
    const allTime = data.allTime;
    const avgPerJob = allTime.total_jobs > 0 ? (allTime.total_earned / allTime.total_jobs).toFixed(2) : 0;
    const jobCompletionRate = 94.5; // Percentage of jobs completed successfully
    const performanceLevel = calculatePerformanceLevel(allTime.total_jobs, avgPerJob);
    
    let html = `
        <div class="stat-section work-section">
            <div class="construction-pattern"></div>
            <div class="section-header">
                <h3>💪 Labor Statistics</h3>
                <div class="header-badge work-badge">
                    ${allTime.total_jobs} JOBS COMPLETED
                </div>
            </div>
            <div class="stat-grid fancy-grid">
                <div class="stat-item glass-card work-card">
                    <div class="stat-icon">🔨</div>
                    <span class="stat-label">Total Jobs</span>
                    <span class="stat-value large-value">${allTime.total_jobs}</span>
                    <div class="work-dust"></div>
                </div>
                <div class="stat-item glass-card work-card">
                    <div class="stat-icon">💰</div>
                    <span class="stat-label">Total Earned</span>
                    <span class="stat-value large-value money-value">$${allTime.total_earned}</span>
                    <div class="money-glow"></div>
                </div>
                <div class="stat-item glass-card work-card">
                    <div class="stat-icon">📊</div>
                    <span class="stat-label">Average Rate</span>
                    <span class="stat-value large-value">$${avgPerJob}</span>
                    <div class="rate-indicator ${parseFloat(avgPerJob) >= 100 ? 'high' : parseFloat(avgPerJob) >= 50 ? 'medium' : 'low'}"></div>
                </div>
                <div class="stat-item glass-card work-card highlight-card">
                    <div class="stat-icon">🏆</div>
                    <span class="stat-label">Best Payday</span>
                    <span class="stat-value large-value trophy-value">$${allTime.best_job}</span>
                    <div class="trophy-glow"></div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>🏗️ Job Types & Performance</h3>
            <div class="job-breakdown">
                <div class="job-category construction">
                    <div class="job-header">
                        <span class="job-icon">🏗️</span>
                        <span class="job-name">Construction</span>
                        <span class="job-count">${Math.round(allTime.total_jobs * 0.4)} jobs</span>
                    </div>
                    <div class="job-stats">
                        <div class="job-stat">
                            <span class="stat-label">Avg Pay:</span>
                            <span class="stat-value">$${(parseFloat(avgPerJob) * 1.2).toFixed(2)}</span>
                        </div>
                        <div class="job-stat">
                            <span class="stat-label">Difficulty:</span>
                            <div class="difficulty-bar hard">
                                <div class="difficulty-fill" style="width: 80%"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="job-category moving">
                    <div class="job-header">
                        <span class="job-icon">📦</span>
                        <span class="job-name">Moving/Delivery</span>
                        <span class="job-count">${Math.round(allTime.total_jobs * 0.3)} jobs</span>
                    </div>
                    <div class="job-stats">
                        <div class="job-stat">
                            <span class="stat-label">Avg Pay:</span>
                            <span class="stat-value">$${avgPerJob}</span>
                        </div>
                        <div class="job-stat">
                            <span class="stat-label">Difficulty:</span>
                            <div class="difficulty-bar medium">
                                <div class="difficulty-fill" style="width: 60%"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="job-category landscaping">
                    <div class="job-header">
                        <span class="job-icon">🌿</span>
                        <span class="job-name">Landscaping</span>
                        <span class="job-count">${Math.round(allTime.total_jobs * 0.2)} jobs</span>
                    </div>
                    <div class="job-stats">
                        <div class="job-stat">
                            <span class="stat-label">Avg Pay:</span>
                            <span class="stat-value">$${(parseFloat(avgPerJob) * 0.9).toFixed(2)}</span>
                        </div>
                        <div class="job-stat">
                            <span class="stat-label">Difficulty:</span>
                            <div class="difficulty-bar medium">
                                <div class="difficulty-fill" style="width: 50%"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="job-category other">
                    <div class="job-header">
                        <span class="job-icon">🔧</span>
                        <span class="job-name">Misc Labor</span>
                        <span class="job-count">${Math.round(allTime.total_jobs * 0.1)} jobs</span>
                    </div>
                    <div class="job-stats">
                        <div class="job-stat">
                            <span class="stat-label">Avg Pay:</span>
                            <span class="stat-value">$${(parseFloat(avgPerJob) * 0.8).toFixed(2)}</span>
                        </div>
                        <div class="job-stat">
                            <span class="stat-label">Difficulty:</span>
                            <div class="difficulty-bar easy">
                                <div class="difficulty-fill" style="width: 40%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>💼 Work Performance</h3>
            <div class="performance-display">
                <div class="performance-meter">
                    <div class="meter-header">
                        <span class="meter-title">Worker Rating</span>
                        <span class="meter-stars">${getPerformanceStars(performanceLevel)}</span>
                    </div>
                    <div class="circular-progress large">
                        <svg viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="54" class="progress-track"/>
                            <circle cx="60" cy="60" r="54" class="progress-fill performance-gradient" 
                                    style="stroke-dasharray: ${performanceLevel * 3.39} ${339 - (performanceLevel * 3.39)}"/>
                        </svg>
                        <div class="progress-center">
                            <span class="progress-value">${performanceLevel}%</span>
                            <span class="progress-label">Rating</span>
                        </div>
                    </div>
                </div>
                <div class="performance-stats">
                    <div class="perf-stat">
                        <span class="perf-icon">✅</span>
                        <span class="perf-label">Completion Rate:</span>
                        <span class="perf-value">${jobCompletionRate}%</span>
                    </div>
                    <div class="perf-stat">
                        <span class="perf-icon">⏰</span>
                        <span class="perf-label">Punctuality:</span>
                        <span class="perf-value">${(jobCompletionRate - 2).toFixed(1)}%</span>
                    </div>
                    <div class="perf-stat">
                        <span class="perf-icon">💪</span>
                        <span class="perf-label">Endurance:</span>
                        <span class="perf-value">${Math.min(allTime.total_jobs * 2, 100)}%</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>🛠️ Skills & Equipment</h3>
            <div class="skills-display">
                <div class="skill-grid">
                    <div class="skill-item ${allTime.total_jobs >= 5 ? 'unlocked' : 'locked'}">
                        <div class="skill-icon">🔨</div>
                        <div class="skill-info">
                            <span class="skill-name">Basic Tools</span>
                            <div class="skill-progress">
                                <div class="progress-fill" style="width: ${Math.min(allTime.total_jobs * 20, 100)}%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="skill-item ${allTime.total_jobs >= 20 ? 'unlocked' : 'locked'}">
                        <div class="skill-icon">⚡</div>
                        <div class="skill-info">
                            <span class="skill-name">Power Tools</span>
                            <div class="skill-progress">
                                <div class="progress-fill" style="width: ${Math.min((allTime.total_jobs - 20) * 5, 100)}%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="skill-item ${allTime.total_jobs >= 50 ? 'unlocked' : 'locked'}">
                        <div class="skill-icon">🏗️</div>
                        <div class="skill-info">
                            <span class="skill-name">Heavy Machinery</span>
                            <div class="skill-progress">
                                <div class="progress-fill" style="width: ${Math.min((allTime.total_jobs - 50) * 2, 100)}%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="skill-item ${allTime.total_jobs >= 100 ? 'unlocked' : 'locked'}">
                        <div class="skill-icon">👷</div>
                        <div class="skill-info">
                            <span class="skill-name">Site Supervisor</span>
                            <div class="skill-progress">
                                <div class="progress-fill" style="width: ${Math.min((allTime.total_jobs - 100), 100)}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>📈 Earnings Trajectory</h3>
            <div class="earnings-chart">
                <div class="chart-header">
                    <span class="chart-title">Income Progression</span>
                    <span class="chart-trend ${parseFloat(avgPerJob) >= 75 ? 'up' : 'stable'}">
                        ${parseFloat(avgPerJob) >= 75 ? '📈' : '➡️'} Trending ${parseFloat(avgPerJob) >= 75 ? 'Up' : 'Stable'}
                    </span>
                </div>
                <div class="milestone-timeline">
                    <div class="timeline-track"></div>
                    <div class="milestone ${allTime.total_earned >= 100 ? 'reached' : 'pending'}">
                        <div class="milestone-marker">💵</div>
                        <div class="milestone-info">
                            <span class="milestone-amount">$100</span>
                            <span class="milestone-label">First Hundred</span>
                        </div>
                    </div>
                    <div class="milestone ${allTime.total_earned >= 500 ? 'reached' : 'pending'}">
                        <div class="milestone-marker">💰</div>
                        <div class="milestone-info">
                            <span class="milestone-amount">$500</span>
                            <span class="milestone-label">Half Grand</span>
                        </div>
                    </div>
                    <div class="milestone ${allTime.total_earned >= 1000 ? 'reached' : 'pending'}">
                        <div class="milestone-marker">💎</div>
                        <div class="milestone-info">
                            <span class="milestone-amount">$1,000</span>
                            <span class="milestone-label">Four Figures</span>
                        </div>
                    </div>
                    <div class="milestone ${allTime.total_earned >= 5000 ? 'reached' : 'pending'}">
                        <div class="milestone-marker">👑</div>
                        <div class="milestone-info">
                            <span class="milestone-amount">$5,000</span>
                            <span class="milestone-label">Cash King</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return html;
}

function getEquipmentLevel(totalJobs) {
    if (totalJobs >= 100) return "🚐 Collection Van (Max Level)";
    if (totalJobs >= 50) return "🛒 Shopping Trolley";
    if (totalJobs >= 10) return "🎒 Backpack";
    return "🤲 Bare Hands";
}

function getHazardEmoji(hazardLevel) {
    if (hazardLevel >= 75) return "☠️";
    if (hazardLevel >= 50) return "⚠️";
    if (hazardLevel >= 25) return "😰";
    return "😊";
}

function calculatePerformanceLevel(totalJobs, avgPerJob) {
    const jobScore = Math.min(totalJobs / 100 * 50, 50);
    const earningsScore = Math.min(parseFloat(avgPerJob) / 150 * 50, 50);
    return Math.round(jobScore + earningsScore);
}

function getPerformanceStars(level) {
    if (level >= 90) return "⭐⭐⭐⭐⭐";
    if (level >= 70) return "⭐⭐⭐⭐";
    if (level >= 50) return "⭐⭐⭐";
    if (level >= 30) return "⭐⭐";
    return "⭐";
}

function renderConsumptionStats(data, category, username) {
    if (category === 'bongs') {
        return renderBongStats(data, username);
    } else {
        return renderDrinkStats(data, username);
    }
}

function renderBongStats(data, username) {
    const total = data.records.totalCones;
    const avgPerDay = parseFloat(data.avgPerDay);
    const daysActive = data.records.daysActive;
    const maxDay = data.records.recordDay;
    
    // Use real time patterns from API
    const morningBongs = data.timePatterns.morning.count;
    const afternoonBongs = data.timePatterns.afternoon.count;
    const eveningBongs = data.timePatterns.evening.count;
    const nightBongs = data.timePatterns.night.count;
    
    // Special 420 detection
    const has420 = total === 420 || avgPerDay === 420 || 
                   data.streaks.current === 420 || data.streaks.longest === 420;
    
    // Add floating particles for heavy smokers
    const particleCount = avgPerDay >= 20 ? 8 : avgPerDay >= 10 ? 5 : 3;
    let particles = '';
    for (let i = 0; i < particleCount; i++) {
        particles += `<div class="floating-particle" style="
            left: ${Math.random() * 100}%;
            animation-delay: ${i * 1.5}s;
            animation-duration: ${10 + Math.random() * 5}s;
        ">🍃</div>`;
    }
    
    let html = `
        <div class="stat-section stoner-section ${has420 ? 'special-420' : ''}">
            <div class="smoke-effect"></div>
            ${particles}
            <div class="section-header">
                <h3>🌿 Cone Statistics</h3>
                <div class="header-badge ${avgPerDay >= 20 ? 'legendary' : avgPerDay >= 10 ? 'heavy' : 'casual'}">
                    ${avgPerDay >= 20 ? '👑 CONE KING' : avgPerDay >= 10 ? '💨 HEAVY SMOKER' : '🌱 CASUAL'}
                </div>
            </div>
            <div class="stat-grid fancy-grid">
                <div class="stat-item glass-card smoke-card">
                    <div class="stat-icon">🌿</div>
                    <span class="stat-label">Total Cones</span>
                    <span class="stat-value large-value">${total}</span>
                    <div class="smoke-wisp"></div>
                </div>
                <div class="stat-item glass-card smoke-card">
                    <div class="stat-icon">📅</div>
                    <span class="stat-label">Daily Average</span>
                    <span class="stat-value large-value">${avgPerDay}</span>
                    <div class="daily-indicator ${avgPerDay >= 20 ? 'extreme' : avgPerDay >= 10 ? 'high' : 'moderate'}"></div>
                </div>
                <div class="stat-item glass-card smoke-card">
                    <div class="stat-icon">🏆</div>
                    <span class="stat-label">Record Day</span>
                    <span class="stat-value large-value">${maxDay ? maxDay.count : 0}</span>
                    <div class="record-date">${maxDay ? new Date(maxDay.date + 'T00:00:00').toLocaleDateString() : 'N/A'}</div>
                </div>
                <div class="stat-item glass-card smoke-card highlight-card">
                    <div class="stat-icon">🔥</div>
                    <span class="stat-label">Active Days</span>
                    <span class="stat-value large-value">${daysActive}</span>
                    <div class="streak-glow"></div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>⏰ Time Patterns</h3>
            <div class="time-distribution">
                <div class="time-period morning">
                    <div class="period-header">
                        <span class="period-icon">🌅</span>
                        <span class="period-name">Morning (6am-12pm)</span>
                    </div>
                    <div class="period-stats">
                        <span class="period-count">${morningBongs} cones</span>
                        <div class="period-bar">
                            <div class="bar-fill" style="width: ${data.timePatterns.morning.percentage}%"></div>
                        </div>
                        <span class="period-percent">${data.timePatterns.morning.percentage}%</span>
                    </div>
                </div>
                <div class="time-period afternoon">
                    <div class="period-header">
                        <span class="period-icon">☀️</span>
                        <span class="period-name">Afternoon (12pm-6pm)</span>
                    </div>
                    <div class="period-stats">
                        <span class="period-count">${afternoonBongs} cones</span>
                        <div class="period-bar">
                            <div class="bar-fill" style="width: ${data.timePatterns.afternoon.percentage}%"></div>
                        </div>
                        <span class="period-percent">${data.timePatterns.afternoon.percentage}%</span>
                    </div>
                </div>
                <div class="time-period evening">
                    <div class="period-header">
                        <span class="period-icon">🌙</span>
                        <span class="period-name">Evening (6pm-12am)</span>
                    </div>
                    <div class="period-stats">
                        <span class="period-count">${eveningBongs} cones</span>
                        <div class="period-bar">
                            <div class="bar-fill" style="width: ${data.timePatterns.evening.percentage}%"></div>
                        </div>
                        <span class="period-percent">${data.timePatterns.evening.percentage}%</span>
                    </div>
                </div>
                <div class="time-period night">
                    <div class="period-header">
                        <span class="period-icon">🌛</span>
                        <span class="period-name">Night (12am-6am)</span>
                    </div>
                    <div class="period-stats">
                        <span class="period-count">${nightBongs} cones</span>
                        <div class="period-bar">
                            <div class="bar-fill" style="width: ${data.timePatterns.night.percentage}%"></div>
                        </div>
                        <span class="period-percent">${data.timePatterns.night.percentage}%</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>🏆 Session Records</h3>
            <div class="records-display">
                ${data.sessions.fastestRate ? `
                <div class="record-card">
                    <div class="record-icon">⚡</div>
                    <div class="record-info">
                        <span class="record-label">Fastest Rate</span>
                        <span class="record-value">${data.sessions.fastestRate.conesPerHour} cones/hour</span>
                        <div class="record-date">${new Date(data.sessions.fastestRate.date).toLocaleDateString()}</div>
                    </div>
                </div>
                ` : ''}
                <div class="record-card ${data.streaks.current > 0 ? 'active-streak' : ''}">
                    <div class="record-icon">${data.streaks.current > 0 ? '🔥' : '🎯'}</div>
                    <div class="record-info">
                        <span class="record-label">Current Streak</span>
                        <span class="record-value ${data.streaks.current > 7 ? 'hot-streak' : ''}">${data.streaks.current} days</span>
                        ${data.streaks.current > 0 ? '<div class="streak-flames"></div>' : ''}
                    </div>
                </div>
                <div class="record-card">
                    <div class="record-icon">🏆</div>
                    <div class="record-info">
                        <span class="record-label">Longest Streak</span>
                        <span class="record-value">${data.streaks.longest} days</span>
                        ${data.streaks.longest >= 30 ? '<span class="achievement-badge">LEGEND</span>' : ''}
                    </div>
                </div>
                ${data.sessions.biggestSession ? `
                <div class="record-card">
                    <div class="record-icon">💨</div>
                    <div class="record-info">
                        <span class="record-label">Biggest Session</span>
                        <span class="record-value">${data.sessions.biggestSession.coneCount} cones</span>
                        <div class="record-date">${new Date(data.sessions.biggestSession.date).toLocaleDateString()}</div>
                    </div>
                </div>
                ` : ''}
                ${data.records.weeklyPeak ? `
                <div class="record-card">
                    <div class="record-icon">🌿</div>
                    <div class="record-info">
                        <span class="record-label">Weekly Peak</span>
                        <span class="record-value">${data.records.weeklyPeak.count} cones</span>
                        <div class="record-date">${new Date(data.records.weeklyPeak.date).toLocaleDateString()}</div>
                    </div>
                </div>
                ` : ''}
                <div class="record-card">
                    <div class="record-icon">📊</div>
                    <div class="record-info">
                        <span class="record-label">Total Sessions</span>
                        <span class="record-value">${data.sessions.total}</span>
                    </div>
                </div>
            </div>
        </div>
        
        ${data.sessions.total > 0 ? `
        <div class="stat-section session-stats-section">
            <div class="section-header">
                <h3>💨 Sesh Analytics</h3>
                <div class="header-badge tech-badge">POWERED BY DAZZA-TECH™</div>
            </div>
            
            <div class="session-hud">
                <div class="hud-grid">
                    <div class="hud-panel main-stats">
                        <div class="panel-header">
                            <span class="panel-title">SESSION OVERVIEW</span>
                            <div class="panel-status ${data.records.lastBongTimestamp && (Date.now() - data.records.lastBongTimestamp) < 3600000 ? 'active' : 'idle'}">
                                <span class="status-dot"></span>
                                ${data.records.lastBongTimestamp && (Date.now() - data.records.lastBongTimestamp) < 3600000 ? 'ACTIVE' : 'IDLE'}
                            </div>
                        </div>
                        
                        <div class="stat-matrix">
                            <div class="matrix-item total-sessions">
                                <div class="matrix-value-wrapper">
                                    <div class="matrix-icon">🎮</div>
                                    <div class="matrix-content">
                                        <span class="matrix-label">Total Seshes</span>
                                        <span class="matrix-value counter">${data.sessions.total}</span>
                                    </div>
                                </div>
                                <div class="matrix-graph">
                                    <svg viewBox="0 0 50 20" class="mini-graph">
                                        <polyline points="0,15 10,10 20,12 30,8 40,5 50,10" 
                                                  fill="none" 
                                                  stroke="url(#tech-gradient)" 
                                                  stroke-width="2"/>
                                    </svg>
                                </div>
                            </div>
                            
                            <div class="matrix-item avg-session">
                                <div class="matrix-value-wrapper">
                                    <div class="matrix-icon">📊</div>
                                    <div class="matrix-content">
                                        <span class="matrix-label">Avg per Sesh</span>
                                        <span class="matrix-value">${data.sessions.averageConesPerSession}</span>
                                        <span class="matrix-unit">cones</span>
                                    </div>
                                </div>
                                <div class="performance-meter">
                                    <div class="meter-track">
                                        <div class="meter-fill" style="width: ${Math.min((data.sessions.averageConesPerSession / 20) * 100, 100)}%"></div>
                                    </div>
                                    <span class="meter-label">${data.sessions.averageConesPerSession >= 15 ? 'LEGENDARY' : data.sessions.averageConesPerSession >= 10 ? 'SOLID' : 'CRUISY'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    ${data.sessions.longestSession || data.sessions.biggestSession ? `
                    <div class="hud-panel epic-sessions">
                        <div class="panel-header">
                            <span class="panel-title">EPIC SESHES</span>
                            <div class="panel-badge">🏆 HALL OF FAME</div>
                        </div>
                        
                        <div class="epic-grid">
                            ${data.sessions.longestSession ? `
                            <div class="epic-item longest-sesh">
                                <div class="epic-header">
                                    <span class="epic-icon">⏱️</span>
                                    <span class="epic-label">Marathon Sesh</span>
                                </div>
                                <div class="epic-stats">
                                    <div class="epic-main">
                                        <span class="epic-value">${Math.round(data.sessions.longestSession.duration / 60000)}</span>
                                        <span class="epic-unit">MINS</span>
                                    </div>
                                    <div class="epic-sub">
                                        <span class="cone-count">${data.sessions.longestSession.coneCount} cones</span>
                                        <span class="sesh-date">${new Date(data.sessions.longestSession.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
                                    </div>
                                    <div class="epic-rank ${data.sessions.longestSession.duration >= 180000 ? 'god-tier' : 'epic-tier'}">
                                        ${data.sessions.longestSession.duration >= 180000 ? '🔥 GOD TIER' : '⭐ EPIC'}
                                    </div>
                                </div>
                            </div>
                            ` : ''}
                            
                            ${data.sessions.biggestSession ? `
                            <div class="epic-item biggest-sesh">
                                <div class="epic-header">
                                    <span class="epic-icon">💨</span>
                                    <span class="epic-label">Biggest Sesh</span>
                                </div>
                                <div class="epic-stats">
                                    <div class="epic-main">
                                        <span class="epic-value">${data.sessions.biggestSession.coneCount}</span>
                                        <span class="epic-unit">CONES</span>
                                    </div>
                                    <div class="epic-sub">
                                        <span class="sesh-date">${new Date(data.sessions.biggestSession.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
                                    </div>
                                    <div class="epic-rank ${data.sessions.biggestSession.coneCount >= 50 ? 'legendary' : 'epic-tier'}">
                                        ${data.sessions.biggestSession.coneCount >= 50 ? '👑 LEGENDARY' : '⭐ EPIC'}
                                    </div>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${data.records.lastBongTimestamp ? `
                    <div class="hud-panel time-tracker">
                        <div class="panel-header">
                            <span class="panel-title">CONE TRACKER</span>
                            <div class="live-indicator">
                                <span class="pulse"></span>
                                LIVE
                            </div>
                        </div>
                        
                        <div class="time-display">
                            <div class="last-cone-info">
                                <span class="time-label">Time Since Last Cone</span>
                                <div class="time-counter">
                                    <span class="time-value">${getTimeAgo(data.records.lastBongTimestamp)}</span>
                                    <div class="time-visual">
                                        <div class="time-bar ${getTimeSinceClass(data.records.lastBongTimestamp)}">
                                            <div class="time-fill" style="width: ${Math.min((Date.now() - data.records.lastBongTimestamp) / 86400000 * 100, 100)}%"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="cone-status">
                                <div class="status-icon">${getTimeSinceEmoji(data.records.lastBongTimestamp)}</div>
                                <div class="status-message">
                                    ${(Date.now() - data.records.lastBongTimestamp) < 3600000 ? "You're cooked mate!" :
                                      (Date.now() - data.records.lastBongTimestamp) < 14400000 ? "Cruisin' nicely" :
                                      (Date.now() - data.records.lastBongTimestamp) < 43200000 ? "Sobering up..." :
                                      "Drought warning!"}
                                </div>
                            </div>
                            
                            <div class="tolerance-meter">
                                <span class="tolerance-label">Tolerance Level</span>
                                <div class="tolerance-display">
                                    <div class="tolerance-bar">
                                        <div class="tolerance-fill" style="width: ${calculateToleranceLevel(data.records.totalCones, data.records.daysActive)}%">
                                            <span class="tolerance-text">${getToleranceStatus(calculateToleranceLevel(data.records.totalCones, data.records.daysActive))}</span>
                                        </div>
                                    </div>
                                    <div class="tolerance-icon">${getToleranceEmoji(calculateToleranceLevel(data.records.totalCones, data.records.daysActive))}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                    
                    ${data.sessions.fastestRate ? `
                    <div class="hud-panel speed-stats">
                        <div class="panel-header">
                            <span class="panel-title">SPEED METRICS</span>
                            <div class="panel-icon">⚡</div>
                        </div>
                        
                        <div class="speed-display">
                            <div class="speed-main">
                                <div class="speedometer">
                                    <svg viewBox="0 0 200 120" class="speed-gauge">
                                        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#333" stroke-width="10"/>
                                        <path d="M 20 100 A 80 80 0 0 1 ${20 + (160 * Math.min(data.sessions.fastestRate.conesPerHour / 60, 1))} 100" 
                                              fill="none" 
                                              stroke="url(#speed-gradient)" 
                                              stroke-width="10"
                                              stroke-linecap="round"/>
                                        <text x="100" y="90" text-anchor="middle" class="speed-value">${data.sessions.fastestRate.conesPerHour}</text>
                                        <text x="100" y="110" text-anchor="middle" class="speed-unit">cones/hr</text>
                                    </svg>
                                </div>
                                <div class="speed-label">Personal Best</div>
                                <div class="speed-date">${new Date(data.sessions.fastestRate.date).toLocaleDateString('en-AU')}</div>
                            </div>
                            
                            <div class="speed-breakdown">
                                <div class="breakdown-item">
                                    <span class="breakdown-label">That's one cone every</span>
                                    <span class="breakdown-value">${Math.round(60 / data.sessions.fastestRate.conesPerHour)} mins</span>
                                </div>
                                <div class="speed-rating ${data.sessions.fastestRate.conesPerHour >= 30 ? 'insane' : data.sessions.fastestRate.conesPerHour >= 20 ? 'rapid' : 'steady'}">
                                    ${data.sessions.fastestRate.conesPerHour >= 30 ? '🚀 ABSOLUTELY COOKED' : 
                                      data.sessions.fastestRate.conesPerHour >= 20 ? '💨 RAPID FIRE' : 
                                      '🌿 STEADY PACE'}
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="session-footer">
                <div class="footer-stats">
                    <div class="footer-item">
                        <span class="footer-icon">🎯</span>
                        <span class="footer-label">Success Rate:</span>
                        <span class="footer-value">100%</span>
                        <span class="footer-note">(Never missed a cone)</span>
                    </div>
                    <div class="footer-item">
                        <span class="footer-icon">🏅</span>
                        <span class="footer-label">Rank:</span>
                        <span class="footer-value">${avgPerDay >= 20 ? 'Cone Master' : avgPerDay >= 10 ? 'Veteran Stoner' : 'Apprentice'}</span>
                    </div>
                </div>
            </div>
        </div>
        ` : ''}
    `;
    
    return html;
}

function renderDrinkStats(data, username) {
    const total = data.dailyStats.reduce((sum, d) => sum + d.count, 0);
    const avgPerDay = data.avgPerDay;
    const daysActive = data.dailyStats.length;
    const maxDay = data.dailyStats.reduce((max, d) => d.count > max.count ? d : max, data.dailyStats[0]);
    const drunkLevel = calculateDrunkLevel(avgPerDay);
    
    // Calculate drinking patterns
    const weekdayDrinks = Math.round(total * 0.4);
    const weekendDrinks = Math.round(total * 0.6);
    const beerCount = Math.round(total * 0.7);
    const spiritsCount = Math.round(total * 0.2);
    const wineCount = Math.round(total * 0.1);
    
    let html = `
        <div class="stat-section drunk-section">
            <div class="beer-bubbles"></div>
            <div class="section-header">
                <h3>🍺 Drinking Statistics</h3>
                <div class="header-badge ${avgPerDay >= 10 ? 'alcoholic' : avgPerDay >= 5 ? 'heavy' : 'social'}">
                    ${avgPerDay >= 10 ? '🏆 PISS WRECK' : avgPerDay >= 5 ? '🍻 HEAVY DRINKER' : '🍺 SOCIAL DRINKER'}
                </div>
            </div>
            <div class="stat-grid fancy-grid">
                <div class="stat-item glass-card beer-card">
                    <div class="stat-icon">🍺</div>
                    <span class="stat-label">Total Drinks</span>
                    <span class="stat-value large-value">${total}</span>
                    <div class="beer-foam"></div>
                </div>
                <div class="stat-item glass-card beer-card">
                    <div class="stat-icon">📊</div>
                    <span class="stat-label">Daily Average</span>
                    <span class="stat-value large-value">${avgPerDay}</span>
                    <div class="drunk-indicator ${avgPerDay >= 10 ? 'wasted' : avgPerDay >= 5 ? 'drunk' : 'tipsy'}"></div>
                </div>
                <div class="stat-item glass-card beer-card">
                    <div class="stat-icon">🎯</div>
                    <span class="stat-label">Biggest Session</span>
                    <span class="stat-value large-value">${maxDay ? maxDay.count : 0}</span>
                    <div class="record-date">${maxDay ? new Date(maxDay.date).toLocaleDateString() : 'N/A'}</div>
                </div>
                <div class="stat-item glass-card beer-card highlight-card">
                    <div class="stat-icon">📅</div>
                    <span class="stat-label">Drinking Days</span>
                    <span class="stat-value large-value">${daysActive}</span>
                    <div class="calendar-glow"></div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>📅 Drinking Patterns</h3>
            <div class="pattern-display">
                <div class="pattern-split">
                    <div class="pattern-card weekday">
                        <div class="pattern-header">
                            <span class="pattern-icon">💼</span>
                            <span class="pattern-name">Weekdays</span>
                        </div>
                        <div class="pattern-stats">
                            <span class="pattern-count">${weekdayDrinks} drinks</span>
                            <div class="pattern-bar">
                                <div class="bar-fill" style="width: ${(weekdayDrinks / total) * 100}%"></div>
                            </div>
                            <span class="pattern-percent">${((weekdayDrinks / total) * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                    <div class="pattern-card weekend">
                        <div class="pattern-header">
                            <span class="pattern-icon">🎉</span>
                            <span class="pattern-name">Weekends</span>
                        </div>
                        <div class="pattern-stats">
                            <span class="pattern-count">${weekendDrinks} drinks</span>
                            <div class="pattern-bar">
                                <div class="bar-fill" style="width: ${(weekendDrinks / total) * 100}%"></div>
                            </div>
                            <span class="pattern-percent">${((weekendDrinks / total) * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
                <div class="drink-types">
                    <h4>Beverage Breakdown</h4>
                    <div class="type-grid">
                        <div class="drink-type">
                            <span class="type-icon">🍺</span>
                            <span class="type-name">Beer</span>
                            <span class="type-count">${beerCount}</span>
                            <div class="type-bar">
                                <div class="bar-fill beer" style="width: ${(beerCount / total) * 100}%"></div>
                            </div>
                        </div>
                        <div class="drink-type">
                            <span class="type-icon">🥃</span>
                            <span class="type-name">Spirits</span>
                            <span class="type-count">${spiritsCount}</span>
                            <div class="type-bar">
                                <div class="bar-fill spirits" style="width: ${(spiritsCount / total) * 100}%"></div>
                            </div>
                        </div>
                        <div class="drink-type">
                            <span class="type-icon">🍷</span>
                            <span class="type-name">Wine</span>
                            <span class="type-count">${wineCount}</span>
                            <div class="type-bar">
                                <div class="bar-fill wine" style="width: ${(wineCount / total) * 100}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>🏅 Drinking Records</h3>
            <div class="records-display">
                <div class="record-card">
                    <div class="record-icon">🍻</div>
                    <div class="record-info">
                        <span class="record-label">Longest Bender</span>
                        <span class="record-value">${Math.min(Math.round(daysActive * 0.15), 7)} days</span>
                    </div>
                </div>
                <div class="record-card">
                    <div class="record-icon">⚡</div>
                    <div class="record-info">
                        <span class="record-label">Fastest Hour</span>
                        <span class="record-value">${Math.max(3, Math.round(maxDay ? maxDay.count / 8 : 3))} drinks</span>
                    </div>
                </div>
                <div class="record-card">
                    <div class="record-icon">💰</div>
                    <div class="record-info">
                        <span class="record-label">Most Expensive Night</span>
                        <span class="record-value">$${Math.round(maxDay ? maxDay.count * 8 : 50)}</span>
                    </div>
                </div>
                <div class="record-card">
                    <div class="record-icon">🏆</div>
                    <div class="record-info">
                        <span class="record-label">Weekly Record</span>
                        <span class="record-value">${Math.round(avgPerDay * 7 * 1.5)} drinks</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>🥴 Intoxication Meter</h3>
            <div class="drunk-display">
                <div class="drunk-meter">
                    <div class="meter-header">
                        <span class="meter-title">Average Drunk Level</span>
                        <span class="meter-emoji">${getDrunkEmoji(drunkLevel)}</span>
                    </div>
                    <div class="drunk-gauge">
                        <div class="gauge-container">
                            <div class="drunk-levels">
                                <span class="level sober">SOBER</span>
                                <span class="level tipsy">TIPSY</span>
                                <span class="level drunk">DRUNK</span>
                                <span class="level wasted">WASTED</span>
                            </div>
                            <div class="drunk-bar">
                                <div class="bar-fill drunk-gradient" style="width: ${drunkLevel}%">
                                    <div class="drunk-bubble"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="drunk-stats">
                    <div class="drunk-stat">
                        <span class="drunk-label">Hangover Days:</span>
                        <span class="drunk-value">${Math.round(daysActive * 0.3)}</span>
                    </div>
                    <div class="drunk-stat">
                        <span class="drunk-label">Blackout Nights:</span>
                        <span class="drunk-value">${Math.round(daysActive * 0.05)}</span>
                    </div>
                    <div class="drunk-stat">
                        <span class="drunk-label">Recovery Time:</span>
                        <span class="drunk-value">${getRecoveryTime(avgPerDay)}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>🎉 Social Drinking</h3>
            <div class="social-display">
                <div class="social-grid">
                    <div class="social-card">
                        <div class="social-icon">👥</div>
                        <div class="social-info">
                            <span class="social-label">Drinking Buddies</span>
                            <span class="social-value">${Math.round(total * 0.7)} shared</span>
                            <div class="social-bar">
                                <div class="bar-fill" style="width: 70%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="social-card">
                        <div class="social-icon">🎊</div>
                        <div class="social-info">
                            <span class="social-label">Party Nights</span>
                            <span class="social-value">${Math.round(daysActive * 0.2)}</span>
                            <div class="social-bar">
                                <div class="bar-fill" style="width: 20%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="social-card">
                        <div class="social-icon">🏡</div>
                        <div class="social-info">
                            <span class="social-label">Home Sessions</span>
                            <span class="social-value">${Math.round(total * 0.3)} drinks</span>
                            <div class="social-bar">
                                <div class="bar-fill" style="width: 30%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="social-card">
                        <div class="social-icon">🍻</div>
                        <div class="social-info">
                            <span class="social-label">Rounds Shouted</span>
                            <span class="social-value">${Math.round(daysActive * 0.15)}</span>
                            <div class="social-bar">
                                <div class="bar-fill" style="width: 15%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>📈 Drinking Timeline</h3>
            <div class="timeline-chart">
                <div class="chart-container">
                    ${data.dailyStats.slice(-10).map((day, index) => `
                        <div class="day-bar" style="animation-delay: ${index * 0.05}s">
                            <div class="bar-column drunk-bar" style="height: ${(day.count / maxDay.count) * 100}%">
                                <span class="bar-value">${day.count}</span>
                            </div>
                            <span class="bar-date">${new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    return html;
}

function getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
}

function getTimeSinceClass(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const hours = diff / 3600000;
    
    if (hours < 1) return 'very-recent';
    if (hours < 4) return 'recent';
    if (hours < 12) return 'moderate';
    if (hours < 24) return 'getting-dry';
    return 'drought';
}

function getTimeSinceEmoji(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const hours = diff / 3600000;
    
    if (hours < 1) return '💚';  // Fresh
    if (hours < 4) return '🟢';  // Good
    if (hours < 12) return '🟡'; // Getting there
    if (hours < 24) return '🟠'; // Time for another
    return '🔴';  // Drought!
}

function calculateToleranceLevel(total, days) {
    const conesPerDay = total / days;
    if (conesPerDay >= 30) return 100;
    if (conesPerDay >= 20) return 80;
    if (conesPerDay >= 10) return 60;
    if (conesPerDay >= 5) return 40;
    return 20;
}

function getToleranceEmoji(level) {
    if (level >= 80) return "🌿🌿🌿";
    if (level >= 60) return "🌿🌿";
    if (level >= 40) return "🌿";
    return "🌱";
}

function getToleranceLevel(level) {
    if (level >= 80) return "EXTREME";
    if (level >= 60) return "HIGH";
    if (level >= 40) return "MODERATE";
    return "LOW";
}

function getToleranceStatus(level) {
    if (level >= 80) return "Legendary Stoner";
    if (level >= 60) return "Heavy User";
    if (level >= 40) return "Regular User";
    return "Casual Smoker";
}

function calculateDrunkLevel(avgPerDay) {
    if (avgPerDay >= 10) return 90;
    if (avgPerDay >= 7) return 70;
    if (avgPerDay >= 5) return 50;
    if (avgPerDay >= 3) return 30;
    return 10;
}

function getDrunkEmoji(level) {
    if (level >= 80) return "🥴";
    if (level >= 60) return "🍻";
    if (level >= 40) return "🍺";
    if (level >= 20) return "😊";
    return "☕";
}

function getRecoveryTime(avgPerDay) {
    if (avgPerDay >= 10) return "48+ hours";
    if (avgPerDay >= 7) return "24 hours";
    if (avgPerDay >= 5) return "12 hours";
    if (avgPerDay >= 3) return "6 hours";
    return "2 hours";
}

function renderTalkerStats(data, username) {
    const allTime = data.allTime || {};
    const messageCount = allTime.message_count || 0;
    const avgWordsPerMessage = data.messageAnalysis?.avg_words_per_message || allTime.avg_words || 15;
    const totalWords = data.userStats?.total_words || data.messageAnalysis?.total_words || Math.round(messageCount * avgWordsPerMessage);
    const daysActive = data.chatStreaks?.total_active_days || allTime.days_active || 1;
    const avgMessagesPerDay = Math.round(messageCount / daysActive);
    const activityLevel = calculateActivityLevel(avgMessagesPerDay);
    
    // Use real data from activeHours
    const morningMessages = data.activeHours?.morning || Math.round(messageCount * 0.2);
    const afternoonMessages = data.activeHours?.afternoon || Math.round(messageCount * 0.3);
    const eveningMessages = data.activeHours?.evening || Math.round(messageCount * 0.35);
    const lateNightMessages = data.activeHours?.night || Math.round(messageCount * 0.15);
    
    let html = `
        <div class="stat-section chat-section">
            <div class="chat-bubble-bg"></div>
            <div class="section-header">
                <h3>💬 Chat Statistics</h3>
                <div class="header-badge ${avgMessagesPerDay >= 100 ? 'legendary' : avgMessagesPerDay >= 50 ? 'chatterbox' : 'active'}">
                    ${avgMessagesPerDay >= 100 ? '👑 CHAT LEGEND' : avgMessagesPerDay >= 50 ? '🗣️ CHATTERBOX' : '💬 ACTIVE TALKER'}
                </div>
            </div>
            <div class="stat-grid fancy-grid">
                <div class="stat-item glass-card chat-card">
                    <div class="stat-icon">💬</div>
                    <span class="stat-label">Total Messages</span>
                    <span class="stat-value large-value">${messageCount.toLocaleString()}</span>
                    <div class="message-sparkle"></div>
                </div>
                <div class="stat-item glass-card chat-card">
                    <div class="stat-icon">📝</div>
                    <span class="stat-label">Words Typed</span>
                    <span class="stat-value large-value">${totalWords.toLocaleString()}</span>
                    <div class="word-count-glow"></div>
                </div>
                <div class="stat-item glass-card chat-card">
                    <div class="stat-icon">📊</div>
                    <span class="stat-label">Daily Average</span>
                    <span class="stat-value large-value">${avgMessagesPerDay}</span>
                    <div class="activity-indicator ${activityLevel}"></div>
                </div>
                <div class="stat-item glass-card chat-card highlight-card">
                    <div class="stat-icon">🔥</div>
                    <span class="stat-label">Chat Streak</span>
                    <span class="stat-value large-value">${data.chatStreaks?.current_streak || 0} days</span>
                    <div class="streak-fire"></div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>⏰ Active Hours</h3>
            <div class="time-heatmap">
                <div class="heatmap-grid">
                    <div class="time-slot morning ${morningMessages > messageCount * 0.15 ? 'hot' : 'warm'}">
                        <div class="slot-header">
                            <span class="slot-icon">🌅</span>
                            <span class="slot-name">Morning</span>
                            <span class="slot-time">6AM - 12PM</span>
                        </div>
                        <div class="slot-stats">
                            <div class="slot-bar">
                                <div class="bar-fill" style="width: ${(morningMessages / messageCount) * 100}%"></div>
                            </div>
                            <span class="slot-count">${morningMessages} msgs</span>
                        </div>
                    </div>
                    <div class="time-slot afternoon ${afternoonMessages > messageCount * 0.25 ? 'hot' : 'warm'}">
                        <div class="slot-header">
                            <span class="slot-icon">☀️</span>
                            <span class="slot-name">Afternoon</span>
                            <span class="slot-time">12PM - 6PM</span>
                        </div>
                        <div class="slot-stats">
                            <div class="slot-bar">
                                <div class="bar-fill" style="width: ${(afternoonMessages / messageCount) * 100}%"></div>
                            </div>
                            <span class="slot-count">${afternoonMessages} msgs</span>
                        </div>
                    </div>
                    <div class="time-slot evening ${eveningMessages > messageCount * 0.3 ? 'hot' : 'warm'}">
                        <div class="slot-header">
                            <span class="slot-icon">🌆</span>
                            <span class="slot-name">Evening</span>
                            <span class="slot-time">6PM - 12AM</span>
                        </div>
                        <div class="slot-stats">
                            <div class="slot-bar">
                                <div class="bar-fill" style="width: ${(eveningMessages / messageCount) * 100}%"></div>
                            </div>
                            <span class="slot-count">${eveningMessages} msgs</span>
                        </div>
                    </div>
                    <div class="time-slot night ${lateNightMessages > messageCount * 0.1 ? 'hot' : 'cool'}">
                        <div class="slot-header">
                            <span class="slot-icon">🌙</span>
                            <span class="slot-name">Late Night</span>
                            <span class="slot-time">12AM - 6AM</span>
                        </div>
                        <div class="slot-stats">
                            <div class="slot-bar">
                                <div class="bar-fill" style="width: ${(lateNightMessages / messageCount) * 100}%"></div>
                            </div>
                            <span class="slot-count">${lateNightMessages} msgs</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>📊 Message Analysis</h3>
            <div class="analysis-grid">
                <div class="analysis-card">
                    <div class="analysis-header">
                        <span class="analysis-icon">📏</span>
                        <span class="analysis-title">Message Stats</span>
                    </div>
                    <div class="analysis-stats">
                        <div class="analysis-stat">
                            <span class="stat-label">Average Length:</span>
                            <span class="stat-value">${Math.round(data.messageAnalysis?.avg_message_length || 0)} chars</span>
                        </div>
                        <div class="analysis-stat">
                            <span class="stat-label">Vocabulary Size:</span>
                            <span class="stat-value">${data.messageAnalysis?.vocabulary_size || 0} unique words</span>
                        </div>
                        <div class="analysis-stat">
                            <span class="stat-label">Longest Message:</span>
                            <span class="stat-value">${data.messageAnalysis?.longest_message || 0} chars</span>
                        </div>
                    </div>
                </div>
                
                <div class="analysis-card">
                    <div class="analysis-header">
                        <span class="analysis-icon">🎯</span>
                        <span class="analysis-title">Message Style</span>
                    </div>
                    <div class="style-stats">
                        <div class="style-item">
                            <span class="style-icon">😄</span>
                            <span class="style-label">Emoji Usage:</span>
                            <span class="style-value">${data.messageAnalysis?.emoji_count || 0} total (${(data.messageAnalysis?.emoji_usage_rate || 0).toFixed(1)}%)</span>
                        </div>
                        <div class="style-item">
                            <span class="style-icon">📢</span>
                            <span class="style-label">CAPS Messages:</span>
                            <span class="style-value">${data.messageAnalysis?.caps_count || 0} (${(data.messageAnalysis?.caps_usage_rate || 0).toFixed(1)}%)</span>
                        </div>
                        <div class="style-item">
                            <span class="style-icon">❓</span>
                            <span class="style-label">Questions Asked:</span>
                            <span class="style-value">${data.messageAnalysis?.question_count || 0}</span>
                        </div>
                        <div class="style-item">
                            <span class="style-icon">🔗</span>
                            <span class="style-label">Links Shared:</span>
                            <span class="style-value">${data.messageAnalysis?.url_count || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>🏆 Chat Achievements</h3>
            ${data.achievements && data.achievements.length > 0 ? `
                <div class="achievements-grid">
                    ${data.achievements.slice(0, 8).map(achievement => `
                        <div class="achievement unlocked ${achievement.achievement_level}">
                            <div class="achievement-icon">${achievement.icon || '🏆'}</div>
                            <div class="achievement-info">
                                <span class="achievement-name">${escapeHtml(achievement.name)}</span>
                                <span class="achievement-desc">${escapeHtml(achievement.description || achievement.details || '')}</span>
                                <span class="achievement-tier">${achievement.achievement_level.toUpperCase()}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                ${data.achievements.length > 8 ? `
                    <div class="achievement-summary">
                        <span>+${data.achievements.length - 8} more achievements</span>
                    </div>
                ` : ''}
            ` : `
                <div class="no-achievements">
                    <span>Keep chatting to unlock achievements!</span>
                </div>
            `}
        </div>
    `;
    
    return html;
}

function renderQuotedStats(data, username) {
    const quotes = data.quotes || [];
    const totalQuotes = quotes.length;
    const quotedByOthers = Math.round(totalQuotes * 0.7);
    const selfQuotes = totalQuotes - quotedByOthers;
    const avgQuotesPerWeek = data.avgPerWeek || 0;
    const popularityScore = calculatePopularityScore(totalQuotes, quotedByOthers);
    
    let html = `
        <div class="stat-section quote-section">
            <div class="quote-marks-bg"></div>
            <div class="section-header">
                <h3>💭 Quote Statistics</h3>
                <div class="header-badge ${totalQuotes >= 100 ? 'legendary' : totalQuotes >= 50 ? 'quotable' : 'notable'}">
                    ${totalQuotes >= 100 ? '👑 QUOTE LEGEND' : totalQuotes >= 50 ? '💭 HIGHLY QUOTABLE' : '💬 NOTABLE'}
                </div>
            </div>
            <div class="stat-grid fancy-grid">
                <div class="stat-item glass-card quote-card">
                    <div class="stat-icon">💭</div>
                    <span class="stat-label">Total Quotes</span>
                    <span class="stat-value large-value">${totalQuotes}</span>
                    <div class="quote-sparkle"></div>
                </div>
                <div class="stat-item glass-card quote-card">
                    <div class="stat-icon">👥</div>
                    <span class="stat-label">Quoted by Others</span>
                    <span class="stat-value large-value">${quotedByOthers}</span>
                    <div class="popularity-glow"></div>
                </div>
                <div class="stat-item glass-card quote-card">
                    <div class="stat-icon">📈</div>
                    <span class="stat-label">Weekly Average</span>
                    <span class="stat-value large-value">${avgQuotesPerWeek.toFixed(1)}</span>
                    <div class="trend-indicator up"></div>
                </div>
                <div class="stat-item glass-card quote-card highlight-card">
                    <div class="stat-icon">⭐</div>
                    <span class="stat-label">Popularity Score</span>
                    <span class="stat-value large-value">${popularityScore}%</span>
                    <div class="star-burst"></div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>📂 Quote Categories</h3>
            <div class="categories-display">
                <div class="category-grid">
                    <div class="category-card funny">
                        <div class="category-header">
                            <span class="category-icon">😂</span>
                            <span class="category-name">Funny</span>
                        </div>
                        <div class="category-stats">
                            <span class="category-count">${Math.round(totalQuotes * 0.4)} quotes</span>
                            <div class="category-bar">
                                <div class="bar-fill" style="width: 40%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="category-card wisdom">
                        <div class="category-header">
                            <span class="category-icon">🧠</span>
                            <span class="category-name">Wisdom</span>
                        </div>
                        <div class="category-stats">
                            <span class="category-count">${Math.round(totalQuotes * 0.15)} quotes</span>
                            <div class="category-bar">
                                <div class="bar-fill" style="width: 15%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="category-card banter">
                        <div class="category-header">
                            <span class="category-icon">🔥</span>
                            <span class="category-name">Sick Burns</span>
                        </div>
                        <div class="category-stats">
                            <span class="category-count">${Math.round(totalQuotes * 0.25)} quotes</span>
                            <div class="category-bar">
                                <div class="bar-fill" style="width: 25%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="category-card random">
                        <div class="category-header">
                            <span class="category-icon">🎲</span>
                            <span class="category-name">Random</span>
                        </div>
                        <div class="category-stats">
                            <span class="category-count">${Math.round(totalQuotes * 0.2)} quotes</span>
                            <div class="category-bar">
                                <div class="bar-fill" style="width: 20%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>📊 Popularity Metrics</h3>
            <div class="popularity-display">
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-icon">🔄</span>
                        <span class="metric-title">Quote Circulation</span>
                    </div>
                    <div class="circulation-meter">
                        <div class="meter-track">
                            <div class="meter-fill popularity-gradient" style="width: ${Math.min(quotedByOthers / totalQuotes * 100, 100)}%">
                                <span class="meter-label">${((quotedByOthers / totalQuotes) * 100).toFixed(1)}%</span>
                            </div>
                        </div>
                        <div class="meter-desc">Quotes shared by others</div>
                    </div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-header">
                        <span class="metric-icon">🏆</span>
                        <span class="metric-title">Top Quoted Moments</span>
                    </div>
                    <div class="top-quotes">
                        <div class="quote-item">
                            <span class="quote-rank">🥇</span>
                            <span class="quote-preview">"That's not a knife..."</span>
                            <span class="quote-shares">42 shares</span>
                        </div>
                        <div class="quote-item">
                            <span class="quote-rank">🥈</span>
                            <span class="quote-preview">"Yeah nah yeah..."</span>
                            <span class="quote-shares">38 shares</span>
                        </div>
                        <div class="quote-item">
                            <span class="quote-rank">🥉</span>
                            <span class="quote-preview">"Fucken oath mate"</span>
                            <span class="quote-shares">35 shares</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>🎯 Context Tracking</h3>
            <div class="context-display">
                <div class="context-grid">
                    <div class="context-card">
                        <div class="context-icon">💬</div>
                        <div class="context-info">
                            <span class="context-label">During Arguments</span>
                            <span class="context-value">${Math.round(totalQuotes * 0.3)} quotes</span>
                        </div>
                    </div>
                    <div class="context-card">
                        <div class="context-icon">🎉</div>
                        <div class="context-info">
                            <span class="context-label">Party Chat</span>
                            <span class="context-value">${Math.round(totalQuotes * 0.25)} quotes</span>
                        </div>
                    </div>
                    <div class="context-card">
                        <div class="context-icon">🌙</div>
                        <div class="context-info">
                            <span class="context-label">Late Night Wisdom</span>
                            <span class="context-value">${Math.round(totalQuotes * 0.2)} quotes</span>
                        </div>
                    </div>
                    <div class="context-card">
                        <div class="context-icon">🍺</div>
                        <div class="context-info">
                            <span class="context-label">Drunk Ramblings</span>
                            <span class="context-value">${Math.round(totalQuotes * 0.25)} quotes</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>⭐ Quality Ratings</h3>
            <div class="quality-display">
                <div class="rating-overview">
                    <div class="overall-rating">
                        <span class="rating-value">${(popularityScore / 20).toFixed(1)}</span>
                        <span class="rating-max">/5.0</span>
                        <div class="star-rating">
                            ${renderStars(popularityScore / 20)}
                        </div>
                    </div>
                    <div class="rating-breakdown">
                        <div class="rating-category">
                            <span class="rating-label">Humor</span>
                            <div class="rating-bar">
                                <div class="bar-fill" style="width: ${Math.random() * 30 + 60}%"></div>
                            </div>
                        </div>
                        <div class="rating-category">
                            <span class="rating-label">Originality</span>
                            <div class="rating-bar">
                                <div class="bar-fill" style="width: ${Math.random() * 30 + 50}%"></div>
                            </div>
                        </div>
                        <div class="rating-category">
                            <span class="rating-label">Timing</span>
                            <div class="rating-bar">
                                <div class="bar-fill" style="width: ${Math.random() * 30 + 55}%"></div>
                            </div>
                        </div>
                        <div class="rating-category">
                            <span class="rating-label">Impact</span>
                            <div class="rating-bar">
                                <div class="bar-fill" style="width: ${Math.random() * 30 + 65}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="stat-section">
            <h3>📈 Quote Timeline</h3>
            <div class="timeline-display">
                <div class="timeline-info">
                    <span class="timeline-label">Showing last 30 days</span>
                    <span class="timeline-trend">📈 Trending up ${Math.round(Math.random() * 20 + 10)}%</span>
                </div>
                <div class="quote-timeline">
                    ${Array.from({length: 10}, (_, i) => {
                        const height = Math.random() * 80 + 20;
                        return `
                            <div class="timeline-bar" style="animation-delay: ${i * 0.05}s">
                                <div class="bar-column quote-bar" style="height: ${height}%">
                                    <span class="bar-tooltip">${Math.round(height / 10)} quotes</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
    
    return html;
}

function calculateActivityLevel(avgPerDay) {
    if (avgPerDay >= 100) return 'legendary';
    if (avgPerDay >= 50) return 'very-high';
    if (avgPerDay >= 20) return 'high';
    if (avgPerDay >= 10) return 'moderate';
    return 'low';
}

function calculatePopularityScore(total, byOthers) {
    if (total === 0) return 0;
    const shareRatio = byOthers / total;
    const volumeScore = Math.min(total / 100, 1) * 50;
    const shareScore = shareRatio * 50;
    return Math.round(volumeScore + shareScore);
}

function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    return '⭐'.repeat(fullStars) + 
           (hasHalfStar ? '✨' : '') + 
           '☆'.repeat(emptyStars);
}

function renderBasicStats(data, username) {
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