/**
 * Token 使用分析器
 * 从日志条目中提取并分析各角色的 token 使用情况
 */

/**
 * 从消息内容中提取 system-reminder 的 token 数量
 * System-reminder 以 <system-reminder> 开始，以 </system-reminder> 结束
 */
export function extractSystemReminderTokens(message) {
  if (!message) return 0;

  let content = '';
  let systemReminderTokens = 0;

  // 获取消息内容
  if (typeof message.content === 'string') {
    content = message.content;
  } else if (Array.isArray(message.content)) {
    // 对于 content block 数组，提取 text block 的内容
    const textBlocks = message.content
      .filter(block => block.type === 'text' && block.text)
      .map(block => block.text);
    content = textBlocks.join('\n');
  } else if (message.text) {
    content = message.text;
  }

  if (!content) return 0;

  // 使用正则表达式匹配所有 <system-reminder> 块
  const systemReminderRegex = /<system-reminder>[\s\S]*?<\/system-reminder>/gi;
  const matches = content.match(systemReminderRegex);

  if (matches) {
    systemReminderTokens = matches.reduce((total, match) => {
      return total + estimateTokensFromText(match);
    }, 0);
  }

  return systemReminderTokens;
}

/**
 * 估算文本的 token 数量
 * 中文约 2 字符/token，英文约 4 字符/token
 */
export function estimateTokensFromText(text) {
  if (!text || typeof text !== 'string') return 0;

  // 移除空白字符进行统计
  const cleanText = text.replace(/\s+/g, '');

  let chineseChars = 0;
  let otherChars = 0;

  for (const char of cleanText) {
    // 判断是否为中文字符（包括中文标点）
    if (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char)) {
      chineseChars++;
    } else {
      otherChars++;
    }
  }

  // 中文约 2 字符/token，其他约 4 字符/token
  return Math.ceil(chineseChars / 2) + Math.ceil(otherChars / 4);
}

/**
 * 从单条消息中估算 token 数量
 * 支持文本和 content block 格式
 * 返回对象: { total, systemReminder, withoutSystemReminder }
 */
export function estimateTokensFromMessage(message) {
  if (!message) return { total: 0, systemReminder: 0, withoutSystemReminder: 0 };

  const total = _estimateTokensFromMessageInternal(message);
  const systemReminder = extractSystemReminderTokens(message);

  return {
    total,
    systemReminder,
    withoutSystemReminder: total - systemReminder,
  };
}

/**
 * 内部函数：从单条消息中估算 token 数量（不含细分）
 * 支持文本和 content block 格式
 */
function _estimateTokensFromMessageInternal(message) {
  if (!message) return 0;

  // 处理 content block 格式
  if (message.content) {
    if (typeof message.content === 'string') {
      return estimateTokensFromText(message.content);
    }

    if (Array.isArray(message.content)) {
      return message.content.reduce((total, block) => {
        if (block.type === 'text' && block.text) {
          return total + estimateTokensFromText(block.text);
        }
        // tool_use 类型的 block
        if (block.type === 'tool_use') {
          let tokens = estimateTokensFromText(block.name || '');
          if (block.input) {
            // tool input 可能包含复杂对象，转换为 JSON 字符串估算
            tokens += estimateTokensFromText(JSON.stringify(block.input));
          }
          return tokens;
        }
        // tool_result 类型的 block
        if (block.type === 'tool_result') {
          let content = '';
          if (typeof block.content === 'string') {
            content = block.content;
          } else if (Array.isArray(block.content)) {
            content = block.content.map(c => c.type === 'text' ? c.text : '').join('');
          }
          return total + estimateTokensFromText(content);
        }
        return total;
      }, 0);
    }
  }

  // 处理简单的 text 字段
  if (message.text) {
    return estimateTokensFromText(message.text);
  }

  return 0;
}

/**
 * 从请求体中提取 system 提示词的 token 数量
 * 检查 system 字段和 messages 数组中的 role=system
 */
export function extractSystemTokens(requestBody) {
  if (!requestBody) return 0;

  let tokens = 0;

  // 检查 system 字段
  if (requestBody.system) {
    if (typeof requestBody.system === 'string') {
      tokens += estimateTokensFromText(requestBody.system);
    } else if (Array.isArray(requestBody.system)) {
      // system 可能是 content blocks 数组
      tokens += requestBody.system.reduce((total, block) => {
        if (block.type === 'text' && block.text) {
          return total + estimateTokensFromText(block.text);
        }
        return total;
      }, 0);
    }
  }

  // 检查 messages 数组中的 role=system
  if (requestBody.messages && Array.isArray(requestBody.messages)) {
    for (const message of requestBody.messages) {
      if (message.role === 'system') {
        tokens += estimateTokensFromMessage(message);
      }
    }
  }

  return tokens;
}

/**
 * 从请求体中提取 tools 定义的字节数/token 数量
 * Tools 定义包含工具名称、描述和参数 schema
 */
export function extractToolsReminderTokens(requestBody) {
  if (!requestBody?.tools || !Array.isArray(requestBody.tools)) return 0;

  // 将 tools 数组转换为 JSON 字符串进行估算
  const toolsJson = JSON.stringify(requestBody.tools);
  return estimateTokensFromText(toolsJson);
}

/**
 * 标准化角色名称
 * tool_use 和 tool_result 统一归为 tool
 */
export function normalizeRole(role, content) {
  if (!role) return 'unknown';

  // 检查 content block 类型
  if (content && Array.isArray(content)) {
    for (const block of content) {
      if (block.type === 'tool_use') return 'tool';
      if (block.type === 'tool_result') return 'tool';
    }
  }

  // 标准化角色名
  const normalized = role.toLowerCase();
  if (['user', 'assistant', 'system'].includes(normalized)) {
    return normalized;
  }

  return 'unknown';
}

/**
 * 从响应体中提取准确的 token 数据
 * 解析 SSE 响应中的 message_delta.usage 字段
 */
export function extractAccurateTokens(responseBody) {
  if (!responseBody) return null;

  // 检查直接的 usage 字段
  if (responseBody.usage) {
    return {
      inputTokens: responseBody.usage.input_tokens || 0,
      outputTokens: responseBody.usage.output_tokens || 0,
    };
  }

  // 检查 message_delta 事件中的 usage
  if (responseBody.message_delta && responseBody.message_delta.usage) {
    return {
      inputTokens: responseBody.message_delta.usage.input_tokens || 0,
      outputTokens: responseBody.message_delta.usage.output_tokens || 0,
    };
  }

  // 检查 Anthropic 格式的响应
  if (responseBody.type === 'message_delta' && responseBody.usage) {
    return {
      inputTokens: responseBody.usage.input_tokens || 0,
      outputTokens: responseBody.usage.output_tokens || 0,
    };
  }

  return null;
}

/**
 * 分析单条日志条目的 token 使用情况
 * 按角色分组：user, assistant, system, tool, systemReminder
 */
export function analyzeEntryTokens(entry) {
  const result = {
    messageIndex: entry.messageIndex || 0,
    user: 0,
    assistant: 0,
    system: 0,
    systemReminder: 0,
    tool: 0,
    toolsReminder: 0,
    total: 0,
    timestamp: entry.timestamp || null,
    hasAccurateData: false,
  };

  const requestBody = entry.requestBody;
  const responseBody = entry.responseBody;

  // 1. 尝试从响应中提取准确的 token 数据
  const accurateTokens = extractAccurateTokens(responseBody);
  if (accurateTokens) {
    result.hasAccurateData = true;
    // 准确数据通常只区分 input/output，需要根据消息角色分配
    // 这里我们使用估算来细分角色，但用准确数据校准总量
    result.total = accurateTokens.inputTokens + accurateTokens.outputTokens;
  }

  // 2. 提取 system tokens
  result.system = extractSystemTokens(requestBody);

  // 2.5. 提取 tools 定义 tokens
  result.toolsReminder = extractToolsReminderTokens(requestBody);

  // 3. 分析 messages 数组中的 token 使用
  if (requestBody?.messages && Array.isArray(requestBody.messages)) {
    for (const message of requestBody.messages) {
      const role = normalizeRole(message.role, message.content);

      // system 已经在 extractSystemTokens 中处理过
      if (role === 'system') continue;

      // 获取 token 细分信息
      const tokenInfo = estimateTokensFromMessage(message);

      if (role === 'user') {
        result.user += tokenInfo.withoutSystemReminder;
        result.systemReminder += tokenInfo.systemReminder;
      } else if (role === 'assistant' || role === 'tool') {
        result[role] += tokenInfo.total;
      }
    }
  }

  // 4. 分析响应中的 assistant tokens (content blocks)
  if (responseBody?.content && Array.isArray(responseBody.content)) {
    for (const block of responseBody.content) {
      if (block.type === 'text') {
        result.assistant += estimateTokensFromText(block.text);
      } else if (block.type === 'tool_use') {
        result.tool += estimateTokensFromText(block.name || '');
        if (block.input) {
          result.tool += estimateTokensFromText(JSON.stringify(block.input));
        }
      }
    }
  }

  // 5. 更新总量计算
  if (!result.hasAccurateData) {
    result.total = result.user + result.assistant + result.system + result.systemReminder + result.tool + result.toolsReminder;
  }

  return result;
}

/**
 * 主函数：分析所有日志条目的 token 使用情况
 * 返回按角色分组的统计数据数组
 */
export function analyzeTokensByRole(entries) {
  if (!entries || !Array.isArray(entries)) {
    return [];
  }

  return entries
    .filter(entry => entry.requestBody)
    .map(analyzeEntryTokens);
}

/**
 * 计算统计摘要
 * 返回总计、平均值、最大/最小值等
 */
export function calculateSummaryStats(tokenData) {
  if (!tokenData || tokenData.length === 0) {
    return {
      totalTokens: 0,
      avgTokens: 0,
      maxTokens: 0,
      minTokens: 0,
      byRole: { user: 0, assistant: 0, system: 0, systemReminder: 0, tool: 0, toolsReminder: 0 },
    };
  }

  const totals = tokenData.reduce(
    (acc, item) => ({
      user: acc.user + item.user,
      assistant: acc.assistant + item.assistant,
      system: acc.system + item.system,
      systemReminder: acc.systemReminder + item.systemReminder,
      tool: acc.tool + item.tool,
      toolsReminder: acc.toolsReminder + item.toolsReminder,
      total: acc.total + item.total,
    }),
    { user: 0, assistant: 0, system: 0, systemReminder: 0, tool: 0, toolsReminder: 0, total: 0 }
  );

  const totalTokens = totals.total;
  const avgTokens = Math.round(totalTokens / tokenData.length);
  const maxTokens = Math.max(...tokenData.map(item => item.total));
  const minTokens = Math.min(...tokenData.map(item => item.total));

  return {
    totalTokens,
    avgTokens,
    maxTokens,
    minTokens,
    byRole: {
      user: totals.user,
      assistant: totals.assistant,
      system: totals.system,
      systemReminder: totals.systemReminder,
      tool: totals.tool,
      toolsReminder: totals.toolsReminder,
    },
  };
}
