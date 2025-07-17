document.addEventListener('DOMContentLoaded', async () => {
    if (!checkAuth()) return;

    // 加载用户信息
    const user = await loadUserInfo();
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

    // 标签页切换
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            document.querySelectorAll('.leaderboard-tab').forEach(t => t.classList.remove('active'));
            document.getElementById(`${tab.dataset.tab}Tab`).classList.add('active');
        });
    });

    // 加载排行榜数据
    loadLeaderboardData();
});

// 加载排行榜数据
async function loadLeaderboardData() {
    try {
        const response = await fetch(`${AppConfig.API_BASE_URL}/api/player/all`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('获取排行榜数据失败');
        }

        const players = await response.json();
        renderLeaderboard(players);
        renderCurrentPlayerCard(players);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// 渲染排行榜
function renderLeaderboard(players) {
    // 胜率榜
    const winrateTable = document.getElementById('winrateTable');
    if (winrateTable) {
        const sortedByWinrate = [...players].sort((a, b) => {
            const aWinrate = calculateWinRate(a.wins, a.losses);
            const bWinrate = calculateWinRate(b.wins, b.losses);
            return bWinrate - aWinrate || (b.wins + b.losses) - (a.wins + a.losses);
        });

        winrateTable.innerHTML = sortedByWinrate.map((player, index) => {
            const winrate = calculateWinRate(player.wins, player.losses);
            let winrateClass = 'winrate-high';
            if (winrate < 60) winrateClass = 'winrate-medium';
            if (winrate < 40) winrateClass = 'winrate-low';

            return `
                <div class="leaderboard-row">
                    <div class="rank rank-${index + 1}">${index + 1}</div>
                    <div class="player">
                        <div class="player-avatar" style="background-image: url('assets/images/avatars/${player.id % 10}.png')"></div>
                        <div class="player-info">
                            <div class="player-name">${player.username}</div>
                            <div class="player-role role-${player.role}">${player.role === 'root' ? '超级管理员' : player.role === 'admin' ? '管理员' : '玩家'}</div>
                        </div>
                    </div>
                    <div class="stats">${player.wins}胜 / ${player.losses}败</div>
                    <div class="winrate ${winrateClass}">${winrate}%</div>
                </div>
            `;
        }).join('');
    }

    // 胜场榜
    const winsTable = document.getElementById('winsTable');
    if (winsTable) {
        const sortedByWins = [...players].sort((a, b) => b.wins - a.wins || a.losses - b.losses);

        winsTable.innerHTML = sortedByWins.map((player, index) => {
            return `
                <div class="leaderboard-row">
                    <div class="rank rank-${index + 1}">${index + 1}</div>
                    <div class="player">
                        <div class="player-avatar" style="background-image: url('assets/images/avatars/${player.id % 10}.png')"></div>
                        <div class="player-info">
                            <div class="player-name">${player.username}</div>
                            <div class="player-role role-${player.role}">${player.role === 'root' ? '超级管理员' : player.role === 'admin' ? '管理员' : '玩家'}</div>
                        </div>
                    </div>
                    <div class="stats">${player.wins}</div>
                    <div class="winrate">${player.losses}</div>
                </div>
            `;
        }).join('');
    }

    // 位置卡榜
    const positionTable = document.getElementById('positionTable');
    if (positionTable) {
        const sortedByPositionCards = [...players].sort((a, b) => b.position_card - a.position_card || b.dice - a.dice);

        positionTable.innerHTML = sortedByPositionCards.map((player, index) => {
            return `
                <div class="leaderboard-row">
                    <div class="rank rank-${index + 1}">${index + 1}</div>
                    <div class="player">
                        <div class="player-avatar" style="background-image: url('assets/images/avatars/${player.id % 10}.png')"></div>
                        <div class="player-info">
                            <div class="player-name">${player.username}</div>
                            <div class="player-role role-${player.role}">${player.role === 'root' ? '超级管理员' : player.role === 'admin' ? '管理员' : '玩家'}</div>
                        </div>
                    </div>
                    <div class="stats">${player.position_card}</div>
                    <div class="winrate">${player.dice}</div>
                </div>
            `;
        }).join('');
    }
}

// 渲染当前玩家卡片
function renderCurrentPlayerCard(players) {
    const user = JSON.parse(localStorage.getItem('user'));
    const currentPlayer = players.find(p => p.id === user.id);
    if (!currentPlayer) return;

    const winrate = calculateWinRate(currentPlayer.wins, currentPlayer.losses);
    let winrateClass = 'winrate-high';
    if (winrate < 60) winrateClass = 'winrate-medium';
    if (winrate < 40) winrateClass = 'winrate-low';

    const currentPlayerCard = document.getElementById('currentPlayerCard');
    if (currentPlayerCard) {
        currentPlayerCard.innerHTML = `
            <div class="current-player-avatar" style="background-image: url('assets/images/avatars/${currentPlayer.id % 10}.png')"></div>
            <div class="current-player-details">
                <div class="current-player-name">
                    <span>${currentPlayer.username}</span>
                    <span class="role-${currentPlayer.role}">${currentPlayer.role === 'root' ? '超级管理员' : currentPlayer.role === 'admin' ? '管理员' : '玩家'}</span>
                </div>
                <div class="current-player-stats">
                    <div class="current-player-stat">
                        <div class="value">${currentPlayer.wins}</div>
                        <div class="label">胜场</div>
                    </div>
                    <div class="current-player-stat">
                        <div class="value">${currentPlayer.losses}</div>
                        <div class="label">败场</div>
                    </div>
                    <div class="current-player-stat">
                        <div class="value ${winrateClass}">${winrate}%</div>
                        <div class="label">胜率</div>
                    </div>
                    <div class="current-player-stat">
                        <div class="value">${currentPlayer.position_card}</div>
                        <div class="label">位置卡</div>
                    </div>
                    <div class="current-player-stat">
                        <div class="value">${currentPlayer.dice}</div>
                        <div class="label">骰子</div>
                    </div>
                </div>
            </div>
        `;
    }
}