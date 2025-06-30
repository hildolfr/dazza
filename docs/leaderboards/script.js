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

function renderConsumptionStats(data, category, username) {
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