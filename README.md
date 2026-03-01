# LLM Gateway

A local gateway service for forwarding HTTP requests to target LLM APIs (OpenAI, Claude, etc.).

本地网关服务，用于转发 HTTP 请求到目标 LLM API。

## 功能特性

- **请求转发**：将所有请求转发到配置的目标 URL
- **Bearer Token 认证**：支持 API Token 验证
- **请求日志**：可配置的请求日志记录
- **聊天日志**：SQLite 数据库存储所有对话记录
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

# 数据库日志配置
DB_LOG_ENABLED=true
DB_LOG_PATH=./data/chat-logs.db
LOG_RETENTION_DAYS=7
```

### 启动服务

```bash
# 生产模式
npm start

# 开发模式 (热重载)
npm run dev
```

## 日志系统

本应用使用 SQLite 数据库存储所有 LLM 对话日志。

### 环境变量

- `DB_LOG_ENABLED`: 启用数据库日志（默认: true）
- `DB_LOG_PATH`: 数据库文件路径（默认: ./data/chat-logs.db）
- `LOG_RETENTION_DAYS`: 日志保留天数（默认: 7 天）

### API 端点

所有日志查询通过 `/api/logs/db/*` 端点：

- `GET /api/logs/db/query` - 查询日志（支持筛选、分页）
- `GET /api/logs/db/sessions` - 获取会话列表
- `GET /api/logs/db/sessions/:sessionId/logs` - 获取会话日志
- `GET /api/logs/db/models` - 获取模型列表
- `GET /api/logs/db/stats/tokens` - 获取 Token 统计
- `GET /api/logs/db/stats/hourly` - 获取每小时统计
- `GET /api/logs/db/health` - 数据库健康检查

### 历史数据迁移

如果有旧的文件日志（JSONL 格式），使用迁移脚本：

```bash
node scripts/migrate-logs.js
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
- `GET /api/logs/db/*` - 数据库日志查询（无需认证）

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
│   ├── db-logger.js  # SQLite 数据库日志
│   └── api-db.js     # 数据库 API 路由
├── viewer/           # 日志查看器前端
├── scripts/          # 工具脚本
│   └── migrate-logs.js  # 日志迁移脚本
├── data/             # 数据库存储目录
├── .env              # 环境变量配置
└── package.json      # 项目依赖
```

## 技术栈

- **Express.js** - Web 框架
- **Axios** - HTTP 客户端
- **Dotenv** - 环境变量管理
- **SQLite** - 数据库存储
- **better-sqlite3** - SQLite 驱动

## License

MIT License - see [LICENSE](LICENSE) for details.
