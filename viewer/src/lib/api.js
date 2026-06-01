const API_BASE = '/api';
const DB_API_BASE = `${API_BASE}/logs/db`;

// ============================================================================
// DATABASE API
// ============================================================================

/**
 * 获取日志列表（支持过滤和分页）
 */
export async function fetchDBLogs(filters = {}) {
  const params = new URLSearchParams();
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.offset) params.append('offset', filters.offset);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.model) params.append('model', filters.model);
  if (filters.status) params.append('status', filters.status);

  const response = await fetch(`${DB_API_BASE}/query?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch database logs: ${response.statusText}`);
  }
  const data = await response.json();
  if (data.entries) {
    data.entries = data.entries.map(enrichEntry);
  }
  return data;
}

/**
 * 获取 Token 统计
 */
export async function fetchDBTokenStats(timeRange = {}) {
  const params = new URLSearchParams();
  if (timeRange.startDate) params.append('startDate', timeRange.startDate);
  if (timeRange.endDate) params.append('endDate', timeRange.endDate);

  const response = await fetch(`${DB_API_BASE}/stats/tokens?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch token stats: ${response.statusText}`);
  }
  const data = await response.json();
  return data.stats;
}

/**
 * 获取每小时统计
 */
export async function fetchDBHourlyStats(timeRange = {}) {
  const params = new URLSearchParams();
  if (timeRange.startDate) params.append('startDate', timeRange.startDate);
  if (timeRange.endDate) params.append('endDate', timeRange.endDate);

  const response = await fetch(`${DB_API_BASE}/stats/hourly?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch hourly stats: ${response.statusText}`);
  }
  const data = await response.json();
  return data.stats;
}

/**
 * 获取模型列表
 */
export async function fetchDBModels() {
  const response = await fetch(`${DB_API_BASE}/models`);
  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.statusText}`);
  }
  const data = await response.json();
  return data.models;
}

/**
 * 获取特定会话的模型列表
 */
export async function fetchSessionModels(sessionId) {
  const response = await fetch(`${DB_API_BASE}/sessions/${encodeURIComponent(sessionId)}/models`);
  if (!response.ok) {
    throw new Error(`Failed to fetch session models: ${response.statusText}`);
  }
  const data = await response.json();
  return data.models;
}

/**
 * 获取数据库健康状态
 */
export async function fetchDBHealth() {
  const response = await fetch(`${DB_API_BASE}/health`);
  if (!response.ok) {
    throw new Error(`Failed to fetch database health: ${response.statusText}`);
  }
  return await response.json();
}

/**
 * 获取会话列表
 */
export async function fetchDBSessions(options = {}) {
  const params = new URLSearchParams();
  if (options.limit) params.append('limit', options.limit);
  if (options.offset) params.append('offset', options.offset);
  if (options.startDate) params.append('startDate', options.startDate);
  if (options.endDate) params.append('endDate', options.endDate);
  if (options.model) params.append('model', options.model);
  if (options.search) params.append('search', options.search);
  if (options.sortBy) params.append('sortBy', options.sortBy);
  if (options.sortOrder) params.append('sortOrder', options.sortOrder);

  const response = await fetch(`${DB_API_BASE}/sessions?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch sessions: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

/**
 * 获取特定会话的日志
 */
export async function fetchDBSessionLogs(sessionId, options = {}) {
  const params = new URLSearchParams();
  if (options.limit) params.append('limit', options.limit);
  if (options.offset) params.append('offset', options.offset);
  if (options.startDate) params.append('startDate', options.startDate);
  if (options.endDate) params.append('endDate', options.endDate);
  if (options.model) params.append('model', options.model);
  if (options.status) params.append('status', options.status);

  const response = await fetch(`${DB_API_BASE}/sessions/${encodeURIComponent(sessionId)}/logs?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch session logs: ${response.statusText}`);
  }
  const data = await response.json();
  if (data.entries) {
    data.entries = data.entries.map(enrichEntry);
  }
  return data;
}

// ============================================================================
// HELPERS FOR STREAMING & DATA ENRICHMENT
// ============================================================================

/**
 * 解析 SSE 响应体字符串为结构化的事件和重建的内容块
 */
export function parseSSEData(responseBody) {
  if (typeof responseBody !== 'string') return null;

  const events = [];
  const contentBlocks = [];
  let inputTokens = 0;
  let outputTokens = 0;

  // 根据双换行切分为独立的事件数据块
  const blocks = responseBody.split(/\n\n+/);
  for (const block of blocks) {
    if (!block.trim()) continue;

    let eventType = 'message';
    let eventData = null;

    const lines = block.split('\n');
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        try {
          eventData = JSON.parse(line.slice(5).trim());
        } catch (e) {
          eventData = line.slice(5).trim();
        }
      }
    }

    if (eventData) {
      events.push({ type: eventType, data: eventData });

      // 解析事件流来提取 token 使用量和重建内容块
      if (eventType === 'message_start' && eventData.message) {
        if (eventData.message.usage) {
          inputTokens = eventData.message.usage.input_tokens || 0;
        }
      } else if (eventType === 'content_block_start') {
        const index = eventData.index || 0;
        contentBlocks[index] = { ...(eventData.content_block || {}) };
      } else if (eventType === 'content_block_delta') {
        const index = eventData.index || 0;
        if (!contentBlocks[index]) {
          contentBlocks[index] = { type: 'text' };
        }
        const delta = eventData.delta;
        if (delta) {
          if (delta.type === 'text_delta' && delta.text) {
            contentBlocks[index].text = (contentBlocks[index].text || '') + delta.text;
          } else if (delta.type === 'thinking_delta' && delta.thinking) {
            contentBlocks[index].thinking = (contentBlocks[index].thinking || '') + delta.thinking;
            contentBlocks[index].type = 'thinking';
          } else if (delta.type === 'signature_delta' && delta.signature) {
            contentBlocks[index].signature = delta.signature;
          }
        }
      } else if (eventType === 'message_delta') {
        if (eventData.usage) {
          inputTokens = eventData.usage.input_tokens || inputTokens || 0;
          outputTokens = eventData.usage.output_tokens || 0;
        }
      }
    }
  }

  // 过滤掉 undefined 的内容块
  const filteredBlocks = contentBlocks.filter(b => b !== undefined);

  return {
    events,
    contentBlocks: filteredBlocks,
    inputTokens,
    outputTokens
  };
}

/**
 * 为单个日志 entry 动态补充响应类型（responseType）和流式数据（sseData）
 */
export function enrichEntry(entry) {
  if (!entry) return entry;

  const isSSE =
    (entry.responseHeaders?.['content-type']?.includes('event-stream')) ||
    (typeof entry.responseBody === 'string' && entry.responseBody.includes('event:'));

  if (isSSE) {
    entry.responseType = 'sse';
    entry.sseData = parseSSEData(entry.responseBody);
  } else {
    entry.responseType = typeof entry.responseBody === 'object' ? 'json' : 'raw';
  }

  return entry;
}
