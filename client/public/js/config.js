// config.js
const Config = {
    // API_BASE_URL: window.location.origin, // 自动获取当前域名和端口
    // WS_BASE_URL: window.location.origin.replace(/^http/, 'ws'), // 自动转换为WebSocket协议
    // 或者手动指定
    API_BASE_URL: 'http://10.10.130.205:8080',
    WS_BASE_URL: 'ws://10.10.130.205:8080'
};

// 导出配置
window.AppConfig = Config;