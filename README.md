# LLM Gateway

A local gateway service for forwarding HTTP requests to target LLM APIs (OpenAI, Claude, etc.).

本地网关服务，用于转发 HTTP 请求到目标 LLM API。

## 功能特性

- **请求转发**：将所有请求转发到配置的目标 URL
- **Bearer Token 认证**：支持 API Token 验证
- **请求日志**：可配置的请求日志记录
- **聊天日志**：按小时分割的 JSON Lines 格式日志
- **健康检查**：提供 `/health` 端点用于服务监控
- **Viewer 应用**：内置静态文件服务用于日志查看

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

在项目根目录创建 `.env` 文件：

```env
# 服务端口
PORT=3000

# 目标 URL (必填)
TARGET_URL=https://api.openai.com

# API Token (必填，用于认证)
API_TOKEN=your_api_token_here

# 请求超时时间 (毫秒)
TIMEOUT=60000

# 请求日志 (true/false)
LOG_ENABLED=true

# 聊天日志 (true/false)
CHAT_LOG_ENABLED=true

# 聊天日志目录
CHAT_LOG_DIR=logs
```

### 启动服务

```bash
# 生产模式
npm start

# 开发模式 (热重载)
npm run dev
```

## API 使用

### 认证

除以下端点外，所有请求都需要携带 Bearer Token：

```http
Authorization: Bearer your_api_token_here
```

### 公开端点

- `GET /health` - 健康检查
- `GET /viewer/*` - 日志查看器静态文件

### 代理端点

所有其他请求都会被转发到目标 URL。例如：

```bash
# 转发到 TARGET_URL/v1/chat/completions
curl -X POST http://localhost:3012/v1/chat/completions \
  -H "Authorization: Bearer your_api_token_here" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello"}]}'
```

## 项目结构

```
llm_gateway/
├── src/
│   ├── index.js      # 主服务入口
│   ├── logger.js    # ChatLogger 类
│   └── api.js       # API 路由
├── viewer/           # 日志查看器前端
├── logs/            # 日志存储目录
├── .env             # 环境变量配置
└── package.json     # 项目依赖
```

## 技术栈

- **Express.js** - Web 框架
- **Axios** - HTTP 客户端
- **Dotenv** - 环境变量管理
- **http-proxy-middleware** - 代理中间件

## License

MIT License - see [LICENSE](LICENSE) for details.
