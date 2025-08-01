document.addEventListener('DOMContentLoaded', async () => {
    // 登录按钮事件
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            window.location.href = 'auth.html';
        });
    }

    // 检查登录状态
    if (isLoggedIn()) {
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

    // 筛选器事件
    document.getElementById('dateFilter').addEventListener('change', loadHistoryData);
    document.getElementById('resultFilter').addEventListener('change', loadHistoryData);
    document.getElementById('refreshHistory').addEventListener('click', loadHistoryData);

    // 加载历史数据
    loadHistoryData();
});

// 加载历史数据
async function loadHistoryData(page = 1) {
    try {
        const dateFilter = document.getElementById('dateFilter').value;
        const resultFilter = document.getElementById('resultFilter').value;

        let url = `${AppConfig.API_BASE_URL}/api/game/all`;
        if (dateFilter !== 'all') url += `&date=${dateFilter}`;
        if (resultFilter !== 'all') url += `&result=${resultFilter}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('获取历史记录失败');
        }

        const data = await response.json();
        renderHistory(data);
        //renderPagination(data.totalPages, page);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// 渲染历史记录
function renderHistory(games) {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    // 过滤掉未结束的游戏
    games = games.filter(game => game.status === 'finished');

    if (games.length === 0) {
        historyList.innerHTML = `
            <div class="empty-history">
                <!-- <i class="fas fa-history"></i> -->
                <p>暂无历史记录</p>
            </div>
        `;
        return;
    }

    historyList.innerHTML = games.map(game => {
        const isWinner = game.players.some(p =>
            p.id === getMyPlayerId() && p.team === game.winner
        );

        return `
            <div class="history-item ${isWinner ? 'win' : 'loss'}" data-game-id="${game.id}">
                <div class="history-header-row">
                    <div class="history-game-name">${game.name}</div>
                    <div class="history-game-date">
                        <i class="fas fa-calendar-alt"></i>
                        <span>${formatDate(game.createdAt)}</span>
                    </div>
                </div>
                <div class="history-teams">
                    <div class="history-team history-team-1">
                        <div class="history-team-title">
                            <i class="fas fa-users"></i>
                            <span>队伍1</span>
                            ${game.winner === 1 ? '<span class="history-team-result">胜利</span>' : ''}
                        </div>
                        <div class="history-players">
                            ${game.players.filter(p => p.team === 1).map(player => `
                                <div class="history-player">
                                    <div class="history-player-avatar" style="background-image: url('assets/images/avatars/${player.id % 10}.png')"></div>
                                    <div class="history-player-name">${player.name}</div>
                                    <div class="history-player-position">${player.position}</div>
                                    <div class="history-player-hero" style="background-image: url('assets/images/heroes/${player.hero}.png')"></div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="history-team history-team-2">
                        <div class="history-team-title">
                            <i class="fas fa-users"></i>
                            <span>队伍2</span>
                            ${game.winner === 2 ? '<span class="history-team-result">胜利</span>' : ''}
                        </div>
                        <div class="history-players">
                            ${game.players.filter(p => p.team === 2).map(player => `
                                <div class="history-player">
                                    <div class="history-player-avatar" style="background-image: url('assets/images/avatars/${player.id % 10}.png')"></div>
                                    <div class="history-player-name">${player.name}</div>
                                    <div class="history-player-position">${player.position}</div>
                                    <div class="history-player-hero" style="background-image: url('assets/images/heroes/${player.hero}.png')"></div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // 添加点击事件查看详情
    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            const gameId = item.dataset.gameId;
            showGameDetailModal(gameId);
        });
    });
}

// 渲染分页
// function renderPagination(totalPages, currentPage) {
//     const pagination = document.getElementById('pagination');
//     if (!pagination) return;
//
//     if (totalPages <= 1) {
//         pagination.innerHTML = '';
//         return;
//     }
//
//     let html = '';
//
//     // 上一页按钮
//     html += `
//         <button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}"
//                 onclick="loadHistoryData(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
//             <i class="fas fa-chevron-left"></i>
//         </button>
//     `;
//
//     // 页码按钮
//     for (let i = 1; i <= totalPages; i++) {
//         html += `
//             <button class="pagination-btn ${i === currentPage ? 'active' : ''}"
//                     onclick="loadHistoryData(${i})">
//                 ${i}
//             </button>
//         `;
//     }
//
//     // 下一页按钮
//     html += `
//         <button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}"
//                 onclick="loadHistoryData(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
//             <i class="fas fa-chevron-right"></i>
//         </button>
//     `;
//
//     pagination.innerHTML = html;
// }

// 显示比赛详情模态框
async function showGameDetailModal(gameId) {
    try {
        const response = await fetch(`${AppConfig.API_BASE_URL}/api/game/all`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('获取比赛详情失败');
        }

        const games = await response.json();

        const game = games.find(g => g.id === gameId);
        const isWinner = game.players.some(p =>
            p.id === getMyPlayerId() && p.team === game.winner
        );

        const modal = document.getElementById('gameDetailModal');
        const modalContent = document.getElementById('gameDetailContent');

        document.getElementById('gameDetailTitle').textContent = game.name;

        modalContent.innerHTML = `
            <div class="game-detail-section">
                <h3><i class="fas fa-info-circle"></i> 比赛信息</h3>
                <div class="game-detail-meta">
                    <div class="game-detail-meta-item">
                        <div class="game-detail-meta-label">创建时间</div>
                        <div class="game-detail-meta-value">${formatDate(game.createdAt)}</div>
                    </div>
                    <div class="game-detail-meta-item">
                        <div class="game-detail-meta-label">比赛结果</div>
                        <div class="game-detail-meta-value ${isWinner ? 'text-success' : 'text-danger'}">
                            ${isWinner ? '胜利' : '失败'}
                        </div>
                    </div>
                    <div class="game-detail-meta-item">
                        <div class="game-detail-meta-label">房主</div>
                        <div class="game-detail-meta-value">${game.creatorName}</div>
                    </div>
                </div>
            </div>
            
            <div class="game-detail-section">
                <h3><i class="fas fa-users"></i> 比赛队伍</h3>
                <div class="game-detail-teams">
                    <div class="game-detail-team ${game.winner === 1 ? 'winner' : ''}">
                        <div class="game-detail-team-title">
                            <i class="fas fa-users"></i>
                            <span>队伍1</span>
                            ${game.winner === 1 ? '<span class="game-detail-team-result">胜利</span>' : ''}
                        </div>
                        <div class="game-detail-players">
                            ${game.players.filter(p => p.team === 1).map(player => `
                                <div class="game-detail-player">
                                    <div class="game-detail-player-avatar" style="background-image: url('assets/images/avatars/${player.id % 10}.png')"></div>
                                    <div class="game-detail-player-info">
                                        <div class="game-detail-player-name">${player.name}</div>
                                        <div class="game-detail-player-position">${player.position}</div>
                                    </div>
                                    <div class="game-detail-hero">
                                        <div class="game-detail-hero-image" style="background-image: url('assets/images/heroes/${player.hero}.png')"></div>
                                        <div class="game-detail-hero-name">${player.hero}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="game-detail-team ${game.winner === 2 ? 'winner' : ''}">
                        <div class="game-detail-team-title">
                            <i class="fas fa-users"></i>
                            <span>队伍2</span>
                            ${game.winner === 2 ? '<span class="game-detail-team-result">胜利</span>' : ''}
                        </div>
                        <div class="game-detail-players">
                            ${game.players.filter(p => p.team === 2).map(player => `
                                <div class="game-detail-player">
                                    <div class="game-detail-player-avatar" style="background-image: url('assets/images/avatars/${player.id % 10}.png')"></div>
                                    <div class="game-detail-player-info">
                                        <div class="game-detail-player-name">${player.name}</div>
                                        <div class="game-detail-player-position">${player.position}</div>
                                    </div>
                                    <div class="game-detail-hero">
                                        <div class="game-detail-hero-image" style="background-image: url('assets/images/heroes/${player.hero}.png')"></div>
                                        <div class="game-detail-hero-name">${player.hero}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

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
    } catch (error) {
        showNotification(error.message, 'error');
    }
}