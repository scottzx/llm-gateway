const axios = require('axios');
const { getDatabase } = require('./database');

/**
 * 支持的 content block 类型
 */
const VALID_TYPES = ['text', 'tool_use', 'tool_result', 'image'];

/**
 * 翻译服务类
 * 提供翻译功能，使用 ModelScope API
 */
class TranslationService {
  constructor() {
    this.db = getDatabase();
    this.timeout = parseInt(process.env.TRANSLATION_TIMEOUT) || 30000; // 30秒超时
    this.apiEndpoint = process.env.MODELSCOPE_API_ENDPOINT || 'https://api-inference.modelscope.cn/v1/chat/completions';
    this.model = process.env.TRANSLATION_MODEL || 'Qwen/Qwen2.5-72B-Instruct';
    this.apiToken = process.env.TRANSLATION_API_TOKEN;
  }

  /**
   * 从 content block 中提取可翻译的文本
   * @param {Object} block - Content block 对象
   * @returns {string} 提取的文本
   */
  extractTextFromBlock(block) {
    if (!block || typeof block !== 'object') {
      throw new Error('Invalid block: block must be an object');
    }

    const type = block.type;

    if (!type || !VALID_TYPES.includes(type)) {
      throw new Error(`Invalid block type: ${type || 'undefined'}`);
    }

    switch (type) {
      case 'text':
        return block.text || '';

      case 'tool_use':
        // 对于 tool_use，提取 name 和 input 信息
        const name = block.name || '';
        const input = block.input ? JSON.stringify(block.input, null, 2) : '';
        return `工具调用: ${name}\n参数:\n${input}`;

      case 'tool_result':
        // 对于 tool_result，提取 tool_use_id 和 content
        const toolId = block.tool_use_id || '';
        const content = typeof block.content === 'string'
          ? block.content
          : JSON.stringify(block.content, null, 2);
        return `工具结果 (ID: ${toolId}):\n${content}`;

      case 'image':
        // 对于 image，提取类型信息
        const imgType = block.source?.type || 'unknown';
        return `[图片内容 - 类型: ${imgType}]`;

      default:
        return '';
    }
  }

  /**
   * 调用 ModelScope API 执行翻译
   * @param {string} text - 待翻译的文本
   * @returns {Promise<string>} 翻译结果
   */
  async translateWithAPI(text) {
    // 构建翻译 prompt
    const translatePrompt = `Please translate the following text into Chinese. If the text is already in Chinese, return it as is. Only return the translated text, no explanation:\n\n${text}`;

    try {
      const response = await axios({
        method: 'POST',
        url: this.apiEndpoint,
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: translatePrompt }]
            }
          ],
          max_tokens: 4096,
          temperature: 0.3,
          stream: false
        },
        timeout: this.timeout
      });

      // ModelScope API 响应格式：response.data.choices[0].message.content
      if (response.data && response.data.choices && response.data.choices[0]) {
        const translatedText = response.data.choices[0].message.content;
        if (translatedText && translatedText.trim().length > 0) {
          return translatedText.trim();
        } else {
          throw new Error('Empty translation result');
        }
      } else {
        throw new Error('Invalid API response format');
      }
    } catch (error) {
      // 更详细的错误处理和日志
      console.error('[Translation API Error]', {
        endpoint: this.apiEndpoint,
        model: this.model,
        timeout: this.timeout,
        error: error.message,
        stack: error.stack
      });

      if (error.response) {
        // API 返回了错误响应
        const status = error.response.status;
        const data = error.response.data;
        console.error('[Translation API Response Error]', {
          status,
          data: JSON.stringify(data)
        });
        throw new Error(`API error ${status}: ${JSON.stringify(data)}`);
      } else if (error.request) {
        // 请求已发出但没有收到响应
        console.error('[Translation API Network Error]', {
          message: error.message,
          code: error.code
        });
        throw new Error(`API request timeout or network error: ${error.message}`);
      } else {
        // 其他错误
        throw new Error(`Translation failed: ${error.message}`);
      }
    }
  }

  /**
   * 翻译 content block（主方法）
   * 1. 检查缓存
   * 2. 如果无缓存，执行翻译
   * 3. 保存到数据库
   * @param {Object} block - Content block 对象
   * @returns {Promise<Object>} 翻译结果
   */
  async translateBlock(block) {
    // 验证输入
    if (!block || typeof block !== 'object') {
      throw new Error('Invalid block: block must be an object');
    }

    const type = block.type;
    if (!VALID_TYPES.includes(type)) {
      throw new Error(`Invalid block type: ${type}`);
    }

    // 提取文本
    const text = this.extractTextFromBlock(block);
    if (!text || text.trim().length === 0) {
      throw new Error('No translatable content found');
    }

    // 生成 hash
    const contentHash = this.db.generateHash(text, type);

    // 检查缓存
    const cached = this.db.findTranslationByHash(contentHash);
    if (cached) {
      return {
        success: true,
        translatedText: cached.translated_text,
        fromCache: true,
        sourceType: type,
        hitCount: cached.hit_count
      };
    }

    // 执行翻译
    try {
      console.log('[Translation] Starting translation', {
        type,
        textLength: text.length,
        contentHash
      });

      const translatedText = await this.translateWithAPI(text);

      // 保存到数据库
      this.db.saveTranslation({
        contentHash,
        originalText: text,
        translatedText,
        sourceType: type
      });

      console.log('[Translation] Translation completed successfully', {
        type,
        contentHash
      });

      return {
        success: true,
        translatedText,
        fromCache: false,
        sourceType: type
      };
    } catch (error) {
      console.error('[Translation] Translation failed', {
        type,
        contentHash,
        error: error.message,
        stack: error.stack
      });
      return {
        success: false,
        error: error.message,
        sourceType: type
      };
    }
  }

  /**
   * 仅检查缓存，不执行翻译
   * @param {Object} block - Content block 对象
   * @returns {Object|null} 缓存的翻译或 null
   */
  checkCache(block) {
    if (!block || typeof block !== 'object') {
      return null;
    }

    const type = block.type;
    if (!VALID_TYPES.includes(type)) {
      return null;
    }

    try {
      const text = this.extractTextFromBlock(block);
      if (!text || text.trim().length === 0) {
        return null;
      }

      const contentHash = this.db.generateHash(text, type);
      const cached = this.db.findTranslationByHash(contentHash);

      if (cached) {
        return {
          hasCache: true,
          translatedText: cached.translated_text,
          sourceType: type,
          hitCount: cached.hit_count
        };
      }

      return { hasCache: false };
    } catch (error) {
      return { hasCache: false, error: error.message };
    }
  }
}

// 单例模式
let serviceInstance = null;

/**
 * 获取翻译服务实例
 * @returns {TranslationService}
 */
function getTranslationService() {
  if (!serviceInstance) {
    serviceInstance = new TranslationService();
  }
  return serviceInstance;
}

module.exports = { TranslationService, getTranslationService, VALID_TYPES };
