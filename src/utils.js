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

/**
 * 从响应体中提取 token usage 信息
 * 支持多种格式：
 * - 标准JSON: {"usage": {"prompt_tokens": 12, "completion_tokens": 392, ...}}
 * - SSE流: message_delta事件中的usage字段
 * @param {string|object} responseBody - 响应体内容
 * @returns {{prompt_tokens: number, completion_tokens: number, total_tokens: number}|null}
 */
function extractUsageFromResponse(responseBody) {
  if (!responseBody) {
    return null;
  }

  // 如果是对象，尝试获取 usage
  if (typeof responseBody === 'object') {
    // 标准 OpenAI 格式
    if (responseBody.usage) {
      return {
        prompt_tokens: responseBody.usage.prompt_tokens || 0,
        completion_tokens: responseBody.usage.completion_tokens || 0,
        total_tokens: responseBody.usage.total_tokens || 0
      };
    }
    return null;
  }

  // 如果是字符串，需要先处理可能的JSON包装
  if (typeof responseBody === 'string') {
    let content = responseBody;

    // 首先尝试解析JSON（数据库存储格式）
    if (content.startsWith('"') && content.endsWith('"')) {
      try {
        const parsed = JSON.parse(content);
        if (typeof parsed === 'string') {
          content = parsed;
        }
      } catch (e) {
        // 解析失败，使用原始字符串
      }
    }

    // 1. 检查是否是包含 usage 的JSON对象
    if (content.trim().startsWith('{')) {
      try {
        const jsonObj = JSON.parse(content);
        if (jsonObj.usage) {
          return {
            prompt_tokens: jsonObj.usage.prompt_tokens || 0,
            completion_tokens: jsonObj.usage.completion_tokens || 0,
            total_tokens: jsonObj.usage.total_tokens || 0
          };
        }
      } catch (e) {
        // 不是有效的JSON，继续处理
      }
    }

    // 2. 尝试匹配标准格式的usage
    const standardMatch = content.match(/"usage":\s*\{[^}]*"prompt_tokens":\s*(\d+)[^}]*"completion_tokens":\s*(\d+)/);
    if (standardMatch) {
      return {
        prompt_tokens: parseInt(standardMatch[1]) || 0,
        completion_tokens: parseInt(standardMatch[2]) || 0,
        total_tokens: (parseInt(standardMatch[1]) || 0) + (parseInt(standardMatch[2]) || 0)
      };
    }

    // 3. 尝试匹配 SSE message_delta 事件中的 usage
    // 找到最后一个 message_delta 事件中的 usage
    const deltaMatches = content.split('event: message_delta').slice(1);
    for (const deltaEvent of deltaMatches) {
      const usageMatch = deltaEvent.match(/"usage":\s*\{[^}]*"input_tokens":\s*(\d+)[^}]*"output_tokens":\s*(\d+)/);
      if (usageMatch) {
        const inputTokens = parseInt(usageMatch[1]) || 0;
        const outputTokens = parseInt(usageMatch[2]) || 0;
        return {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens
        };
      }
    }

    return null;
  }

  return null;
}

/**
 * 替换旧的系统提示词文本
 * @param {object} requestBody - 请求体对象
 * @returns {object} 修改后的请求体
 */
function replaceOldSystemPrompt(requestBody) {
  const OLD_TEXTS = [
    "You are a Claude agent, built on Anthropic's Claude Agent SDK.",
    "You are Claude Code, Anthropic's official CLI for Claude, running within the Claude Agent SDK.",
    "You are Claude Code, Anthropic's official CLI for Claude."
  ];
  const NEW_TEXT = "You are Claude Code, Anthropic's official CLI for Claude.";

  if (!requestBody) {
    return requestBody;
  }

  let modified = false;
  const result = { ...requestBody };

  // 1. Handle 'system' array (Anthropic Messages API)
  if (result.system && Array.isArray(result.system)) {
    const modifiedSystem = result.system.map(block => {
      if (block.type === 'text' && block.text) {
        let newText = block.text;
        for (const oldText of OLD_TEXTS) {
          if (newText.includes(oldText)) {
            modified = true;
            newText = newText.replace(oldText, NEW_TEXT);
          }
        }
        if (newText !== block.text) {
          return { ...block, text: newText };
        }
      }
      return block;
    });
    if (modified) {
      result.system = modifiedSystem;
    }
  }

  // 2. Handle 'messages' array
  if (result.messages && Array.isArray(result.messages)) {
    const modifiedMessages = result.messages.map(msg => {
      if (msg.content && typeof msg.content === 'string') {
        let newContent = msg.content;
        for (const oldText of OLD_TEXTS) {
          if (newContent.includes(oldText)) {
            modified = true;
            newContent = newContent.replace(oldText, NEW_TEXT);
          }
        }
        if (newContent !== msg.content) {
          return { ...msg, content: newContent };
        }
      }
      // 处理 content 是数组的情况（如包含 text 类型的 content blocks）
      if (msg.content && Array.isArray(msg.content)) {
        const modifiedContent = msg.content.map(block => {
          if (block.type === 'text' && block.text) {
            let newText = block.text;
            for (const oldText of OLD_TEXTS) {
              if (newText.includes(oldText)) {
                modified = true;
                newText = newText.replace(oldText, NEW_TEXT);
              }
            }
            if (newText !== block.text) {
              return { ...block, text: newText };
            }
          }
          return block;
        });
        if (modified) {
          return { ...msg, content: modifiedContent };
        }
      }
      return msg;
    });
    if (modified) {
      result.messages = modifiedMessages;
    }
  }

  return modified ? result : requestBody;
}

module.exports = {
  parseUserId,
  extractMessageIdFromSSE,
  extractUsageFromResponse,
  replaceOldSystemPrompt
};
