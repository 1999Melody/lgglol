let socket = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 3000; // 3秒

// 初始化WebSocket连接
function initWebSocket(playerId) {
    if (socket) {
        socket.close();
    }

    // const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    // const host = window.location.host;
    // const wsUrl = `${protocol}${host}/ws`;

    // 使用配置的WebSocket地址
    const wsUrl = `${AppConfig.WS_BASE_URL}/ws`;

    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log('WebSocket连接已建立');
        reconnectAttempts = 0;

        // 发送认证消息
        const token = localStorage.getItem('token');
        if (token) {
            socket.send(JSON.stringify({
                type: 'auth',
                token: token
            }));
        }
    };

    socket.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            handleWebSocketMessage(message);
        } catch (error) {
            console.error('解析WebSocket消息失败:', error);
        }
    };

    socket.onclose = (event) => {
        console.log('WebSocket连接关闭:', event.code, event.reason);

        if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
            // 非正常关闭，尝试重新连接
            reconnectAttempts++;
            console.log(`尝试重新连接 (${reconnectAttempts}/${maxReconnectAttempts})...`);
            setTimeout(() => initWebSocket(playerId), reconnectDelay);
        }
    };

    socket.onerror = (error) => {
        console.error('WebSocket错误:', error);
    };
}

// 处理WebSocket消息
function handleWebSocketMessage(message) {
    switch (message.type) {
        case 'players_update':
            updatePlayersList(message.data);
            break;
        case 'games_update':
            updateGamesList(message.data);
            break;
        case 'player_change':
            updatePlayerCard(message.data);
            break;
        case 'game_change':
            updateGameCard(message.data);
            break;
        case 'game_del':
            removeGameCard(message.data);
            break;
        case 'notification':
            showNotification(message.data.message, message.data.type);
            break;
        case 'redirect':
            window.location.href = message.data.url;
            break;
        case 'heartbeat':
            // 响应心跳
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'heartbeat_ack' }));
            }
            break;
        default:
            console.log('未知的WebSocket消息类型:', message.type);
    }
}

// 发送WebSocket消息
function sendWebSocketMessage(type, data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type, data }));
    } else {
        console.warn('WebSocket未连接，无法发送消息');
    }
}

// 更新玩家列表
function updatePlayersList(players) {
    if (window.location.pathname.endsWith('lobby.html')) {
        // 大厅页面的玩家列表更新
        const playersGrid = document.getElementById('playersGrid');
        if (playersGrid) {
            playersGrid.innerHTML = players.map(player => createPlayerCard(player)).join('');
        }
    }

    // 更新排行榜
    if (window.location.pathname.endsWith('leaderboard.html')) {
        updateLeaderboard(players);
    }
}

// 更新游戏列表
function updateGamesList(games) {
    if (window.location.pathname.endsWith('lobby.html')) {
        // 大厅页面的游戏列表更新
        const gamesList = document.getElementById('gamesList');
        if (gamesList) {
            gamesList.innerHTML = games.map(game => createGameCard(game)).join('');
        }
    }
}

// 创建玩家卡片HTML
function createPlayerCard(player) {
    const winRate = calculateWinRate(player.wins, player.losses);

    return `
        <div class="player-card" data-player-id="${player.id}">
            <div class="player-role role-${player.role}">${player.role === 'root' ? '超级管理员' : player.role === 'admin' ? '管理员' : '玩家'}</div>
            <div class="player-avatar" style="background-image: url('assets/images/avatars/${player.id % 10}.png')"></div>
            <div class="player-name">${player.username}</div>
            <div class="player-stats">
                <div class="player-stat">
                    <span class="value">${player.wins}</span>
                    <span class="label">胜场</span>
                </div>
                <div class="player-stat">
                    <span class="value">${player.losses}</span>
                    <span class="label">败场</span>
                </div>
                <div class="player-stat">
                    <span class="value">${winRate}%</span>
                    <span class="label">胜率</span>
                </div>
            </div>
        </div>
    `;
}

// 创建游戏卡片HTML
function createGameCard(game) {
    const statusClass = `status-${game.status}`;
    let statusText = '';

    switch (game.status) {
        case 'waiting': statusText = '等待中'; break;
        case 'rolling': statusText = '分队中'; break;
        case 'inGame': statusText = '游戏中'; break;
        case 'finished': statusText = '已结束'; break;
    }

    return `
        <div class="game-card" data-game-id="${game.id}">
            <div class="game-header">
                <div class="game-name">${game.name}</div>
                <div class="game-status ${statusClass}">${statusText}</div>
            </div>
            <div class="game-creator">
                <i class="fas fa-crown"></i>
                <span>房主: ${game.creatorName || '未知'}</span>
            </div>
            <div class="game-players">
                ${game.players.map(player => `
                    <div class="game-player">
                        <i class="fas fa-user"></i>
                        <span>${player.name}</span>
                    </div>
                `).join('')}
            </div>
            <div class="game-actions">
                ${game.status === 'waiting' ? `
                    <button class="btn btn-primary join-game-btn" data-game-id="${game.id}">
                        <i class="fas fa-sign-in-alt"></i> 加入
                    </button>
                ` : ''}
                ${game.status === 'rolling' || game.status === 'inGame' ? `
                    <button class="btn btn-secondary view-game-btn" data-game-id="${game.id}">
                        <i class="fas fa-eye"></i> 观战
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

// 更新单个玩家卡片
function updatePlayerCard(player) {
    const playerCard = document.querySelector(`.player-card[data-player-id="${player.id}"]`);
    if (playerCard) {
        playerCard.outerHTML = createPlayerCard(player);
    }

    // 更新排行榜中的玩家信息
    updateLeaderboardPlayer(player);
}

// 更新单个游戏卡片
function updateGameCard(game) {
    const gameCard = document.querySelector(`.game-card[data-game-id="${game.id}"]`);
    if (gameCard) {
        gameCard.outerHTML = createGameCard(game);
    }

    // 如果当前在游戏房间页面且是当前游戏，则刷新房间
    if (window.location.pathname.endsWith('room.html') && getUrlParam('game_id') === String(game.id)) {
        loadRoomData(game.id);
    }
}

// 移除游戏卡片
function removeGameCard(gameId) {
    const gameCard = document.querySelector(`.game-card[data-game-id="${gameId}"]`);
    if (gameCard) {
        gameCard.remove();
    }

    // 如果当前在游戏房间页面且是当前游戏，则重定向到大厅
    if (window.location.pathname.endsWith('room.html') && getUrlParam('game_id') === String(gameId)) {
        showNotification('房间已解散', 'error');
        setTimeout(() => {
            window.location.href = 'lobby.html';
        }, 2000);
    }
}

// 初始化大厅页面的事件监听
function initLobbyEventListeners() {
    // 加入游戏按钮
    document.addEventListener('click', (e) => {
        if (e.target.closest('.join-game-btn')) {
            const gameId = e.target.closest('.join-game-btn').dataset.gameId;
            joinGame(gameId);
        }
    });
}

// 加入游戏
async function joinGame(gameId) {
    try {
        const response = await fetch(`${AppConfig.API_BASE_URL}/api/game/${gameId}/join`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '加入游戏失败');
        }

        showNotification('成功加入游戏', 'success');
        setTimeout(() => {
            window.location.href = `room.html?game_id=${gameId}`;
        }, 1000);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// 初始化WebSocket事件监听
document.addEventListener('DOMContentLoaded', () => {
    if (checkAuth()) {
        const playerId = localStorage.getItem('playerId');
        if (playerId) {
            initWebSocket(playerId);
        }
    }

    if (window.location.pathname.endsWith('lobby.html')) {
        initLobbyEventListeners();
    }
});

// 检查用户是否登录
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'auth.html';
        return false;
    }
    return true;
}