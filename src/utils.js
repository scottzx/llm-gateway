/**
 * 工具函数模块
 */

/**
 * 从 metadata.user_id 中提取 user_id 和 session_id
 * 格式: user_{user_id}_account__session_{session_id}
 * @param {string} metadataUserId - metadata 中的 user_id 字段
 * @returns {{user_id: string|null, session_id: string|null}}
 */
function parseUserId(metadataUserId) {
  if (!metadataUserId || typeof metadataUserId !== 'string') {
    return { user_id: null, session_id: null };
  }

  // 匹配格式: user_xxx_account__session_yyy
  // user_id 部分可能包含下划线，所以使用非贪婪匹配
  const match = metadataUserId.match(/^user_(.+?)_account__session_(.+)$/);

  if (match) {
    return {
      user_id: match[1],
      session_id: match[2]
    };
  }

  // 如果格式不匹配，返回 null
  return { user_id: null, session_id: null };
}

/**
 * 从响应体中提取 message.id
 * 支持多种格式：
 * - GLM: {"id": "msg_xxx", ...}
 * - OpenAI/Anthropic: {"message": {"id": "msg_xxx", ...}}
 * - SSE流: 字符串格式的SSE响应
 * @param {string|object} responseBody - 响应体内容
 * @returns {string|null}
 */
function extractMessageIdFromSSE(responseBody) {
  if (!responseBody) {
    return null;
  }

  // 如果是对象，尝试获取 id
  if (typeof responseBody === 'object') {
    // 优先返回根级别的 id (GLM 等格式)
    if (responseBody.id) {
      return responseBody.id;
    }
    // 其次返回 message.id (OpenAI/Anthropic 等格式)
    if (responseBody.message?.id) {
      return responseBody.message.id;
    }
    return null;
  }

  // 如果是字符串（SSE 流），解析提取 message.id
  if (typeof responseBody === 'string') {
    // 首先尝试匹配根级别的 id: "id": "msg_xxx"
    let match = responseBody.match(/"id":\s*"((msg_[^"]+)|(call_[^"]+)|(chatcmpl_[^"]+))"/);
    if (match) {
      return match[1];
    }

    // 其次尝试匹配 message.id: "message": {"id": "msg_xxx"}
    match = responseBody.match(/"message":\s*\{[^}]*"id":\s*"([^"]+)"/);
    if (match) {
      return match[1];
    }

    return null;
  }

  return null;
}

module.exports = {
  parseUserId,
  extractMessageIdFromSSE
};
