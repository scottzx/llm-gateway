/**
 * 修复数据库中旧日志的token数据
 * 从responseBody中重新提取usage信息并更新数据库
 */

const Database = require('better-sqlite3');
const { extractUsageFromResponse } = require('../src/utils');

const DB_PATH = process.env.DB_PATH || '/Users/scott/Documents/llm_gateway/data/chat-logs.db';

function fixTokens() {
  const db = new Database(DB_PATH);

  // 开启事务
  const updateStmt = db.prepare(`
    UPDATE chat_logs
    SET prompt_tokens = ?,
        completion_tokens = ?,
        total_tokens = ?
    WHERE id = ?
  `);

  // 获取所有token为0的记录
  const rows = db.prepare(`
    SELECT id, response_body
    FROM chat_logs
    WHERE prompt_tokens = 0 AND completion_tokens = 0
  `).all();

  console.log(`找到 ${rows.length} 条需要修复的记录`);

  let fixedCount = 0;
  let skippedCount = 0;

  const updateMany = db.transaction((records) => {
    for (const row of records) {
      const usage = extractUsageFromResponse(row.response_body);

      if (usage && (usage.prompt_tokens > 0 || usage.completion_tokens > 0)) {
        updateStmt.run(
          usage.prompt_tokens,
          usage.completion_tokens,
          usage.total_tokens,
          row.id
        );
        fixedCount++;
        console.log(`✓ ID ${row.id}: ${usage.prompt_tokens} + ${usage.completion_tokens} = ${usage.total_tokens}`);
      } else {
        skippedCount++;
      }
    }
  });

  updateMany(rows);

  console.log(`\n修复完成:`);
  console.log(`  - 成功修复: ${fixedCount} 条`);
  console.log(`  - 跳过（无usage数据）: ${skippedCount} 条`);

  db.close();
}

// 执行修复
try {
  fixTokens();
  console.log('\n✓ Token数据修复成功！');
} catch (error) {
  console.error('✗ 修复失败:', error.message);
  process.exit(1);
}
