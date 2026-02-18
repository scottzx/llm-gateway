require('dotenv').config();
const express = require('express');
const axios = require('axios');
const ChatLogger = require('./logger');
const { registerRoutes } = require('./api');

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET_URL = process.env.TARGET_URL;
const TIMEOUT = parseInt(process.env.TIMEOUT) || 60000;
const LOG_ENABLED = process.env.LOG_ENABLED === 'true';
const API_TOKEN = process.env.API_TOKEN;
const CHAT_LOG_ENABLED = process.env.CHAT_LOG_ENABLED === 'true';
const CHAT_LOG_DIR = process.env.CHAT_LOG_DIR || 'logs';

// 初始化聊天日志记录器
const chatLogger = CHAT_LOG_ENABLED ? new ChatLogger(CHAT_LOG_DIR) : null;

// 中间件：解析 JSON 请求体（不限制大小，由上游 API 处理）
app.use(express.json({ limit: Infinity }));
app.use(express.urlencoded({ extended: true, limit: Infinity }));

// 请求日志中间件
if (LOG_ENABLED) {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// 注册 API 路由（不需要认证）
const path = require('path');
registerRoutes(app);

// 注册翻译 API 路由
const { registerTranslationRoutes } = require('./translation-api');
registerTranslationRoutes(app);

// 静态文件服务 - Viewer 应用（不需要认证）
app.use('/viewer', express.static(path.join(__dirname, '../viewer/dist')));

// 认证中间件
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.substring(7);
  if (token !== API_TOKEN) {
    return res.status(403).json({ error: 'Invalid API token' });
  }

  next();
};

// 代理中间件
const proxyMiddleware = async (req, res) => {
  const startTime = Date.now();

  try {
    // 构建目标 URL
    const targetUrl = `${TARGET_URL}${req.path}`;

    if (LOG_ENABLED) {
      console.log(`[Proxy] 转发请求: ${req.method} ${targetUrl}`);
    }

    // 准备请求头
    const headers = { ...req.headers };

    // 移除可能导致问题的 headers
    delete headers.host;
    delete headers.connection;
    delete headers['content-length'];

    // 使用 axios 发起请求（不使用 responseType: 'arraybuffer'）
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: headers,
      data: req.body,
      params: req.query,
      timeout: TIMEOUT,
      validateStatus: () => true,
      maxRedirects: 5,
      maxContentLength: 50 * 1024 * 1024, // 50MB
      maxBodyLength: 50 * 1024 * 1024
    });

    if (LOG_ENABLED) {
      console.log(`[Proxy] 收到响应: ${response.status}`);
    }

    // 获取响应数据（自动检测 JSON 或其他格式）
    const responseData = response.data;

    // 计算请求耗时
    const duration = Date.now() - startTime;

    // 记录聊天日志
    if (CHAT_LOG_ENABLED && chatLogger) {
      await chatLogger.log({
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
        requestBody: req.body,
        requestQuery: req.query,
        requestHeaders: {
          authorization: req.headers.authorization,
          'content-type': req.headers['content-type'],
          'user-agent': req.headers['user-agent']
        },
        responseStatus: response.status,
        responseBody: responseData,
        responseHeaders: {
          'content-type': response.headers['content-type'],
          'x-request-id': response.headers['x-request-id']
        },
        duration: duration
      });
    }

    // 转发响应头
    Object.keys(response.headers).forEach(key => {
      if (key.toLowerCase() !== 'transfer-encoding' && key.toLowerCase() !== 'content-encoding') {
        res.setHeader(key, response.headers[key]);
      }
    });

    // 转发响应状态和数据
    res.status(response.status);
    res.send(responseData);

  } catch (error) {
    const duration = Date.now() - startTime;

    if (LOG_ENABLED) {
      console.error('[Proxy] 错误:', error.message);
    }

    // 记录错误日志
    if (CHAT_LOG_ENABLED && chatLogger) {
      await chatLogger.log({
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
        requestBody: req.body,
        requestQuery: req.query,
        requestHeaders: {
          authorization: req.headers.authorization,
          'content-type': req.headers['content-type'],
          'user-agent': req.headers['user-agent']
        },
        responseStatus: 500,
        responseBody: null,
        error: error.message,
        duration: duration
      });
    }

    // 处理超时错误
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return res.status(504).json({
        error: 'Gateway Timeout',
        message: `请求超时 (${TIMEOUT}ms)`
      });
    }

    // 处理连接错误
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: '无法连接到目标服务器'
      });
    }

    // 其他错误
    res.status(500).json({
      error: 'Internal Gateway Error',
      message: error.message
    });
  }
};

// 健康检查端点（不需要认证）
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 应用认证中间件到所有代理路由
app.use(authMiddleware);

// 代理所有请求
app.all('/*', proxyMiddleware);

// 启动服务器
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║              LLM Gateway 服务已启动                      ║
╠══════════════════════════════════════════════════════════╣
║  端口:      ${PORT}                                       ║
║  目标URL:   ${TARGET_URL}                     ║
║  超时时间:  ${TIMEOUT}ms                                   ║
║  日志:      ${LOG_ENABLED ? '开启' : '关闭'}                         ║
║  聊天日志:  ${CHAT_LOG_ENABLED ? '开启 (' + CHAT_LOG_DIR + ')' : '关闭'}              ║
╚══════════════════════════════════════════════════════════╝

代理路径: http://localhost:${PORT}/
健康检查: http://localhost:${PORT}/health
  `);
});
