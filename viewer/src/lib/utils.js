import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * 格式化时间戳
 */
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * 格式化时长
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * 格式化 Token 数量
 */
export function formatTokens(count) {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

/**
 * 获取消息角色标签
 */
export function getRoleBadgeClass(role) {
  switch (role) {
    case 'user':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'assistant':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'system':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    case 'tool_result':
    case 'tool_use':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
  }
}

/**
 * 获取状态码颜色
 */
export function getStatusColor(status) {
  if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400';
  if (status >= 300 && status < 400) return 'text-yellow-600 dark:text-yellow-400';
  if (status >= 400 && status < 500) return 'text-orange-600 dark:text-orange-400';
  if (status >= 500) return 'text-red-600 dark:text-red-400';
  return 'text-gray-600 dark:text-gray-400';
}

/**
 * 截断文本
 */
export function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * 安全地解析 JSON
 */
export function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * 深度克隆对象
 */
export function deepClone(obj) {
  return safeJsonParse(JSON.stringify(obj));
}

/**
 * 判断是否为工具调用消息
 */
export function isToolUseMessage(contentBlock) {
  return contentBlock?.type === 'tool_use';
}

/**
 * 判断是否为工具结果消息
 */
export function isToolResultMessage(contentBlock) {
  return contentBlock?.type === 'tool_result';
}

/**
 * 判断是否为文本消息
 */
export function isTextMessage(contentBlock) {
  return contentBlock?.type === 'text';
}

/**
 * 判断是否为图片消息
 */
export function isImageMessage(contentBlock) {
  return contentBlock?.type === 'image';
}
