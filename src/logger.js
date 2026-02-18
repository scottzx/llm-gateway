const fs = require('fs').promises;
const path = require('path');

/**
 * Chat Logger - 记录所有通过 Gateway 的请求和响应
 * 使用 JSON Lines 格式，按小时分割日志文件
 */
class ChatLogger {
  constructor(logDir) {
    this.logDir = logDir;
    this.currentLogFile = null;
    this.currentHour = null;
  }

  /**
   * 获取当前小时的日志文件路径
   * 格式: chat-YYYY-MM-DD-HH.jsonl
   */
  getLogFilePath() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');

    return path.join(this.logDir, `chat-${year}-${month}-${date}-${hour}.jsonl`);
  }

  /**
   * 异步写入日志
   * @param {Object} entry - 日志条目
   */
  async log(entry) {
    try {
      const logPath = this.getLogFilePath();

      // 确保目录存在
      await fs.mkdir(this.logDir, { recursive: true });

      // 追加写入日志行
      const logLine = JSON.stringify(entry) + '\n';
      await fs.appendFile(logPath, logLine, 'utf8');

      // 更新当前文件信息
      this.currentLogFile = logPath;
      this.currentHour = new Date().getHours();
    } catch (error) {
      console.error('[ChatLogger] 写入日志失败:', error.message);
    }
  }

  /**
   * 检查是否需要切换到新文件（跨小时时）
   */
  shouldRotateFile() {
    const currentHour = new Date().getHours();
    return this.currentHour !== null && this.currentHour !== currentHour;
  }
}

module.exports = ChatLogger;
