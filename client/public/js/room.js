document.addEventListener('DOMContentLoaded', async () => {
    if (!isLoggedIn()) return;

    // 获取游戏ID
    const gameId = getUrlParam('gameId');
    if (!gameId) {
        showNotification('无效的房间ID', 'error');
        setTimeout(() => {
            window.location.href = 'lobby.html';
        }, 2000);
        return;
    }

    // 加载用户信息
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    document.getElementById('usernameDisplay').textContent = user.username;
    document.getElementById('userRole').textContent = user.role === 'root' ? '超级管理员' : user.role === 'admin' ? '管理员' : '用户';
    document.getElementById('userRole').className = `role-${user.role}`;
    document.getElementById('userAvatar').style.backgroundImage = `url('assets/images/avatars/${user.id % 10}.png')`;

    // 登出按钮
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('playerId');
        window.location.href = 'auth.html';
    });

    // 加载房间数据
    await loadRoomData(gameId);
});

// 加载房间数据
async function loadRoomData(gameId) {
    try {
        const response = await fetch(`${AppConfig.API_BASE_URL}/api/game/all`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('获取房间数据失败');
        }

        const games = await response.json();
        const game = games.find(g => g.id === parseInt(gameId));
        renderRoom(game);
    } catch (error) {
        showNotification(error.message, 'error');
        setTimeout(() => {
            window.location.href = 'lobby.html';
        }, 2000);
    }
}

// 渲染房间
function renderRoom(game) {
    const roomContainer = document.getElementById('roomContainer');
    if (!roomContainer) return;

    const user = JSON.parse(localStorage.getItem('user'));
    const isCreator = game.creator === user.id;
    const isInGame = game.players.some(p => p.id === user.id);
    const creatorName = game.players.find(p => p.id === game.creator)?.name || '未知玩家';

    if (!isInGame && game.status !== 'waiting') {
        showNotification('你不在该游戏中', 'error');
        setTimeout(() => {
            window.location.href = 'lobby.html';
        }, 2000);
        return;
    }

    // 创建房间HTML
    let roomHTML = `
        <div class="room-header">
            <div class="room-title">
                <i class="fas fa-gamepad"></i>
                <span>${game.name}</span>
                <div class="room-status ${game.status}">${getStatusText(game.status)}</div>
            </div>
            <div class="room-meta">
                <span><i class="fas fa-crown"></i> 房主: ${creatorName}</span>
                <span><i class="fas fa-users"></i> 人数: ${game.players.length}/10</span>
                <span><i class="fas fa-clock"></i> 创建时间: ${formatDate(game.createdAt)}</span>
            </div>
        </div>
        
        <div class="room-content">
            <div class="room-teams">
                <div class="team team-1">
                    <div class="team-header">
                        <div class="team-title">
                            <i class="fas fa-users"></i>
                            <span>队伍1</span>
                        </div>
                        ${game.status === 'finished' && game.winner === 1 ? '<div class="team-winner">胜利！！！</div>' : ''}
                    </div>
                    <div class="team-players">
                        ${renderTeamPlayers(game.players, 1, game.status)}
                    </div>
                </div>
                
                <div class="team team-2">
                    <div class="team-header">
                        <div class="team-title">
                            <i class="fas fa-users"></i>
                            <span>队伍2</span>
                        </div>
                        ${game.status === 'finished' && game.winner === 2 ? '<div class="team-winner">胜利</div>' : ''}
                    </div>
                    <div class="team-players">
                        ${renderTeamPlayers(game.players, 2, game.status)}
                    </div>
                </div>
            </div>
            
            <div class="room-actions">
                ${renderActionButtons(game, user.id, isCreator)}
            </div>
        </div>
    `;

    roomContainer.innerHTML = roomHTML;

    // 初始化事件监听
    initRoomEventListeners(game, user.id, isCreator);
}

// 渲染队伍玩家
function renderTeamPlayers(players, team, status) {
    const teamPlayers = players.filter(p => p.team === team);
    const positions = ['上单', '打野', '中单', 'ADC', '辅助'];
    let html = '';

    positions.forEach(pos => {
        const positionPlayers = teamPlayers.filter(p => p.position === pos);

        if (positionPlayers.length > 0) {
            positionPlayers.forEach(player => {
                html += `
                    <div class="player-slot">
                        <div class="player-avatar" style="background-image: url('../assets/images/avatars/${player.id%10}.png')"></div>
                        <div class="player-details">
                            <div class="player-name">${player.name}</div>
                            <div class="player-position">
                                <i class="fas fa-map-marker-alt"></i>
                                <span>${player.position}</span>
                            </div>
                            ${status === 'rolling' || status === 'inGame' ? `
                                <div class="player-hero">
                                    <div class="hero-image" style="background-image: url('../assets/images/heroes/${player.hero}.png')"></div>
                                    <div class="hero-name">${player.hero}</div>
                                    ${player.id === getMyPlayerId() && status === 'rolling' ? `
                                        <button class="reroll-btn" data-player-id="${player.id}" data-hero="${player.hero}">
                                            <i class="fas fa-dice"></i> 重ROLL
                                        </button>
                                    ` : ''}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            });
        } else if (status === 'waiting') {
            html += `
                <div class="player-slot empty">
                    <i class="fas fa-user-plus"></i>
                    <span>${pos}位置空缺</span>
                </div>
            `;
        }
    });

    return html || '<div class="player-slot empty"><span>暂无玩家</span></div>';
}

// 渲染操作按钮
function renderActionButtons(game, userId, isCreator) {
    let buttons = '';

    if (game.status === 'waiting') {
        // 等待中状态
        buttons += `
            <button class="position-card-btn" id="usePositionCardBtn">
                <i class="fas fa-map-marked-alt"></i>
                <span>使用位置卡</span>
            </button>
        `;

        if (isCreator && game.players.length === 10) {
            buttons += `
                <button class="roll-teams-btn" id="rollTeamsBtn">
                    <i class="fas fa-random"></i>
                    <span>开始分队</span>
                </button>
            `;
        }

        buttons += `
            <button class="leave-room-btn" id="leaveRoomBtn">
                <i class="fas fa-sign-out-alt"></i>
                <span>退出房间</span>
            </button>
        `;
    } else if (game.status === 'rolling') {
        // 分队中状态
        if (isCreator) {
            buttons += `
                <button class="start-game-btn" id="startGameBtn">
                    <i class="fas fa-play"></i>
                    <span>开始游戏</span>
                </button>
            `;
        }
    } else if (game.status === 'inGame') {
        // 游戏中状态
        if (isCreator) {
            buttons += `
                <button class="end-game-btn" id="endGameBtn">
                    <i class="fas fa-flag-checkered"></i>
                    <span>结束游戏</span>
                </button>
            `;
        }
    } else if (game.status === 'finished') {
        // 已结束状态
        buttons += `
            <button class="leave-room-btn" id="leaveRoomBtn">
                <i class="fas fa-sign-out-alt"></i>
                <span>返回大厅</span>
            </button>
        `;
    }

    return buttons;
}

// 初始化房间事件监听
function initRoomEventListeners(game, userId, isCreator) {
    // 使用位置卡按钮
    const usePositionCardBtn = document.getElementById('usePositionCardBtn');
    if (usePositionCardBtn) {
        usePositionCardBtn.addEventListener('click', () => {
            showPositionCardModal();
        });
    }

    // 开始分队按钮
    const rollTeamsBtn = document.getElementById('rollTeamsBtn');
    if (rollTeamsBtn) {
        rollTeamsBtn.addEventListener('click', async () => {
            try {
                const response = await fetch(`${AppConfig.API_BASE_URL}/api/game/roll`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        gameId : parseInt(game.id),
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '分队失败');
                }

                showNotification('分队成功', 'success');
            } catch (error) {
                showNotification(error.message, 'error');
            }
        });
    }

    // 开始游戏按钮
    const startGameBtn = document.getElementById('startGameBtn');
    if (startGameBtn) {
        startGameBtn.addEventListener('click', async () => {
            try {
                const response = await fetch(`${AppConfig.API_BASE_URL}/api/game/start`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        gameId : parseInt(game.id),
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '开始游戏失败');
                }

                showNotification('游戏开始', 'success');
            } catch (error) {
                showNotification(error.message, 'error');
            }
        });
    }

    // 结束游戏按钮
    const endGameBtn = document.getElementById('endGameBtn');
    if (endGameBtn) {
        endGameBtn.addEventListener('click', () => {
            showEndGameModal(game.id);
        });
    }

    // 退出房间按钮
    const leaveRoomBtn = document.getElementById('leaveRoomBtn');
    if (leaveRoomBtn) {
        leaveRoomBtn.addEventListener('click', async () => {
            try {
                const response = await fetch(`${AppConfig.API_BASE_URL}/api/game/leave`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '退出房间失败');
                }

                showNotification('已退出房间', 'success');
                setTimeout(() => {
                    window.location.href = 'lobby.html';
                }, 1000);
            } catch (error) {
                showNotification(error.message, 'error');
            }
        });
    }

    // 重ROLL英雄按钮
    document.addEventListener('click', (e) => {
        if (e.target.closest('.reroll-btn')) {
            const playerId = e.target.closest('.reroll-btn').dataset.playerId;
            const currentHero = e.target.closest('.reroll-btn').dataset.hero;
            showRerollModal(playerId, currentHero);
        }
    });
}

// 显示位置卡模态框
function showPositionCardModal() {
    const user = JSON.parse(localStorage.getItem('user'));
    const modal = document.getElementById('positionCardModal');

    document.getElementById('positionCardCount').textContent = user.positionCard;

    // 位置按钮事件
    const positionBtns = document.querySelectorAll('.position-btn');
    positionBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const position = btn.dataset.position;

            try {
                const response = await fetch(`${AppConfig.API_BASE_URL}/api/game/use_position`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        position
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || '使用位置卡失败');
                }

                showNotification(`已锁定位置: ${position}`, 'success');
                modal.style.display = 'none';

                // 重新加载房间数据
                const gameId = getUrlParam('gameId');
                loadRoomData(gameId);
            } catch (error) {
                showNotification(error.message, 'error');
            }
        });
    });

    modal.style.display = 'flex';

    // 关闭按钮
    const closeBtn = modal.querySelector('.close-btn');
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    // 点击外部关闭
    window.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

// 显示重ROLL英雄模态框
function showRerollModal(playerId, currentHero) {
    const user = JSON.parse(localStorage.getItem('user'));
    const modal = document.getElementById('rerollModal');

    document.getElementById('currentHeroName').textContent = currentHero;
    document.getElementById('currentHeroImage').src = `assets/images/heroes/${currentHero}.png`;
    document.getElementById('diceCount').textContent = user.dice;

    modal.style.display = 'flex';

    // 确认重ROLL
    document.getElementById('confirmReroll').addEventListener('click', async () => {
        try {
            const response = await fetch(`${AppConfig.API_BASE_URL}/api/game/reroll`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '重ROLL英雄失败');
            }

            showNotification('英雄已重新ROLL取', 'success');
            modal.style.display = 'none';

            // 更新用户信息
            const updatedUser = await response.json();
            localStorage.setItem('user', JSON.stringify(updatedUser));

            // 重新加载房间数据
            const gameId = getUrlParam('gameId');
            loadRoomData(gameId);
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });

    // 取消按钮
    const cancelBtn = modal.querySelector('.cancel-btn');
    cancelBtn.onclick = () => {
        modal.style.display = 'none';
    };

    // 关闭按钮
    const closeBtn = modal.querySelector('.close-btn');
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    // 点击外部关闭
    window.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

// 显示结束游戏模态框
function showEndGameModal(gameId) {
    const modal = createModal('结束游戏', document.createTextNode('请选择获胜队伍:'), [
        {
            text: '队伍1',
            class: 'btn-primary',
            action: () => endGame(gameId, 1)
        },
        {
            text: '队伍2',
            class: 'btn-danger',
            action: () => endGame(gameId, 2)
        },
        {
            text: '取消',
            class: 'cancel-btn',
            action: closeModal
        }
    ]);
}

// 结束游戏
async function endGame(gameId, winner) {
    try {
        const response = await fetch(`${AppConfig.API_BASE_URL}/api/game/end`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                gameId : parseInt(gameId),
                winner
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '结束游戏失败');
        }

        showNotification(`游戏结束，队伍${winner}获胜`, 'success');
        closeModal();

        // 重新加载房间数据
        loadRoomData(gameId);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// 获取状态文本
function getStatusText(status) {
    switch (status) {
        case 'waiting': return '等待中';
        case 'rolling': return '分队中';
        case 'inGame': return '游戏中';
        case 'finished': return '已结束';
        default: return status;
    }
}