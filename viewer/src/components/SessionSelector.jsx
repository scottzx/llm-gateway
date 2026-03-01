import { useState, useEffect, useCallback } from 'react';
import { Users, Clock, MessageSquare, Hash, Loader2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchDBSessions, fetchDBSessionLogs } from '../lib/api';

/**
 * 格式化时间
 */
function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 格式化持续时间
 */
function formatDuration(startTime, endTime) {
  if (!startTime || !endTime) return '';
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end - start;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return '< 1 分钟';
  if (diffMins < 60) return `${diffMins} 分钟`;
  if (diffHours < 24) return `${diffHours} 小时 ${diffMins % 60} 分钟`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} 天 ${diffHours % 24} 小时`;
}

/**
 * 会话卡片组件
 */
function SessionCard({ session, isSelected, onClick }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'bg-primary/10 border-primary' : 'bg-card border-border hover:bg-muted/50'
      }`}
      onClick={() => onClick(session.sessionId)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Hash className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="text-xs font-mono text-muted-foreground truncate">
              {session.sessionId.slice(0, 8)}...
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MessageSquare className="w-3 h-3" />
            <span>{session.messageCount} 条消息</span>
            {session.totalTokens > 0 && (
              <>
                <span>•</span>
                <span>{session.totalTokens.toLocaleString()} tokens</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="p-1 hover:bg-muted rounded"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Time info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Clock className="w-3 h-3" />
        <span>{formatTime(session.startTime)}</span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2 pt-2 border-t text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">持续时间:</span>
            <span>{formatDuration(session.startTime, session.endTime)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">模型:</span>
            <span className="font-mono text-right" style={{maxWidth: '60%'}}>{session.models || session.model || 'N/A'}</span>
          </div>
          {session.totalTokens > 0 && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">输入:</span>
                <span>{session.inputTokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">输出:</span>
                <span>{session.outputTokens.toLocaleString()}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 会话选择器组件
 * 显示会话列表，允许用户选择查看特定会话的日志
 *
 * @param {Object} props
 * @param {string|null} props.selectedSessionId - 选中的会话 ID
 * @param {Function} props.onSessionSelect - 会话选择回调
 * @param {Function} props.onBack - 返回全部日志回调
 */
export default function SessionSelector({ selectedSessionId, onSessionSelect, onBack }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    total: 0,
    hasMore: false,
  });

  // 加载会话列表
  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await fetchDBSessions({
        limit: pagination.limit,
        offset: pagination.offset,
      });

      setSessions(result.sessions);
      setPagination((prev) => ({
        ...prev,
        total: result.pagination?.total || 0,
        hasMore: result.pagination?.hasMore || false,
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, pagination.offset]);

  // 初始加载
  useEffect(() => {
    loadSessions();
  }, []);

  // 加载更多
  const loadMore = useCallback(() => {
    if (!pagination.hasMore || loading) return;
    setPagination((prev) => ({
      ...prev,
      offset: prev.offset + prev.limit,
    }));
  }, [pagination.hasMore, pagination.limit, loading]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b bg-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">会话列表</h2>
            <span className="text-xs text-muted-foreground">
              ({pagination.total.toLocaleString()} 个会话)
            </span>
          </div>
          {onBack && (
            <button
              onClick={onBack}
              className="px-3 py-1.5 text-xs bg-muted hover:bg-muted/70 rounded-md transition-colors"
            >
              返回全部日志
            </button>
          )}
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
            {error}
          </div>
        )}
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && sessions.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            暂无会话数据
          </div>
        ) : (
          <>
            {sessions.map((session) => (
              <SessionCard
                key={session.sessionId}
                session={session}
                isSelected={selectedSessionId === session.sessionId}
                onClick={onSessionSelect}
              />
            ))}

            {pagination.hasMore && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="w-full py-2 text-sm text-primary hover:bg-primary/10 rounded-md transition-colors disabled:opacity-50"
              >
                {loading ? '加载中...' : `加载更多 (剩余 ${pagination.total - sessions.length} 个)`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
