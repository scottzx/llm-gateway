-- Chat Logs Database Schema for LLM Gateway
-- This schema supports high-performance logging with automatic cleanup

-- Performance optimization settings
PRAGMA journal_mode = WAL;           -- Write-Ahead Logging for better concurrency
PRAGMA synchronous = NORMAL;          -- Balance between safety and performance
PRAGMA cache_size = -64000;           -- 64MB cache for better performance
PRAGMA temp_store = MEMORY;           -- Use memory for temporary tables
PRAGMA mmap_size = 30000000000;       -- Use memory-mapped I/O (30GB)
PRAGMA page_size = 4096;              -- Optimal page size for most systems

-- Main chat logs table
CREATE TABLE IF NOT EXISTS chat_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,    -- Request timestamp
  path TEXT,                                       -- Request path
  method TEXT,                                     -- HTTP method
  request_body TEXT,                               -- Request body (JSON string)
  request_query TEXT,                              -- Query parameters (JSON string)
  request_headers TEXT,                            -- Request headers (JSON string)
  response_status INTEGER,                         -- HTTP response status
  response_body TEXT,                              -- Response body (JSON string)
  response_headers TEXT,                           -- Response headers (JSON string)
  duration INTEGER,                                -- Request duration in milliseconds
  error_message TEXT,                              -- Error message if any
  model TEXT,                                      -- Model name extracted from request
  prompt_tokens INTEGER DEFAULT 0,                 -- Input token count
  completion_tokens INTEGER DEFAULT 0,             -- Output token count
  total_tokens INTEGER DEFAULT 0                   -- Total token count
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_timestamp ON chat_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_model ON chat_logs(model);
CREATE INDEX IF NOT EXISTS idx_status ON chat_logs(response_status);
CREATE INDEX IF NOT EXISTS idx_duration ON chat_logs(duration);
CREATE INDEX IF NOT EXISTS idx_model_timestamp ON chat_logs(model, timestamp DESC);

-- Composite index for time-series queries
CREATE INDEX IF NOT EXISTS idx_time_model ON chat_logs(timestamp, model);
