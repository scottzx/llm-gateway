const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * 翻译数据库类
 * 提供翻译缓存的存储和查询功能
 */
class TranslationDatabase {
  constructor(dbPath = null) {
    // 确保 data 目录存在
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 使用 data 目录下的 translations.db
    const dbFilePath = dbPath || path.join(process.cwd(), 'data', 'translations.db');
    this.db = new Database(dbFilePath);
    this.initDatabase();
  }

  /**
   * 初始化数据库表结构
   */
  initDatabase() {
    // 创建 translations 表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS translations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_hash TEXT NOT NULL UNIQUE,
        original_text TEXT NOT NULL,
        translated_text TEXT NOT NULL,
        source_type TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        hit_count INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_content_hash ON translations(content_hash);
      CREATE INDEX IF NOT EXISTS idx_source_type ON translations(source_type);
    `);
  }

  /**
   * 生成文本内容的 SHA256 hash
   * @param {string} content - 原文内容
   * @param {string} sourceType - 内容类型 ('text', 'tool_use', 'tool_result', 'image')
   * @returns {string} SHA256 hash
   */
  generateHash(content, sourceType) {
    const combined = `${sourceType}:${content}`;
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * 根据 hash 查找缓存的翻译
   * @param {string} contentHash - 内容 hash
   * @returns {Object|null} 翻译记录或 null
   */
  findTranslationByHash(contentHash) {
    const stmt = this.db.prepare(`
      SELECT id, content_hash, original_text, translated_text, source_type, created_at, updated_at, hit_count
      FROM translations
      WHERE content_hash = ?
    `);

    const result = stmt.get(contentHash);

    if (result) {
      // 更新命中次数
      const updateStmt = this.db.prepare(`
        UPDATE translations
        SET hit_count = hit_count + 1
        WHERE id = ?
      `);
      updateStmt.run(result.id);
    }

    return result || null;
  }

  /**
   * 保存新的翻译结果
   * @param {Object} params - 翻译参数
   * @param {string} params.contentHash - 内容 hash
   * @param {string} params.originalText - 原文
   * @param {string} params.translatedText - 翻译结果
   * @param {string} params.sourceType - 内容类型
   * @returns {Object} 保存的记录
   */
  saveTranslation({ contentHash, originalText, translatedText, sourceType }) {
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO translations (content_hash, original_text, translated_text, source_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    try {
      const result = stmt.run(contentHash, originalText, translatedText, sourceType, now, now);
      return this.findTranslationByHash(contentHash);
    } catch (error) {
      // 如果是唯一约束冲突，尝试更新
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        const updateStmt = this.db.prepare(`
          UPDATE translations
          SET translated_text = ?, updated_at = ?
          WHERE content_hash = ?
        `);
        updateStmt.run(translatedText, now, contentHash);
        return this.findTranslationByHash(contentHash);
      }
      throw error;
    }
  }

  /**
   * 获取翻译统计信息
   * @returns {Object} 统计数据
   */
  getStats() {
    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM translations');
    const totalResult = totalStmt.get();

    const typeStmt = this.db.prepare(`
      SELECT source_type, COUNT(*) as count
      FROM translations
      GROUP BY source_type
    `);
    const byType = typeStmt.all();

    const hitStmt = this.db.prepare(`
      SELECT SUM(hit_count) as total_hits
      FROM translations
    `);
    const hitResult = hitStmt.get();

    return {
      total: totalResult.count,
      byType: byType.reduce((acc, row) => {
        acc[row.source_type] = row.count;
        return acc;
      }, {}),
      totalHits: hitResult.total_hits || 0
    };
  }

  /**
   * 关闭数据库连接
   */
  close() {
    this.db.close();
  }
}

// 单例模式
let dbInstance = null;

/**
 * 获取数据库实例
 * @returns {TranslationDatabase}
 */
function getDatabase() {
  if (!dbInstance) {
    dbInstance = new TranslationDatabase();
  }
  return dbInstance;
}

module.exports = { TranslationDatabase, getDatabase };
