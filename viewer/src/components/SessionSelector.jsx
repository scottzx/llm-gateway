import { useState, useEffect, useCallback } from 'react';
import { Users, Clock, MessageSquare, Hash, Loader2, Search, ArrowUpDown, ChevronDown, ChevronUp, Cpu, Activity } from 'lucide-react';
import { fetchDBSessions } from '../lib/api';

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
    second: '2-digit'
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

  if (diffMs < 1000) return '少于 1 秒';
  if (diffMins < 1) {
    const diffSecs = Math.floor(diffMs / 1000);
    return `${diffSecs} 秒`;
  }
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

  // 获取模型简称或代表色
  const getModelColor = (modelName) => {
    if (!modelName) return 'bg-muted text-muted-foreground border-muted';
    const name = modelName.toLowerCase();
    if (name.includes('gpt-4') || name.includes('gpt4')) {
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    }
    if (name.includes('claude-3') || name.includes('claude')) {
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    }
    if (name.includes('qwen')) {
      return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
    }
    if (name.includes('deepseek')) {
      return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
    }
    return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
  };

  return (
    <div
      className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-300 relative group overflow-hidden ${
        isSelected
          ? 'bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20'
          : 'bg-card border-border hover:border-muted-foreground/30 hover:bg-muted/40 hover:shadow-md'
      }`}
      onClick={() => onClick(session.sessionId)}
    >
      {/* Premium left border accent on selection */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r"></div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Hash className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span className={`text-xs truncate ${session.sessionId === 'no-session' ? 'font-medium text-foreground' : 'font-mono font-medium text-muted-foreground'}`} title={session.sessionId}>
              {session.sessionId === 'no-session' ? '常规/未分类代理日志' : session.sessionId}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 bg-muted/60 dark:bg-muted px-2 py-0.5 rounded-md font-medium text-foreground">
              <MessageSquare className="w-3 h-3 text-primary" />
              {session.messageCount} 轮对话
            </span>
            {session.totalTokens > 0 && (
              <span className="flex items-center gap-1 bg-muted/60 dark:bg-muted px-2 py-0.5 rounded-md text-muted-foreground">
                <Activity className="w-3 h-3 text-indigo-500" />
                {session.totalTokens.toLocaleString()} tokens
              </span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="p-1.5 hover:bg-muted rounded-lg transition-colors border border-transparent hover:border-border"
          aria-label="Toggle Details"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
      </div>

      {/* Time info */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="truncate">最后活动: {formatTime(session.endTime || session.startTime)}</span>
      </div>

      {/* Primary Model Badge */}
      {session.model && (
        <div className="mt-2 flex flex-wrap gap-1">
          {session.model.split(',').slice(0, 2).map((m) => (
            <span
              key={m}
              className={`inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border ${getModelColor(m)}`}
            >
              <Cpu className="w-2.5 h-2.5" />
              {m.trim()}
            </span>
          ))}
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-dashed text-xs space-y-1.5 animate-fadeIn">
          <div className="flex justify-between items-center py-0.5">
            <span className="text-muted-foreground">会话开始:</span>
            <span className="font-mono text-muted-foreground">{formatTime(session.startTime)}</span>
          </div>
          <div className="flex justify-between items-center py-0.5">
            <span className="text-muted-foreground">持续时间:</span>
            <span className="font-medium">{formatDuration(session.startTime, session.endTime)}</span>
          </div>
          {session.totalTokens > 0 && (
            <div className="bg-muted/40 dark:bg-muted/20 p-2 rounded-lg mt-2 space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">输入 Tokens:</span>
                <span className="font-mono font-semibold">{session.inputTokens?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">输出 Tokens:</span>
                <span className="font-mono font-semibold text-primary">{session.outputTokens?.toLocaleString() || 0}</span>
              </div>
              <div className="w-full bg-muted dark:bg-muted/50 rounded-full h-1.5 mt-1.5 overflow-hidden flex">
                <div
                  className="bg-muted-foreground/30 h-full"
                  style={{ width: `${(session.inputTokens / session.totalTokens) * 100}%` }}
                  title="输入比例"
                ></div>
                <div
                  className="bg-primary h-full"
                  style={{ width: `${(session.outputTokens / session.totalTokens) * 100}%` }}
                  title="输出比例"
                ></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 会话选择器组件
 * 显示会话列表，允许用户选择查看特定会话的日志
 */
export default function SessionSelector({ selectedSessionId, onSessionSelect, onBack }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 搜索和排序过滤器
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('startTime');
  const [sortOrder, setSortOrder] = useState('DESC');

  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    total: 0,
    hasMore: false,
  });

  // 当筛选和排序改变时，重置偏移量
  useEffect(() => {
    setPagination((prev) => ({ ...prev, offset: 0 }));
  }, [search, sortBy, sortOrder]);

  // 加载会话列表
  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await fetchDBSessions({
        limit: pagination.limit,
        offset: pagination.offset,
        search: search.trim() || undefined,
        sortBy,
        sortOrder
      });

      if (pagination.offset === 0) {
        setSessions(result.sessions);
      } else {
        setSessions((prev) => [...prev, ...result.sessions]);
      }

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
  }, [pagination.limit, pagination.offset, search, sortBy, sortOrder]);

  // 执行加载
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // 加载更多
  const loadMore = useCallback(() => {
    if (!pagination.hasMore || loading) return;
    setPagination((prev) => ({
      ...prev,
      offset: prev.offset + prev.limit,
    }));
  }, [pagination.hasMore, pagination.limit, loading]);

  // 切换升降序
  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'DESC' ? 'ASC' : 'DESC'));
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header & Controls */}
      <div className="p-4 border-b bg-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">会话列表</h2>
            <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded-full">
              {pagination.total}
            </span>
          </div>
          {onBack && (
            <button
              onClick={onBack}
              className="px-2.5 py-1.5 text-xs bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground rounded-lg transition-all border border-border"
            >
              返回全部日志
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索会话 ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-muted-foreground/60"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              清除
            </button>
          )}
        </div>

        {/* Sorting Controls */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>排序方式:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-background border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer"
            >
              <option value="startTime">时间 (最新活动)</option>
              <option value="messageCount">对话轮次</option>
              <option value="totalTokens">Token 使用量</option>
            </select>
          </div>

          <button
            onClick={toggleSortOrder}
            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-background hover:bg-muted border rounded-md transition-colors text-muted-foreground hover:text-foreground"
            title={sortOrder === 'DESC' ? '降序 (高->低 / 新->旧)' : '升序 (低->高 / 旧->新)'}
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium font-mono text-[10px]">
              {sortOrder === 'DESC' ? '降序' : '升序'}
            </span>
          </button>
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20 font-medium">
            {error}
          </div>
        )}
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 scrollbar-thin">
        {loading && sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
            <span className="text-xs">加载会话列表中...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-xl p-4">
            没有找到匹配的会话数据
          </div>
        ) : (
          <div className="space-y-2.5">
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
                className="w-full py-2.5 text-xs text-primary hover:bg-primary/5 hover:text-primary-foreground border border-dashed border-primary/20 rounded-xl transition-all disabled:opacity-50 font-medium flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    加载中...
                  </>
                ) : (
                  `显示更多会话 (余 ${pagination.total - sessions.length} 个)`
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
