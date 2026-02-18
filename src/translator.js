const { spawn } = require('child_process');
const { getDatabase } = require('./database');

/**
 * 支持的 content block 类型
 */
const VALID_TYPES = ['text', 'tool_use', 'tool_result', 'image'];

/**
 * 翻译服务类
 * 提供翻译功能和 CLI 调用
 */
class TranslationService {
  constructor() {
    this.db = getDatabase();
    this.timeout = parseInt(process.env.TRANSLATION_TIMEOUT) || 30000; // 30秒超时
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
   * 调用 claude CLI 执行翻译
   * @param {string} text - 待翻译的文本
   * @returns {Promise<string>} 翻译结果
   */
  translateWithCLI(text) {
    return new Promise((resolve, reject) => {
      // 构建翻译 prompt
      const prompt = `Please translate the following text into Chinese. If the text is already in Chinese, return it as is. Only return the translated text, no explanation:\n\n${text}`;

      const claude = spawn('claude', ['-p', prompt], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      const timeoutId = setTimeout(() => {
        claude.kill();
        reject(new Error('Translation timeout (30s)'));
      }, this.timeout);

      claude.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      claude.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      claude.on('close', (code) => {
        clearTimeout(timeoutId);

        if (code === 0) {
          const result = stdout.trim();
          if (result) {
            resolve(result);
          } else {
            reject(new Error('Empty translation result'));
          }
        } else {
          reject(new Error(`Claude CLI failed with code ${code}: ${stderr}`));
        }
      });

      claude.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to spawn claude CLI: ${error.message}`));
      });
    });
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
      const translatedText = await this.translateWithCLI(text);

      // 保存到数据库
      this.db.saveTranslation({
        contentHash,
        originalText: text,
        translatedText,
        sourceType: type
      });

      return {
        success: true,
        translatedText,
        fromCache: false,
        sourceType: type
      };
    } catch (error) {
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
