const DatabaseLogger = require('./db-logger');

/**
 * Database-based API routes for log querying
 * High-performance SQL-based queries with filtering and pagination
 */

/**
 * Register database-powered log API routes
 * @param {Express} app - Express app instance
 * @param {DatabaseLogger} dbLogger - Database logger instance
 */
function registerDBRoutes(app, dbLogger) {
  if (!dbLogger) {
    console.warn('[API-DB] Database logger not available, skipping DB routes');
    return;
  }

  /**
   * GET /api/logs/db/query
   * Query logs with filters and pagination
   */
  app.get('/api/logs/db/query', (req, res) => {
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
      } = req.query;

      const filters = {
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0,
        startDate,
        endDate,
        model,
        status: status ? parseInt(status) : undefined,
        minDuration: minDuration ? parseInt(minDuration) : undefined,
        maxDuration: maxDuration ? parseInt(maxDuration) : undefined
      };

      // Remove undefined values
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) delete filters[key];
      });

      const entries = dbLogger.query(filters);
      const total = dbLogger.count(filters);

      res.json({
        entries,
        pagination: {
          total,
          limit: filters.limit,
          offset: filters.offset,
          hasMore: (filters.offset + entries.length) < total
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/logs/db/stats/tokens
   * Get token statistics grouped by model
   */
  app.get('/api/logs/db/stats/tokens', (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const stats = dbLogger.getTokenStats({
        startDate,
        endDate
      });

      res.json({ stats });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/logs/db/stats/hourly
   * Get hourly token statistics for time-series charts
   */
  app.get('/api/logs/db/stats/hourly', (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const stats = dbLogger.getHourlyTokenStats({
        startDate,
        endDate
      });

      res.json({ stats });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/logs/db/health
   * Get database health status
   */
  app.get('/api/logs/db/health', (req, res) => {
    try {
      const health = dbLogger.getHealth();
      res.json(health);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/logs/db/models
   * Get list of unique models
   */
  app.get('/api/logs/db/models', (req, res) => {
    try {
      const models = dbLogger.getModels();
      res.json({ models });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/logs/db/sessions
   * Get list of sessions with summary information
   */
  app.get('/api/logs/db/sessions', (req, res) => {
    try {
      const {
        limit = 50,
        offset = 0,
        startDate,
        endDate,
        model
      } = req.query;

      const result = dbLogger.getSessions({
        limit: parseInt(limit) || 50,
        offset: parseInt(offset) || 0,
        startDate,
        endDate,
        model
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/logs/db/sessions/:sessionId/logs
   * Get logs for a specific session
   */
  app.get('/api/logs/db/sessions/:sessionId/logs', (req, res) => {
    try {
      const { sessionId } = req.params;
      const {
        limit = 100,
        offset = 0,
        startDate,
        endDate,
        model,
        status,
        minDuration,
        maxDuration
      } = req.query;

      const result = dbLogger.getSessionLogs(sessionId, {
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0,
        startDate,
        endDate,
        model,
        status: status ? parseInt(status) : undefined,
        minDuration: minDuration ? parseInt(minDuration) : undefined,
        maxDuration: maxDuration ? parseInt(maxDuration) : undefined
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * GET /api/logs/db/:id
   * Get a single log entry by ID
   */
  app.get('/api/logs/db/:id', (req, res) => {
    try {
      const { id } = req.params;
      const entryId = parseInt(id, 10);

      if (isNaN(entryId)) {
        return res.status(400).json({ error: 'Invalid ID' });
      }

      const filters = { limit: 1, offset: 0 };
      const entries = dbLogger.query(filters);

      // Find the entry with matching ID
      const entry = entries.find(e => e.id === entryId);

      if (!entry) {
        return res.status(404).json({ error: 'Entry not found' });
      }

      res.json({ entry });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  console.log('[API-DB] Database-powered log API routes registered');
}

module.exports = { registerDBRoutes };
