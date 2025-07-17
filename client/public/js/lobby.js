document.addEventListener('DOMContentLoaded', async () => {
    // 登录按钮事件
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            window.location.href = 'auth.html';
        });
    }

    // 检查登录状态
    const isLoggedIn = !!localStorage.getItem('token');
    if (isLoggedIn) {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            document.getElementById('usernameDisplay').textContent = user.username;
            document.getElementById('userRole').textContent = user.role === 'root' ? '超级管理员' : user.role === 'admin' ? '管理员' : '用户';
            document.getElementById('userRole').className = `role-${user.role}`;
            document.getElementById('userAvatar').textContent = user.username.charAt(0).toUpperCase();
            document.getElementById('userLoginStatus').textContent= '';
            document.getElementById('loginBtn').innerHTML = '<i class="fas fa-sign-out-alt"></i> 登出';
            document.getElementById('loginBtn').onclick = logout;
        } catch (e) {
            console.error('解析用户信息失败:', e);
        }
    }

    // 创建游戏按钮事件
    const createGameBtn = document.getElementById('createGameBtn');
    if (createGameBtn) {
        createGameBtn.addEventListener('click', () => {
            if (!isLoggedIn) {
                showLoginPrompt();
                return;
            }
            document.getElementById('createGameModal').style.display = 'flex';
        });
    }

    // 关闭模态框按钮
    const closeModalBtns = document.querySelectorAll('.close-btn');
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('createGameModal').style.display = 'none';
            document.getElementById('loginPromptModal').style.display = 'none';
        });
    });

    // 点击模态框外部关闭
    window.addEventListener('click', (e) => {
        if (e.target === document.getElementById('createGameModal')) {
            document.getElementById('createGameModal').style.display = 'none';
        }
        if (e.target === document.getElementById('loginPromptModal')) {
            document.getElementById('loginPromptModal').style.display = 'none';
        }
    });

    // 创建游戏表单提交
    const createGameForm = document.getElementById('createGameForm');
    if (createGameForm) {
        createGameForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const gameName = document.getElementById('gameName').value.trim();
            if (!gameName) {
                showNotification('请输入房间名称', 'error');
                return;
            }

            try {
                const response = await fetch(`${AppConfig.API_BASE_URL}/api/game/create`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: gameName
                    })
                });

                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(error || '创建房间失败');
                }

                const game = await response.json();
                showNotification('房间创建成功', 'success');
                document.getElementById('createGameModal').style.display = 'none';

                // 跳转到房间页面
                setTimeout(() => {
                    window.location.href = `room.html?game_id=${game.id}`;
                }, 1000);
            } catch (error) {
                showNotification(error.message, 'error');
            }
        });
    }

    // 加载数据
    try {
        const playersResponse = await fetch(`${AppConfig.API_BASE_URL}/api/player/all`);
        const gamesResponse = await fetch(`${AppConfig.API_BASE_URL}/api/game/all`);

        if (!playersResponse.ok) throw new Error('获取玩家列表失败');
        if (!gamesResponse.ok) throw new Error('获取游戏列表失败');

        const players = await playersResponse.json();
        const games = await gamesResponse.json();

        renderPlayers(players);
        renderGames(games, isLoggedIn);

        // 添加搜索功能
        const playerSearch = document.getElementById('playerSearch');
        if (playerSearch) {
            playerSearch.addEventListener('input', () => {
                const searchTerm = playerSearch.value.toLowerCase();
                const playerCards = document.querySelectorAll('.player-card');

                playerCards.forEach(card => {
                    const playerName = card.querySelector('.player-name').textContent.toLowerCase();
                    if (playerName.includes(searchTerm)) {
                        card.style.display = 'flex';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        }
    } catch (error) {
        showNotification('加载数据失败: ' + error.message, 'error');
    }
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'lobby.html';
}

function renderPlayers(players) {
    const playersGrid = document.getElementById('playersGrid');
    if (!playersGrid) return;

    // players按playerId排序
    players.sort((a, b) => a.id - b.id);

    playersGrid.innerHTML = players.map(player => `
        <div class="player-card" data-player-id="${player.id}">
            <div class="player-role role-${player.role}">${player.role === 'root' ? '超级管理员' : player.role === 'admin' ? '管理员' : '玩家'}</div>
            <div class="player-avatar">${player.username.charAt(0).toUpperCase()}</div>
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
                    <span class="value">${calculateWinRate(player.wins, player.losses)}%</span>
                    <span class="label">胜率</span>
                </div>
            </div>
        </div>
    `).join('');
}

function renderGames(games, isLoggedIn) {
    const gamesList = document.getElementById('gamesList');
    if (!gamesList) return;

    games.sort((a, b) => a.id - b.id);

    gamesList.innerHTML = games.map(game => `
        <div class="game-card" data-game-id="${game.id}">
            <div class="game-header">
                <div class="game-name">${game.name}</div>
                <div class="game-status status-${game.status}">${getStatusText(game.status)}</div>
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
                ${(game.status === 'rolling' || game.status === 'inGame') ? `
                    <button class="btn btn-secondary view-game-btn" data-game-id="${game.id}">
                        <i class="fas fa-eye"></i> 观战
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');

    // 添加加入游戏事件
    document.querySelectorAll('.join-game-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!isLoggedIn) {
                showLoginPrompt();
                return;
            }
            const gameId = btn.dataset.gameId;
            joinGame(gameId);
        });
    });
}

function getStatusText(status) {
    switch (status) {
        case 'waiting': return '等待中';
        case 'rolling': return '分队中';
        case 'inGame': return '游戏中';
        case 'finished': return '已结束';
        default: return status;
    }
}

async function joinGame(gameId) {
    try {
        const response = await fetch(`${AppConfig.API_BASE_URL}/api/game/join`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                game_Id: parseInt(gameId)
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || '加入游戏失败');
        }

        showNotification('成功加入游戏', 'success');
        setTimeout(() => {
            window.location.href = `room.html?game_id=${gameId}`;
        }, 1000);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}