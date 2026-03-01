const Database = require('better-sqlite3');
const fs = require('fs').promises;
const path = require('path');
const { parseUserId, extractMessageIdFromSSE } = require('./utils');

/**
 * DatabaseLogger - SQLite-based chat logger with automatic cleanup
 * High-performance logging with SQL query capabilities
 */
class DatabaseLogger {
  constructor(dbPath, retentionDays = 7) {
    this.dbPath = dbPath;
    this.retentionDays = retentionDays;
    this.db = null;
    this.cleanupTimer = null;
    this.lastCleanupTime = null;

    this.init();
  }

  /**
   * Initialize database connection and schema
   */
  init() {
    try {
      // Ensure data directory exists
      const dir = path.dirname(this.dbPath);
      fs.mkdir(dir, { recursive: true }).catch(() => {});

      // Open database connection
      this.db = new Database(this.dbPath);

      // Enable WAL mode for better concurrency
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = -64000'); // 64MB cache
      this.db.pragma('temp_store = MEMORY');

      console.log(`[DatabaseLogger] Database initialized: ${this.dbPath}`);

      // Initialize schema
      this.initSchema();

      // Prepare statements for better performance
      this.prepareStatements();

      // Start automatic cleanup task
      this.startCleanupTask();

    } catch (error) {
      console.error('[DatabaseLogger] Initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Initialize database schema from SQL file
   */
  initSchema() {
    try {
      const schemaPath = path.join(__dirname, 'db-schema.sql');
      const schema = require('fs').readFileSync(schemaPath, 'utf8');

      // Execute each statement separately
      const statements = schema.split(';').filter(s => s.trim());
      for (const statement of statements) {
        this.db.exec(statement);
      }

      console.log('[DatabaseLogger] Schema initialized successfully');
    } catch (error) {
      console.error('[DatabaseLogger] Schema initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Prepare frequently used statements for better performance
   */
  prepareStatements() {
    // Insert statement
    this.insertStmt = this.db.prepare(`
      INSERT INTO chat_logs (
        timestamp, path, method, request_body, request_query, request_headers,
        response_status, response_body, response_headers, duration, error_message,
        model, prompt_tokens, completion_tokens, total_tokens,
        message_id, user_id, session_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }

  /**
   * Log a chat request/response (synchronous for better performance)
   * @param {Object} entry - Log entry
   */
  log(entry) {
    try {
      // Extract model from request body
      const model = entry.requestBody?.model || null;

      // Extract token usage from response
      let promptTokens = 0;
      let completionTokens = 0;
      let totalTokens = 0;

      if (entry.responseBody?.usage) {
        // Standard OpenAI format
        promptTokens = entry.responseBody.usage.prompt_tokens || 0;
        completionTokens = entry.responseBody.usage.completion_tokens || 0;
        totalTokens = entry.responseBody.usage.total_tokens || 0;
      }

      // Extract user_id and session_id from metadata
      let userId = null;
      let sessionId = null;

      if (entry.requestBody?.metadata?.user_id) {
        const parsed = parseUserId(entry.requestBody.metadata.user_id);
        userId = parsed.user_id;
        sessionId = parsed.session_id;
      }

      // Extract message_id from response
      const messageId = extractMessageIdFromSSE(entry.responseBody);

      // Insert into database
      const info = this.insertStmt.run(
        entry.timestamp || new Date().toISOString(),
        entry.path,
        entry.method,
        JSON.stringify(entry.requestBody || {}),
        JSON.stringify(entry.requestQuery || {}),
        JSON.stringify(entry.requestHeaders || {}),
        entry.responseStatus || null,
        JSON.stringify(entry.responseBody || {}),
        JSON.stringify(entry.responseHeaders || {}),
        entry.duration || null,
        entry.error || null,
        model,
        promptTokens,
        completionTokens,
        totalTokens,
        messageId,
        userId,
        sessionId
      );

      return info.lastInsertRowid;
    } catch (error) {
      console.error('[DatabaseLogger] Log entry failed:', error.message);
      return null;
    }
  }

  /**
   * Query logs with optional filters
   * @param {Object} filters - Query filters
   * @returns {Array} - Array of log entries
   */
  query(filters = {}) {
    try {
      const {
        limit = 100,
        offset = 0,
        startDate,
        endDate,
        model,
        status,
        minDuration,
        maxDuration
      } = filters;

      let query = 'SELECT * FROM chat_logs WHERE 1=1';
      const params = [];

      // Date range filter
      if (startDate) {
        query += ' AND timestamp >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND timestamp <= ?';
        params.push(endDate);
      }

      // Model filter
      if (model) {
        query += ' AND model = ?';
        params.push(model);
      }

      // Status filter
      if (status) {
        query += ' AND response_status = ?';
        params.push(status);
      }

      // Duration filters
      if (minDuration) {
        query += ' AND duration >= ?';
        params.push(minDuration);
      }
      if (maxDuration) {
        query += ' AND duration <= ?';
        params.push(maxDuration);
      }

      // Order by timestamp desc (newest first)
      query += ' ORDER BY timestamp DESC';

      // Pagination
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params);

      // Parse JSON fields
      return rows.map(row => this.parseRow(row));
    } catch (error) {
      console.error('[DatabaseLogger] Query failed:', error.message);
      return [];
    }
  }

  /**
   * Get log count with filters
   */
  count(filters = {}) {
    try {
      const {
        startDate,
        endDate,
        model,
        status
      } = filters;

      let query = 'SELECT COUNT(*) as count FROM chat_logs WHERE 1=1';
      const params = [];

      if (startDate) {
        query += ' AND timestamp >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND timestamp <= ?';
        params.push(endDate);
      }
      if (model) {
        query += ' AND model = ?';
        params.push(model);
      }
      if (status) {
        query += ' AND response_status = ?';
        params.push(status);
      }

      const stmt = this.db.prepare(query);
      const result = stmt.get(...params);
      return result.count;
    } catch (error) {
      console.error('[DatabaseLogger] Count failed:', error.message);
      return 0;
    }
  }

  /**
   * Get token statistics grouped by model
   * @param {Object} filters - Time range filters
   * @returns {Array} - Token stats by model
   */
  getTokenStats(filters = {}) {
    try {
      const { startDate, endDate } = filters;

      let query = `
        SELECT
          model,
          SUM(prompt_tokens) as prompt_tokens,
          SUM(completion_tokens) as completion_tokens,
          SUM(total_tokens) as total_tokens,
          COUNT(*) as request_count,
          AVG(duration) as avg_duration
        FROM chat_logs
        WHERE 1=1
      `;

      const params = [];

      if (startDate) {
        query += ' AND timestamp >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND timestamp <= ?';
        params.push(endDate);
      }

      query += ' GROUP BY model ORDER BY total_tokens DESC';

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params);

      return rows.map(row => ({
        model: row.model || 'unknown',
        promptTokens: row.prompt_tokens || 0,
        completionTokens: row.completion_tokens || 0,
        totalTokens: row.total_tokens || 0,
        requestCount: row.request_count || 0,
        avgDuration: Math.round(row.avg_duration || 0)
      }));
    } catch (error) {
      console.error('[DatabaseLogger] Token stats failed:', error.message);
      return [];
    }
  }

  /**
   * Get token statistics by role (from response body)
   * @param {Object} filters - Time range filters
   * @returns {Array} - Token stats by role
   */
  getTokenStatsByRole(filters = {}) {
    try {
      const { startDate, endDate } = filters;

      // For detailed role stats, we need to parse response bodies
      // This is a simplified version that extracts role info if available
      let query = `
        SELECT
          model,
          SUM(total_tokens) as total_tokens,
          COUNT(*) as request_count
        FROM chat_logs
        WHERE total_tokens > 0
      `;

      const params = [];

      if (startDate) {
        query += ' AND timestamp >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND timestamp <= ?';
        params.push(endDate);
      }

      query += ' GROUP BY model ORDER BY total_tokens DESC';

      const stmt = this.db.prepare(query);
      return stmt.all(...params);
    } catch (error) {
      console.error('[DatabaseLogger] Token stats by role failed:', error.message);
      return [];
    }
  }

  /**
   * Get hourly token statistics for time-series charts
   * @param {Object} filters - Time range filters
   * @returns {Array} - Hourly token stats
   */
  getHourlyTokenStats(filters = {}) {
    try {
      const { startDate, endDate } = filters;

      let query = `
        SELECT
          strftime('%Y-%m-%d %H:00:00', timestamp) as hour,
          SUM(prompt_tokens) as prompt_tokens,
          SUM(completion_tokens) as completion_tokens,
          SUM(total_tokens) as total_tokens,
          COUNT(*) as request_count
        FROM chat_logs
        WHERE 1=1
      `;

      const params = [];

      if (startDate) {
        query += ' AND timestamp >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND timestamp <= ?';
        params.push(endDate);
      }

      query += ' GROUP BY hour ORDER BY hour ASC';

      const stmt = this.db.prepare(query);
      return stmt.all(...params);
    } catch (error) {
      console.error('[DatabaseLogger] Hourly stats failed:', error.message);
      return [];
    }
  }

  /**
   * Cleanup old logs (older than retention days)
   */
  cleanupOldLogs() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      const cutoffDateStr = cutoffDate.toISOString();

      // Get count before deletion
      const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM chat_logs WHERE timestamp < ?');
      const { count: deletedCount } = countStmt.get(cutoffDateStr);

      if (deletedCount > 0) {
        // Delete old logs
        const deleteStmt = this.db.prepare('DELETE FROM chat_logs WHERE timestamp < ?');
        const info = deleteStmt.run(cutoffDateStr);

        // Vacuum to reclaim space
        this.db.pragma('incremental_vacuum');

        this.lastCleanupTime = new Date().toISOString();
        console.log(`[DatabaseLogger] Cleaned up ${info.changes} old log entries (older than ${this.retentionDays} days)`);
      }

      return { deletedCount: deletedCount || 0 };
    } catch (error) {
      console.error('[DatabaseLogger] Cleanup failed:', error.message);
      return { deletedCount: 0, error: error.message };
    }
  }

  /**
   * Start automatic cleanup task (runs every hour)
   */
  startCleanupTask() {
    const cleanupInterval = 60 * 60 * 1000; // 1 hour

    this.cleanupTimer = setInterval(() => {
      this.cleanupOldLogs();
    }, cleanupInterval);

    console.log(`[DatabaseLogger] Automatic cleanup task started (interval: ${cleanupInterval}ms, retention: ${this.retentionDays} days)`);
  }

  /**
   * Get database health status
   */
  getHealth() {
    try {
      // Get total record count
      const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM chat_logs');
      const { count: totalRecords } = totalStmt.get();

      // Get records within retention period
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      const recentStmt = this.db.prepare('SELECT COUNT(*) as count FROM chat_logs WHERE timestamp >= ?');
      const { count: recentRecords } = recentStmt.get(cutoffDate.toISOString());

      // Get database file size
      const stats = require('fs').statSync(this.dbPath);
      const dbSize = stats.size;

      // Get latest entry time
      const latestStmt = this.db.prepare('SELECT timestamp FROM chat_logs ORDER BY timestamp DESC LIMIT 1');
      const latest = latestStmt.get();

      return {
        status: 'ok',
        totalRecords,
        recentRecords,
        retentionDays: this.retentionDays,
        dbSize: {
          bytes: dbSize,
          mb: Math.round(dbSize / 1024 / 1024 * 100) / 100
        },
        dbPath: this.dbPath,
        lastCleanupTime: this.lastCleanupTime,
        latestEntry: latest?.timestamp || null
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Get unique models list
   */
  getModels() {
    try {
      const stmt = this.db.prepare('SELECT DISTINCT model FROM chat_logs WHERE model IS NOT NULL ORDER BY model');
      const rows = stmt.all();
      return rows.map(r => r.model);
    } catch (error) {
      console.error('[DatabaseLogger] Get models failed:', error.message);
      return [];
    }
  }

  /**
   * Get list of sessions with summary information
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of sessions to return
   * @param {number} options.offset - Offset for pagination
   * @param {string} options.startDate - Filter sessions starting after this date
   * @param {string} options.endDate - Filter sessions ending before this date
   * @param {string} options.model - Filter by model
   */
  getSessions(options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        startDate,
        endDate,
        model
      } = options;

      let whereConditions = ['session_id IS NOT NULL'];
      let params = [];

      if (startDate) {
        whereConditions.push('MIN(timestamp) >= ?');
        params.push(startDate);
      }
      if (endDate) {
        whereConditions.push('MAX(timestamp) <= ?');
        params.push(endDate);
      }
      if (model) {
        whereConditions.push('model = ?');
        params.push(model);
      }

      const whereClause = whereConditions.join(' AND ');

      const query = `
        SELECT
          session_id,
          COUNT(*) as message_count,
          MIN(timestamp) as start_time,
          MAX(timestamp) as end_time,
          SUM(total_tokens) as total_tokens,
          SUM(prompt_tokens) as input_tokens,
          SUM(completion_tokens) as output_tokens,
          model,
          MAX(id) as last_id
        FROM chat_logs
        WHERE ${whereClause}
        GROUP BY session_id, model
        ORDER BY start_time DESC
        LIMIT ? OFFSET ?
      `;

      const stmt = this.db.prepare(query);
      const sessions = stmt.all(...params, limit, offset);

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT session_id) as count
        FROM chat_logs
        WHERE ${whereClause}
      `;
      const countStmt = this.db.prepare(countQuery);
      const { count: total } = countStmt.get(...params);

      return {
        sessions: sessions.map(s => ({
          sessionId: s.session_id,
          messageCount: s.message_count,
          startTime: s.start_time,
          endTime: s.end_time,
          totalTokens: s.total_tokens || 0,
          inputTokens: s.input_tokens || 0,
          outputTokens: s.output_tokens || 0,
          model: s.model,
          lastId: s.last_id
        })),
        pagination: {
          total,
          limit,
          offset,
          hasMore: (offset + sessions.length) < total
        }
      };
    } catch (error) {
      console.error('[DatabaseLogger] Get sessions failed:', error.message);
      return { sessions: [], pagination: { total: 0, limit, offset, hasMore: false } };
    }
  }

  /**
   * Get logs for a specific session
   * @param {string} sessionId - Session ID to query
   * @param {Object} options - Query options
   */
  getSessionLogs(sessionId, options = {}) {
    try {
      const {
        limit = 100,
        offset = 0,
        startDate,
        endDate,
        model,
        status,
        minDuration,
        maxDuration
      } = options;

      // Build query with filters
      let query = 'SELECT * FROM chat_logs WHERE session_id = ?';
      const params = [sessionId];

      // Date range filter
      if (startDate) {
        query += ' AND timestamp >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND timestamp <= ?';
        params.push(endDate);
      }

      // Model filter
      if (model) {
        query += ' AND model = ?';
        params.push(model);
      }

      // Status filter
      if (status) {
        query += ' AND response_status = ?';
        params.push(status);
      }

      // Duration filters
      if (minDuration) {
        query += ' AND duration >= ?';
        params.push(minDuration);
      }
      if (maxDuration) {
        query += ' AND duration <= ?';
        params.push(maxDuration);
      }

      // Order by timestamp asc (oldest first for session view)
      query += ' ORDER BY timestamp ASC';

      // Pagination
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const entries = this.db.prepare(query).all(...params);

      // Get total count for this session with filters
      let countQuery = 'SELECT COUNT(*) as count FROM chat_logs WHERE session_id = ?';
      const countParams = [sessionId];

      if (startDate) {
        countQuery += ' AND timestamp >= ?';
        countParams.push(startDate);
      }
      if (endDate) {
        countQuery += ' AND timestamp <= ?';
        countParams.push(endDate);
      }
      if (model) {
        countQuery += ' AND model = ?';
        countParams.push(model);
      }
      if (status) {
        countQuery += ' AND response_status = ?';
        countParams.push(status);
      }
      if (minDuration) {
        countQuery += ' AND duration >= ?';
        countParams.push(minDuration);
      }
      if (maxDuration) {
        countQuery += ' AND duration <= ?';
        countParams.push(maxDuration);
      }

      const countStmt = this.db.prepare(countQuery);
      const { count: total } = countStmt.get(...countParams);

      return {
        entries: entries.map(row => this.parseRow(row)),
        pagination: {
          total,
          limit,
          offset,
          hasMore: (offset + entries.length) < total
        }
      };
    } catch (error) {
      console.error('[DatabaseLogger] Get session logs failed:', error.message);
      return { entries: [], pagination: { total: 0, limit, offset, hasMore: false } };
    }
  }

  /**
   * Parse database row, converting JSON strings to objects
   */
  parseRow(row) {
    return {
      id: row.id,
      timestamp: row.timestamp,
      path: row.path,
      method: row.method,
      requestBody: this.parseJSON(row.request_body),
      requestQuery: this.parseJSON(row.request_query),
      requestHeaders: this.parseJSON(row.request_headers),
      responseStatus: row.response_status,
      responseBody: this.parseJSON(row.response_body),
      responseHeaders: this.parseJSON(row.response_headers),
      duration: row.duration,
      error: row.error_message,
      model: row.model,
      inputTokens: row.prompt_tokens,
      outputTokens: row.completion_tokens,
      totalTokens: row.total_tokens,
      messageId: row.message_id,
      userId: row.user_id,
      sessionId: row.session_id
    };
  }

  /**
   * Safely parse JSON string
   */
  parseJSON(str) {
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  }

  /**
   * Close database connection gracefully
   */
  close() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[DatabaseLogger] Database connection closed');
    }
  }
}

module.exports = DatabaseLogger;
