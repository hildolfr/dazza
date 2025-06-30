// ===== DAZZA'S HALL OF SHAME - LEADERBOARD SCRIPT =====

// Configuration
const API_BASE = 'https://localhost:3001/api/v1';
const WS_URL = 'wss://localhost:3001';
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
            headers: { 'Accept': 'application/json' },
            // Skip certificate validation for localhost
            ...(API_BASE.includes('localhost') && { rejectUnauthorized: false })
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
            headers: { 'Accept': 'application/json' }
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
            transports: ['websocket'],
            secure: true,
            rejectUnauthorized: false
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
            headers: { 'Accept': 'application/json' }
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
                ${board.data.length > 0 ? board.data.map(item => renderLeaderboardItem(item)).join('') : '<p style="text-align: center; padding: 20px; color: #999;">No data yet</p>'}
            </div>
        </div>
    `).join('');
    
    // Add click handlers for user details
    document.querySelectorAll('.leaderboard-item').forEach(item => {
        item.addEventListener('click', () => {
            const username = item.dataset.username;
            showUserDetails(username);
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

function renderLeaderboardItem(item) {
    const showAchievements = elements.showAchievements.checked;
    const rankClass = item.rank === 1 ? 'gold' : item.rank === 2 ? 'silver' : item.rank === 3 ? 'bronze' : '';
    
    return `
        <div class="leaderboard-item" data-username="${item.username}">
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
async function showUserDetails(username) {
    elements.modalContent.innerHTML = '<div class="loading-spinner"></div>';
    elements.modal.style.display = 'block';
    
    const userRanks = await loadUserRanks(username);
    
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