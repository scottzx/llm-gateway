const API_BASE = '/api';
const DB_API_BASE = `${API_BASE}/logs/db`;

// ============================================================================
// DATABASE API
// ============================================================================

/**
 * 获取日志列表（支持过滤和分页）
 * @param {Object} filters - 查询过滤器
 * @param {number} filters.limit - 返回记录数限制
 * @param {number} filters.offset - 偏移量（用于分页）
 * @param {string} filters.startDate - 开始日期 (ISO 8601)
 * @param {string} filters.endDate - 结束日期 (ISO 8601)
 * @param {string} filters.model - 模型名称筛选
 * @param {string} filters.status - 状态筛选 (e.g., "200", "500")
 * @returns {Promise<Object>} { entries, pagination }
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
  return data;
}

/**
 * 获取 Token 统计
 * @param {Object} timeRange - 时间范围
 * @param {string} timeRange.startDate - 开始日期 (ISO 8601)
 * @param {string} timeRange.endDate - 结束日期 (ISO 8601)
 * @returns {Promise<Object>} Token 统计数据
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
 * @param {Object} timeRange - 时间范围
 * @param {string} timeRange.startDate - 开始日期 (ISO 8601)
 * @param {string} timeRange.endDate - 结束日期 (ISO 8601)
 * @returns {Promise<Array>} 每小时统计数据
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
 * @returns {Promise<Array<string>>} 模型名称数组
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
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<Array<string>>} 模型名称数组
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
 * @returns {Promise<Object>} 数据库健康信息
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
 * @param {Object} options - 查询选项
 * @param {number} options.limit - 返回记录数限制
 * @param {number} options.offset - 偏移量（用于分页）
 * @param {string} options.startDate - 开始日期 (ISO 8601)
 * @param {string} options.endDate - 结束日期 (ISO 8601)
 * @param {string} options.model - 模型名称筛选
 * @returns {Promise<Object>} { sessions, pagination }
 */
export async function fetchDBSessions(options = {}) {
  const params = new URLSearchParams();
  if (options.limit) params.append('limit', options.limit);
  if (options.offset) params.append('offset', options.offset);
  if (options.startDate) params.append('startDate', options.startDate);
  if (options.endDate) params.append('endDate', options.endDate);
  if (options.model) params.append('model', options.model);

  const response = await fetch(`${DB_API_BASE}/sessions?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch sessions: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

/**
 * 获取特定会话的日志
 * @param {string} sessionId - 会话 ID
 * @param {Object} options - 查询选项
 * @param {number} options.limit - 返回记录数限制
 * @param {number} options.offset - 偏移量（用于分页）
 * @param {string} options.startDate - 开始日期 (ISO 8601)
 * @param {string} options.endDate - 结束日期 (ISO 8601)
 * @param {string} options.model - 模型名称筛选
 * @param {string} options.status - 状态筛选 (e.g., "200", "500")
 * @returns {Promise<Object>} { entries, pagination }
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
  return data;
}
