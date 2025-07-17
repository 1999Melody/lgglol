document.addEventListener('DOMContentLoaded', () => {
    // 检查是否已登录
    if (isLoggedIn()) {
        window.location.href = 'lobby.html';
        return;
    }

    // 切换登录/注册标签页
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    loginTab.addEventListener('click', () => {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
    });

    registerTab.addEventListener('click', () => {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
    });

    const action = getUrlParam('action');
    if (action === 'register') {
        // 如果是注册页面，自动切换到注册标签
        document.getElementById('registerTab').click();
    } else {
        // 默认显示登录标签
        document.getElementById('loginTab').click();
    }

    // 登录表单提交
    const loginFormElement = document.getElementById('loginFormElement');
    loginFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;

        if (!username || !password) {
            showNotification('请输入用户名和密码', 'error');
            return;
        }

        try {
            const response = await fetch(`${AppConfig.API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    password
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(error || '登录失败');
            }

            const data = await response.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.player));

            showNotification('登录成功', 'success');
            setTimeout(() => {
                window.location.href = 'lobby.html';
            }, 1000);
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });

    // 注册表单提交
    const registerFormElement = document.getElementById('registerFormElement');
    registerFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = document.getElementById('registerUsername').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;

        if (!username || !password || !confirmPassword) {
            showNotification('请填写所有字段', 'error');
            return;
        }

        if (password !== confirmPassword) {
            showNotification('两次输入的密码不一致', 'error');
            return;
        }

        if (password.length < 6) {
            showNotification('密码长度至少为6位', 'error');
            return;
        }

        try {
            const response = await fetch(`${AppConfig.API_BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    password
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(error || '注册失败');
            }

            const data = await response.json();
            showNotification('注册成功，请登录', 'success');

            // 自动切换到登录标签页
            loginTab.click();
            document.getElementById('loginUsername').value = username;
            document.getElementById('loginPassword').value = '';
            document.getElementById('registerPassword').value = '';
            document.getElementById('registerConfirmPassword').value = '';
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });
});