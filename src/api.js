const fs = require('fs').promises;
const path = require('path');
const CHAT_LOG_DIR = process.env.CHAT_LOG_DIR || 'logs';

/**
 * 简化的 Token 估算函数
 * 基于经验值：英文约 4 字符/token，中文约 2 字符/token
 */
function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;

  let chineseChars = 0;
  let otherChars = 0;

  for (const char of text) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      chineseChars++;
    } else {
      otherChars++;
    }
  }

  return Math.ceil(chineseChars / 2 + otherChars / 4);
}

/**
 * 估算对象结构的 Token 数量
 */
function estimateObjectTokens(obj) {
  const jsonStr = JSON.stringify(obj, null, 2);
  return estimateTokens(jsonStr);
}

/**
 * 估算消息数组的 Token 数量
 */
function estimateMessagesTokens(messages) {
  if (!Array.isArray(messages)) return 0;

  // Messages API 的额外开销（每个消息约 4-5 tokens）
  const overhead = messages.length * 5;

  const contentTokens = messages.reduce((sum, msg) => {
    if (typeof msg.content === 'string') {
      return sum + estimateTokens(msg.content);
    } else if (Array.isArray(msg.content)) {
      return sum + msg.content.reduce((contentSum, block) => {
        if (block.type === 'text') {
          return contentSum + estimateTokens(block.text);
        } else if (block.type === 'tool_use') {
          return contentSum + estimateTokens(JSON.stringify(block));
        } else if (block.type === 'tool_result') {
          return contentSum + estimateTokens(JSON.stringify(block));
        } else if (block.type === 'image') {
          return contentSum + 85; // 图片约 85 tokens
        }
        return contentSum;
      }, 0);
    }
    return sum;
  }, 0);

  return overhead + contentTokens;
}

/**
 * 解析 SSE (Server-Sent Events) 格式的响应
 * 返回解析后的事件数组和统计信息
 */
function parseSSEResponse(sseText) {
  const events = [];
  const lines = sseText.split('\n');
  let currentEvent = null;

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent = { type: line.slice(7).trim() };
    } else if (line.startsWith('data: ') && currentEvent) {
      try {
        currentEvent.data = JSON.parse(line.slice(6));
      } catch {
        currentEvent.data = line.slice(6);
      }
      events.push(currentEvent);
      currentEvent = null;
    } else if (line.trim() === '' && currentEvent) {
      events.push(currentEvent);
      currentEvent = null;
    }
  }

  // 提取关键统计信息
  let inputTokens = 0;
  let outputTokens = 0;

  // 重建内容块（从 SSE 事件流）
  const contentBlocks = [];
  const activeBlocks = new Map(); // index -> block being built

  for (const event of events) {
    if (event.type === 'message_delta' && event.data?.usage) {
      inputTokens = event.data.usage.input_tokens || 0;
      outputTokens = event.data.usage.output_tokens || 0;
    }
    if (event.type === 'content_block_start' && event.data?.content_block) {
      const index = event.data.index;
      activeBlocks.set(index, {
        ...event.data.content_block,
        index,
        text: event.data.content_block.type === 'text' ? (event.data.content_block.text || '') : undefined,
        input: event.data.content_block.type === 'tool_use' ? (event.data.content_block.input || {}) : undefined,
      });
    }
    if (event.type === 'content_block_delta' && event.data?.delta) {
      const index = event.data.index;
      const block = activeBlocks.get(index);
      if (block) {
        if (event.data.delta.type === 'text_delta' && event.data.delta.text) {
          block.text = (block.text || '') + event.data.delta.text;
        }
        if (event.data.delta.type === 'input_json_delta' && event.data.delta.partial_json) {
          // 对于 tool_use，需要合并 partial_json
          // 这是一个简化处理，实际可能需要更复杂的 JSON 合并
          try {
            if (typeof block.input === 'object') {
              block.input = { ...block.input, ...JSON.parse(event.data.delta.partial_json) };
            }
          } catch {
            // 如果解析失败，保持原样
          }
        }
      }
    }
    if (event.type === 'content_block_stop') {
      const index = event.data?.index;
      if (index !== undefined && activeBlocks.has(index)) {
        contentBlocks.push(activeBlocks.get(index));
        activeBlocks.delete(index);
      }
    }
  }

  return { events, inputTokens, outputTokens, contentBlocks };
}

/**
 * 检测响应是否为 SSE 格式
 */
function isSSEResponse(responseBody) {
  if (!responseBody) return false;
  if (typeof responseBody !== 'string') return false;
  return responseBody.includes('event:') && responseBody.includes('data:');
}

/**
 * 解析 JSONL 日志文件
 */
async function parseLogFile(filename) {
  const logPath = path.join(process.cwd(), CHAT_LOG_DIR, filename);

  // 安全检查：确保文件名不包含路径遍历
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid filename');
  }

  const content = await fs.readFile(logPath, 'utf8');
  const lines = content.trim().split('\n');
  const entries = [];

  for (const line of lines) {
    if (line.trim()) {
      try {
        const entry = JSON.parse(line);

        // 计算 token 估算
        if (entry.requestBody?.messages) {
          entry.inputTokens = estimateMessagesTokens(entry.requestBody.messages);
        }

        // 处理响应数据
        if (entry.responseBody) {
          // 检查是否为 SSE 格式
          if (typeof entry.responseBody === 'string' && isSSEResponse(entry.responseBody)) {
            entry.responseType = 'sse';
            entry.sseData = parseSSEResponse(entry.responseBody);
            // 使用 SSE 中的准确 token 数据
            entry.outputTokens = entry.sseData.outputTokens;
            if (entry.sseData.inputTokens > 0) {
              entry.inputTokens = entry.sseData.inputTokens;
            }
          } else if (typeof entry.responseBody === 'object') {
            entry.responseType = 'json';
            entry.outputTokens = estimateTokens(JSON.stringify(entry.responseBody));
          } else {
            entry.responseType = 'raw';
            entry.outputTokens = estimateTokens(String(entry.responseBody));
          }
        }

        entries.push(entry);
      } catch (e) {
        console.warn(`Failed to parse log line: ${e.message}`);
      }
    }
  }

  return entries;
}

/**
 * 获取所有日志文件列表
 */
async function listLogFiles() {
  try {
    const logDirPath = path.join(process.cwd(), CHAT_LOG_DIR);
    await fs.mkdir(logDirPath, { recursive: true });

    const files = await fs.readdir(logDirPath);
    const logFiles = files
      .filter(f => f.startsWith('chat-') && f.endsWith('.jsonl'))
      .sort()
      .reverse(); // 最新的在前

    return logFiles;
  } catch (error) {
    console.error('Error listing log files:', error);
    return [];
  }
}

/**
 * 注册 API 路由
 */
function registerRoutes(app) {
  // 获取所有日志文件列表
  app.get('/api/logs', async (req, res) => {
    try {
      const files = await listLogFiles();
      res.json({ files });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // 获取指定日志文件的解析数据
  app.get('/api/logs/:filename', async (req, res) => {
    try {
      const { filename } = req.params;
      const entries = await parseLogFile(filename);

      // 计算累计 token 统计
      let cumulativeTokens = 0;
      const entriesWithStats = entries.map((entry, index) => {
        cumulativeTokens += (entry.inputTokens || 0) + (entry.outputTokens || 0);
        return {
          ...entry,
          index,
          cumulativeTokens,
          isNewConversation: index === 0 || !isContinuation(entries[index - 1], entry)
        };
      });

      res.json({ entries: entriesWithStats });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Log file not found' });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  // 获取单个条目详情
  app.get('/api/logs/:filename/:entryId', async (req, res) => {
    try {
      const { filename, entryId } = req.params;
      const entries = await parseLogFile(filename);
      const entryIndex = parseInt(entryId, 10);

      if (entryIndex < 0 || entryIndex >= entries.length) {
        return res.status(404).json({ error: 'Entry not found' });
      }

      // 计算与上一条的差异
      const entry = entries[entryIndex];
      let diff = null;

      if (entryIndex > 0) {
        const prevEntry = entries[entryIndex - 1];
        diff = {
          newMessages: getNewMessages(prevEntry.requestBody?.messages || [], entry.requestBody?.messages || []),
          newTools: getNewTools(prevEntry.requestBody?.tools || [], entry.requestBody?.tools || [])
        };
      }

      res.json({ entry, diff });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Log file not found' });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });
}

/**
 * 判断是否为对话的延续
 */
function isContinuation(prevEntry, currentEntry) {
  if (!prevEntry?.requestBody?.messages || !currentEntry?.requestBody?.messages) {
    return false;
  }

  // 检查时间间隔（小于5分钟认为是延续）
  const prevTime = new Date(prevEntry.timestamp).getTime();
  const currTime = new Date(currentEntry.timestamp).getTime();
  const timeDiff = currTime - prevTime;

  return timeDiff < 5 * 60 * 1000; // 5分钟
}

/**
 * 获取新增的消息
 */
function getNewMessages(prevMessages, currentMessages) {
  if (prevMessages.length === 0) return currentMessages;

  // 找到从哪开始是新的消息
  let newStartIndex = 0;

  // 从后往前找，找到最后一个相同的消息
  for (let i = Math.min(prevMessages.length, currentMessages.length) - 1; i >= 0; i--) {
    if (JSON.stringify(prevMessages[i]) === JSON.stringify(currentMessages[i])) {
      newStartIndex = i + 1;
      break;
    }
  }

  return currentMessages.slice(newStartIndex);
}

/**
 * 获取新增的工具
 */
function getNewTools(prevTools, currentTools) {
  if (prevTools.length === 0) return currentTools;

  const prevToolNames = new Set(prevTools.map(t => t.name));
  return currentTools.filter(t => !prevToolNames.has(t.name));
}

module.exports = { registerRoutes, estimateTokens, estimateMessagesTokens };
