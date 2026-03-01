/**
 * Log Migration Script
 * 将现有的 JSON Lines 日志文件导入到 SQLite 数据库
 *
 * 使用方法:
 *   node scripts/migrate-logs.js
 *
 * 环境变量:
 *   CHAT_LOG_DIR - 日志文件目录 (默认: logs)
 *   DB_LOG_PATH - 数据库文件路径 (默认: ./data/chat-logs.db)
 *   BATCH_SIZE - 批量插入大小 (默认: 1000)
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const DatabaseLogger = require('../src/db-logger');

const CHAT_LOG_DIR = process.env.CHAT_LOG_DIR || 'logs';
const DB_LOG_PATH = process.env.DB_LOG_PATH || './data/chat-logs.db';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 1000;

/**
 * 解析 SSE 响应提取 token 信息
 */
function parseSSEResponse(sseText) {
  const lines = sseText.split('\n');
  let inputTokens = 0;
  let outputTokens = 0;

  for (const line of lines) {
    if (line.startsWith('event: message_delta')) {
      const dataLine = lines[lines.indexOf(line) + 1];
      if (dataLine && dataLine.startsWith('data: ')) {
        try {
          const data = JSON.parse(dataLine.slice(6));
          if (data.usage) {
            inputTokens = data.usage.input_tokens || 0;
            outputTokens = data.usage.output_tokens || 0;
          }
        } catch {}
      }
    }
  }

  return { inputTokens, outputTokens };
}

/**
 * 检测是否为 SSE 响应
 */
function isSSEResponse(responseBody) {
  if (!responseBody) return false;
  if (typeof responseBody !== 'string') return false;
  return responseBody.includes('event:') && responseBody.includes('data:');
}

/**
 * 提取 token 统计信息
 */
function extractTokens(entry) {
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;

  // 优先从响应 body 中提取
  if (entry.responseBody) {
    if (typeof entry.responseBody === 'object') {
      // OpenAI 标准格式
      if (entry.responseBody.usage) {
        promptTokens = entry.responseBody.usage.prompt_tokens || 0;
        completionTokens = entry.responseBody.usage.completion_tokens || 0;
        totalTokens = entry.responseBody.usage.total_tokens || 0;
      }
    } else if (typeof entry.responseBody === 'string' && isSSEResponse(entry.responseBody)) {
      // SSE 格式
      const { inputTokens, outputTokens } = parseSSEResponse(entry.responseBody);
      promptTokens = inputTokens;
      completionTokens = outputTokens;
      totalTokens = inputTokens + outputTokens;
    }
  }

  return { promptTokens, completionTokens, totalTokens };
}

/**
 * 解析单个日志文件
 */
async function parseLogFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.trim().split('\n');
    const entries = [];

    for (const line of lines) {
      if (line.trim()) {
        try {
          const entry = JSON.parse(line);
          entries.push(entry);
        } catch (e) {
          console.warn(`  跳过无效行: ${e.message}`);
        }
      }
    }

    return entries;
  } catch (error) {
    console.error(`读取文件失败 ${filePath}: ${error.message}`);
    return [];
  }
}

/**
 * 获取所有日志文件
 */
async function getLogFiles() {
  const logDirPath = path.join(process.cwd(), CHAT_LOG_DIR);

  try {
    await fs.mkdir(logDirPath, { recursive: true });
    const files = await fs.readdir(logDirPath);
    return files
      .filter(f => f.startsWith('chat-') && f.endsWith('.jsonl'))
      .sort();
  } catch (error) {
    console.error('读取日志目录失败:', error.message);
    return [];
  }
}

/**
 * 迁移主函数
 */
async function migrate() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║              日志迁移工具 - 文件 → SQLite                 ║
╠══════════════════════════════════════════════════════════╣
║  日志目录:    ${CHAT_LOG_DIR.padEnd(44)}║
║  数据库:      ${DB_LOG_PATH.padEnd(44)}║
║  批量大小:    ${BATCH_SIZE}                              ║
╚══════════════════════════════════════════════════════════╝
  `);

  // 初始化数据库日志记录器
  console.log('1. 初始化数据库...');
  const dbLogger = new DatabaseLogger(DB_LOG_PATH, 7);

  // 检查现有数据
  const existingCount = dbLogger.count({});
  console.log(`   数据库中已有 ${existingCount} 条记录`);

  // 获取所有日志文件
  console.log('\n2. 扫描日志文件...');
  const logFiles = await getLogFiles();

  if (logFiles.length === 0) {
    console.log('   未找到日志文件');
    dbLogger.close();
    return;
  }

  console.log(`   找到 ${logFiles.length} 个日志文件:`);
  logFiles.forEach(f => console.log(`     - ${f}`));

  // 统计信息
  let totalEntries = 0;
  let importedEntries = 0;
  let skippedEntries = 0;
  let errorEntries = 0;

  // 处理每个文件
  console.log('\n3. 开始迁移...');

  for (const [index, filename] of logFiles.entries()) {
    console.log(`\n[${index + 1}/${logFiles.length}] 处理: ${filename}`);

    const filePath = path.join(process.cwd(), CHAT_LOG_DIR, filename);
    const entries = await parseLogFile(filePath);

    console.log(`   解析到 ${entries.length} 条记录`);

    if (entries.length === 0) {
      console.log('   跳过空文件');
      continue;
    }

    // 批量导入
    let batchCount = 0;

    for (const entry of entries) {
      try {
        // 检查是否已存在（根据时间戳和路径）
        const existing = dbLogger.query({
          limit: 1,
          startDate: entry.timestamp,
          endDate: entry.timestamp
        });

        const duplicate = existing.find(
          e => e.path === entry.path &&
               e.method === entry.method &&
               Math.abs(e.duration - (entry.duration || 0)) < 10
        );

        if (duplicate) {
          skippedEntries++;
          continue;
        }

        // 提取 token 信息
        const tokens = extractTokens(entry);

        // 插入数据库
        dbLogger.log({
          timestamp: entry.timestamp,
          path: entry.path,
          method: entry.method,
          requestBody: entry.requestBody,
          requestQuery: entry.requestQuery,
          requestHeaders: entry.requestHeaders,
          responseStatus: entry.responseStatus,
          responseBody: entry.responseBody,
          responseHeaders: entry.responseHeaders,
          duration: entry.duration,
          error: entry.error,
          model: entry.requestBody?.model || null,
          promptTokens: tokens.promptTokens,
          completionTokens: tokens.completionTokens,
          totalTokens: tokens.totalTokens
        });

        importedEntries++;
        batchCount++;

        // 每批次输出进度
        if (batchCount % BATCH_SIZE === 0) {
          process.stdout.write(`   已导入: ${importedEntries}/${entries.length} 条\r`);
        }

      } catch (error) {
        console.error(`\n   导入失败: ${error.message}`);
        errorEntries++;
      }

      totalEntries++;
    }

    console.log(`   完成: 导入 ${batchCount} 条, 跳过 ${entries.length - batchCount} 条`);
  }

  // 输出最终统计
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                    迁移完成                              ║
╠══════════════════════════════════════════════════════════╣
║  处理文件数:    ${logFiles.length}                                    ║
║  总记录数:      ${totalEntries}                                    ║
║  成功导入:      ${importedEntries}                                    ║
║  跳过重复:      ${skippedEntries}                                    ║
║  错误记录:      ${errorEntries}                                    ║
╚══════════════════════════════════════════════════════════╝

  `);

  // 显示数据库健康状态
  const health = dbLogger.getHealth();
  console.log('数据库状态:');
  console.log(`  总记录数: ${health.totalRecords}`);
  console.log(`  数据库大小: ${health.dbSize.mb} MB`);
  console.log(`  数据库路径: ${health.dbPath}`);

  // 关闭数据库连接
  dbLogger.close();
  console.log('\n迁移完成！');
}

// 运行迁移
migrate().catch(error => {
  console.error('迁移失败:', error);
  process.exit(1);
});
