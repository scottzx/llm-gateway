const API_BASE = '/api';

/**
 * 获取所有日志文件列表
 */
export async function fetchLogFiles() {
  const response = await fetch(`${API_BASE}/logs`);
  if (!response.ok) {
    throw new Error(`Failed to fetch log files: ${response.statusText}`);
  }
  const data = await response.json();
  return data.files;
}

/**
 * 获取指定日志文件的解析数据
 */
export async function fetchLogData(filename) {
  const response = await fetch(`${API_BASE}/logs/${encodeURIComponent(filename)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch log data: ${response.statusText}`);
  }
  const data = await response.json();
  return data.entries;
}

/**
 * 获取单个条目详情
 */
export async function fetchEntryDetail(filename, entryId) {
  const response = await fetch(`${API_BASE}/logs/${encodeURIComponent(filename)}/${entryId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch entry detail: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
}

/**
 * 获取条目的差异信息
 */
export async function fetchEntryDiff(filename, entryId) {
  const response = await fetch(`${API_BASE}/logs/${encodeURIComponent(filename)}/${entryId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch entry diff: ${response.statusText}`);
  }
  const data = await response.json();
  return data.diff;
}
