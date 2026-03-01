# LLM Gateway

本地网关服务，用于转发 HTTP 请求到目标 LLM API（OpenAI、Claude 等）。内置 SQLite 数据库日志存储、翻译服务和日志查看器。

A local gateway service for forwarding HTTP requests to target LLM APIs (OpenAI, Claude, etc.) with built-in SQLite database logging, translation service, and log viewer.

## 目录

- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [环境变量配置](#环境变量配置)
- [API 文档](#api-文档)
  - [代理端点](#代理端点)
  - [日志查询 API](#日志查询-api)
  - [翻译服务 API](#翻译服务-api)
- [日志查看器](#日志查看器)
- [项目结构](#项目结构)
- [技术栈](#技术栈)
- [License](#license)

## 功能特性

- **HTTP 请求转发代理** - 将所有请求转发到配置的目标 URL
- **透明代理模式** - 直接将 Authorization header 转发到上游服务，由上游处理认证
- **SQLite 数据库日志存储** - 持久化存储所有 LLM 对话记录
- **自动日志清理** - 可配置的日志保留策略
- **翻译服务** - 基于 ModelScope API 的文本翻译功能
- **翻译缓存机制** - 智能缓存已翻译内容，减少 API 调用
- **内置日志查看器** - 可视化查看和管理日志
- **健康检查端点** - 服务监控和健康状态查询

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

在项目根目录创建 `.env` 文件：

```env
# 服务端口
PORT=3012

# 目标转发 URL（必填）
TARGET_URL=https://api.openai.com

# 注意：Gateway 是透明代理模式，API Token 将直接转发到上游服务
# 在请求中添加 Authorization header 即可
```

### 启动服务

```bash
# 生产模式
npm start

# 开发模式（热重载）
npm run dev
```

## 环境变量配置

### 基础配置

| 变量 | 必填 | 默认值 | 说明 |
|------|:----:|--------|------|
| `PORT` | 否 | `3000` | Gateway 服务端口 |
| `TARGET_URL` | 是 | - | 目标转发 URL |
| `TIMEOUT` | 否 | `60000` | 请求超时时间（毫秒） |
| `LOG_ENABLED` | 否 | `false` | 是否开启请求日志 |

**注意：** Gateway 现在运行在透明代理模式下，不再验证 `API_TOKEN`。请求中的 `Authorization` header 将被原样转发到上游服务，由上游服务处理认证。

### 数据库日志配置

| 变量 | 必填 | 默认值 | 说明 |
|------|:----:|--------|------|
| `DB_LOG_ENABLED` | 否 | `true` | 是否启用数据库日志 |
| `DB_LOG_PATH` | 否 | `./data/chat-logs.db` | 数据库文件路径 |
| `LOG_RETENTION_DAYS` | 否 | `7` | 日志保留天数 |
| `CLEANUP_INTERVAL_HOURS` | 否 | `1` | 清理任务间隔（小时） |

### 翻译服务配置

| 变量 | 必填 | 默认值 | 说明 |
|------|:----:|--------|------|
| `MODELSCOPE_API_ENDPOINT` | 否 | `https://api-inference.modelscope.cn/v1/chat/completions` | ModelScope API 端点 |
| `TRANSLATION_API_TOKEN` | 是 | - | ModelScope API Token |
| `TRANSLATION_MODEL` | 否 | `Qwen/Qwen2.5-72B-Instruct` | 翻译使用的模型 |
| `TRANSLATION_TIMEOUT` | 否 | `30000` | 翻译请求超时（毫秒） |

## API 文档

### 透明代理模式

Gateway 运行在透明代理模式，不会验证 Bearer Token。所有请求中的 `Authorization` header 将被原样转发到上游服务，由上游服务处理认证和错误返回。

```http
Authorization: Bearer your_upstream_api_token
```

如果上游服务认证失败，Gateway 会直接返回上游服务的错误响应。

### 公开端点

以下端点无需认证：

- `GET /health` - 健康检查
- `GET /viewer/*` - 日志查看器静态文件
- `GET /api/logs/db/*` - 数据库日志查询
- `POST /api/translation/*` - 翻译服务 API

### 代理端点

所有其他请求都会被转发到目标 URL。

#### 示例：聊天补全请求

```bash
curl -X POST http://localhost:3012/v1/chat/completions \
  -H "Authorization: Bearer your_upstream_api_token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

**注意：** `your_upstream_api_token` 应该是上游服务（如 OpenAI）的有效 API Token，Gateway 会将其原样转发。

#### 示例：流式响应

```bash
curl -X POST http://localhost:3012/v1/chat/completions \
  -H "Authorization: Bearer your_upstream_api_token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Tell me a story"}],
    "stream": true
  }'
```

### 日志查询 API

#### 查询日志

```http
GET /api/logs/db/query?limit=100&offset=0&startDate=2024-01-01&status=200
```

**查询参数：**
- `limit` - 返回条数（默认 100）
- `offset` - 偏移量（默认 0）
- `startDate` - 开始日期（ISO 格式）
- `endDate` - 结束日期（ISO 格式）
- `model` - 模型名称筛选
- `status` - HTTP 状态码筛选
- `minDuration` - 最小耗时（毫秒）
- `maxDuration` - 最大耗时（毫秒）

**响应示例：**

```json
{
  "entries": [
    {
      "id": 1,
      "timestamp": "2024-01-01T12:00:00.000Z",
      "path": "/v1/chat/completions",
      "method": "POST",
      "requestBody": {...},
      "responseStatus": 200,
      "responseBody": {...},
      "duration": 1234
    }
  ],
  "pagination": {
    "total": 1000,
    "limit": 100,
    "offset": 0,
    "hasMore": true
  }
}
```

#### 获取会话列表

```http
GET /api/logs/db/sessions?limit=50&offset=0
```

#### 获取会话日志

```http
GET /api/logs/db/sessions/:sessionId/logs
```

#### 获取模型列表

```http
GET /api/logs/db/models
```

#### 获取 Token 统计

```http
GET /api/logs/db/stats/tokens?startDate=2024-01-01
```

#### 获取每小时统计

```http
GET /api/logs/db/stats/hourly?startDate=2024-01-01
```

#### 数据库健康检查

```http
GET /api/logs/db/health
```

### 翻译服务 API

翻译服务支持多种内容块类型的翻译，包括文本、工具调用、工具结果和图片。

#### 支持的内容类型

| 类型 | 说明 |
|------|------|
| `text` | 普通文本内容 |
| `tool_use` | 工具调用块（包含 name 和 input） |
| `tool_result` | 工具结果块（包含 tool_use_id 和 content） |
| `image` | 图片内容（返回类型描述） |

#### 检查翻译缓存

```http
POST /api/translation/check
```

**请求体：**

```json
{
  "block": {
    "type": "text",
    "text": "Hello, world!"
  },
  "blockType": "text"
}
```

**响应示例（有缓存）：**

```json
{
  "hasCache": true,
  "translatedText": "你好，世界！",
  "sourceType": "text",
  "hitCount": 5
}
```

**响应示例（无缓存）：**

```json
{
  "hasCache": false
}
```

#### 执行翻译

```http
POST /api/translation/translate
```

**请求体：**

```json
{
  "block": {
    "type": "text",
    "text": "Hello, world!"
  }
}
```

**响应示例（成功）：**

```json
{
  "success": true,
  "translatedText": "你好，世界！",
  "fromCache": false,
  "sourceType": "text"
}
```

**响应示例（从缓存）：**

```json
{
  "success": true,
  "translatedText": "你好，世界！",
  "fromCache": true,
  "sourceType": "text",
  "hitCount": 5
}
```

**响应示例（失败）：**

```json
{
  "success": false,
  "error": "Translation failed: API error",
  "sourceType": "text"
}
```

#### 获取翻译统计

```http
GET /api/translation/stats
```

**响应示例：**

```json
{
  "totalTranslations": 1000,
  "cachedTranslations": 700,
  "cacheHitRate": 0.7,
  "bySourceType": {
    "text": 800,
    "tool_use": 150,
    "tool_result": 50
  }
}
```

## 日志查看器

访问内置日志查看器：

```
http://localhost:3012/viewer/
```

日志查看器提供以下功能：

- 浏览所有 LLM 对话日志
- 按会话分组查看
- 按模型、状态、时间筛选
- 查看 Token 使用统计
- 查看每小时请求趋势
- 健康状态监控

## 项目结构

```
llm_gateway/
├── src/
│   ├── index.js           # 主服务入口
│   ├── db-logger.js       # SQLite 数据库日志记录器
│   ├── api-db.js          # 数据库 API 路由
│   ├── database.js        # 翻译数据库管理
│   ├── translator.js      # 翻译服务核心逻辑
│   ├── translation-api.js # 翻译 API 路由
│   └── utils.js           # 工具函数
├── viewer/                # 日志查看器前端
│   └── dist/              # 构建输出目录
├── scripts/               # 工具脚本
│   └── migrate-logs.js    # 日志迁移脚本
├── data/                  # 数据库存储目录
│   └── chat-logs.db       # SQLite 数据库文件
├── .env.example           # 环境变量示例
├── .env                   # 环境变量配置（本地）
├── package.json           # 项目依赖
└── README.md              # 项目文档
```

## 技术栈

- **Express.js** (^4.18.2) - Web 框架
- **Axios** (^1.6.0) - HTTP 客户端
- **better-sqlite3** (^9.6.0) - SQLite 数据库驱动
- **Dotenv** (^16.3.1) - 环境变量管理
- **Node.js** - 运行时环境

## License

MIT License - see [LICENSE](LICENSE) for details.
