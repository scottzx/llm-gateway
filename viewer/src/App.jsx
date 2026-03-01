import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchDBLogs,
  fetchDBTokenStats,
  fetchDBModels,
  fetchDBHealth,
  fetchDBSessionLogs,
  fetchSessionModels,
} from './lib/api';
import { calculateTotalStats } from './lib/tokenAnalyzer';
import ConversationTimeline from './components/ConversationTimeline';
import ContextDetailPanel from './components/ContextDetailPanel';
import TokenStats from './components/TokenStats';
import TokenStatsDialog from './components/TokenStatsDialog';
import LogFilters from './components/LogFilters';
import DatabaseStatus from './components/DatabaseStatus';
import SessionSelector from './components/SessionSelector';
import { FileText, AlertCircle, Loader2, BarChart3, Database, Users } from 'lucide-react';

function App() {
  // 视图模式: 'all' (全部日志) 或 'session' (特定会话)
  const [viewMode, setViewMode] = useState('all');

  // 数据状态
  const [entries, setEntries] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // 会话状态
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  // 过滤器状态
  const [filters, setFilters] = useState({
    model: null,
    status: null,
    startDate: null,
    endDate: null,
  });

  // 分页状态
  const [pagination, setPagination] = useState({
    limit: 100,
    offset: 0,
    total: 0,
    hasMore: true,
  });

  // 可用模型列表
  const [models, setModels] = useState([]);

  // 当前会话的模型列表
  const [sessionModels, setSessionModels] = useState(null);

  // 数据库健康状态
  const [dbHealth, setDbHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [lastHealthRefresh, setLastHealthRefresh] = useState(null);

  // Token 统计数据（来自后端）
  const [tokenStatsFromAPI, setTokenStatsFromAPI] = useState(null);

  // 加载数据库日志
  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await fetchDBLogs({
        limit: pagination.limit,
        offset: pagination.offset,
        ...filters,
      });

      setEntries(result.entries.map((entry, index) => ({ ...entry, index })));
      setPagination((prev) => ({
        ...prev,
        total: result.pagination?.total || result.entries.length,
        hasMore: result.pagination?.hasMore || false,
      }));

      // 选择第一条记录（仅在初始加载时）
      if (pagination.offset === 0 && result.entries.length > 0) {
        setSelectedEntry((prev) => prev || result.entries[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, pagination.offset, filters]);

  // 加载数据库健康状态
  const loadHealth = useCallback(async () => {
    try {
      setHealthLoading(true);
      const health = await fetchDBHealth();
      setDbHealth(health);
      setLastHealthRefresh(new Date());
    } catch (err) {
      console.error('Failed to load database health:', err);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  // 加载模型列表
  const loadModels = useCallback(async () => {
    try {
      const models = await fetchDBModels();
      setModels(models);
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  }, []);

  // 加载会话特定的模型列表
  const loadSessionModels = useCallback(async (sessionId) => {
    try {
      const models = await fetchSessionModels(sessionId);
      setSessionModels(models);
    } catch (err) {
      console.error('Failed to load session models:', err);
      setSessionModels([]);
    }
  }, []);

  // 当切换到会话视图或会话 ID 变化时，获取该会话的模型
  useEffect(() => {
    if (selectedSessionId) {
      loadSessionModels(selectedSessionId);
    } else {
      setSessionModels(null);
    }
  }, [selectedSessionId, loadSessionModels]);

  // 初始加载
  useEffect(() => {
    loadModels();
    loadHealth();
    loadEntries(); // 初始加载数据

    // 定期刷新数据库健康状态（每30秒）
    const interval = setInterval(loadHealth, 30000);
    return () => clearInterval(interval);
  }, []); // 只在挂载时执行一次

  // 当过滤器变化时，重置分页并加载数据
  useEffect(() => {
    setPagination((prev) => ({ ...prev, offset: 0 }));
    loadEntries(); // 过滤器变化时重新加载
  }, [filters.model, filters.status, filters.startDate, filters.endDate]);

  // 当 offset 变化时加载数据（用于分页）
  useEffect(() => {
    if (pagination.offset > 0) {
      loadEntries();
    }
  }, [pagination.offset]);

  // 当在会话视图中且过滤器变化时，重载会话日志
  useEffect(() => {
    if (viewMode === 'session' && selectedSessionId) {
      setPagination((prev) => ({ ...prev, offset: 0 }));
      loadSessionLogs(selectedSessionId);
    }
  }, [filters.model, filters.status, filters.startDate, filters.endDate]);

  // 处理过滤器变化
  const handleFilterChange = useCallback((newFilters) => {
    setFilters(newFilters);
    setSelectedEntry(null);
  }, []);

  // 处理条目选择
  const handleEntrySelect = useCallback((entry) => {
    setSelectedEntry(entry);
  }, []);

  // 处理刷新
  const handleRefresh = useCallback(() => {
    loadEntries();
    loadHealth();
  }, [loadEntries, loadHealth]);

  // 加载更多数据
  const loadMore = useCallback(() => {
    if (!pagination.hasMore || loading) return;
    setPagination((prev) => ({
      ...prev,
      offset: prev.offset + prev.limit,
    }));
  }, [pagination.hasMore, pagination.limit, loading]);

  // 加载会话日志
  const loadSessionLogs = useCallback(async (sessionId) => {
    try {
      setLoading(true);
      setError(null);

      const result = await fetchDBSessionLogs(sessionId, {
        limit: pagination.limit,
        offset: pagination.offset,
        ...filters,  // 传递筛选条件
      });

      setEntries(result.entries.map((entry, index) => ({ ...entry, index })));
      setSelectedSessionId(sessionId);

      // 更新分页信息
      setPagination((prev) => ({
        ...prev,
        total: result.pagination?.total || result.entries.length,
        hasMore: result.pagination?.hasMore || false,
      }));

      // 选择第一条记录
      if (result.entries.length > 0) {
        setSelectedEntry(result.entries[0]);
      } else {
        setSelectedEntry(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, pagination.offset, filters]);

  // 处理会话选择
  const handleSessionSelect = useCallback((sessionId) => {
    // 重置筛选条件
    setFilters({
      model: null,
      status: null,
      startDate: null,
      endDate: null,
    });
    setViewMode('session');
    loadSessionLogs(sessionId);
  }, [loadSessionLogs]);

  // 返回全部日志视图
  const handleBackToAll = useCallback(() => {
    // 重置筛选条件
    setFilters({
      model: null,
      status: null,
      startDate: null,
      endDate: null,
    });
    setViewMode('all');
    setSelectedSessionId(null);
    loadEntries();
  }, [loadEntries]);

  // 显示会话选择器按钮（在 header 中）
  const handleShowSessions = useCallback(() => {
    setViewMode('sessions');
  }, []);

  // 计算总 Token 统计 - 使用前端计算（保留用于单个请求详情）
  const totalStats = useMemo(() => calculateTotalStats(entries), [entries]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Database className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">LLM 对话上下文可视化</h1>
                <p className="text-sm text-muted-foreground">
                  基于 SQLite 数据库的日志查看器 - 支持筛选、分页和实时统计
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2">
              {/* 会话选择按钮 */}
              <button
                onClick={handleShowSessions}
                className="flex items-center gap-2 px-4 py-2 bg-background border rounded-md text-sm hover:bg-muted transition-colors"
                title="查看会话列表"
              >
                <Users className="w-4 h-4" />
                会话
              </button>

              {/* 刷新按钮 */}
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-background border rounded-md text-sm hover:bg-muted transition-colors disabled:opacity-50"
                title="刷新数据"
              >
                <BarChart3 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Session View */}
      {viewMode === 'sessions' && (
        <div className="flex-1 flex overflow-hidden">
          <SessionSelector
            selectedSessionId={selectedSessionId}
            onSessionSelect={handleSessionSelect}
            onBack={handleBackToAll}
          />
        </div>
      )}

      {/* Filter & Timeline View */}
      {viewMode !== 'sessions' && (
        <>
          {/* 过滤器 - 在全部日志和会话视图都显示 */}
          {(viewMode === 'all' || viewMode === 'session') && (
            <LogFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              models={viewMode === 'session' ? (sessionModels || []) : models}
              totalRecords={pagination.total}
              viewMode={viewMode}
            />
          )}

          {/* 会话信息提示 */}
          {viewMode === 'session' && selectedSessionId && (
            <div className="border-b bg-primary/10 px-4 py-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="font-medium">会话视图</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {selectedSessionId.slice(0, 8)}...
                  </span>
                </div>
                <button
                  onClick={handleBackToAll}
                  className="text-xs text-primary hover:underline"
                >
                  返回全部日志
                </button>
              </div>
              {/* 显示当前筛选状态 */}
              {Object.values(filters).some((v) => v !== null) && (
                <div className="text-xs text-muted-foreground">
                  已应用筛选条件，显示该会话中符合条件的结果
                  {pagination.total > 0 && (
                    <span className="ml-1">（共 {pagination.total.toLocaleString()} 条）</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Loading State */}
          {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">加载数据中...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && viewMode !== 'sessions' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">加载失败</h2>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!loading && !error && entries.length > 0 && viewMode !== 'sessions' && (
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧时间轴 */}
          <div className="w-80 border-r bg-card flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <ConversationTimeline
                entries={entries}
                selectedEntry={selectedEntry}
                onEntrySelect={handleEntrySelect}
              />
            </div>

            {/* 加载更多按钮 */}
            {pagination.hasMore && (
              <div className="p-3 border-t bg-card">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="w-full px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {loading ? '加载中...' : `加载更多 (剩余 ${pagination.total - entries.length} 条)`}
                </button>
              </div>
            )}

            {/* 分页信息 */}
            <div className="px-3 py-2 border-t bg-muted/30 text-xs text-center text-muted-foreground">
              显示 {entries.length} / {pagination.total.toLocaleString()} 条记录
            </div>
          </div>

          {/* 右侧详情面板 */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedEntry && (
              <>
                {/* Token 统计栏 */}
                <div className="border-b bg-muted/30 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold">Token 统计</h3>
                    <button
                      onClick={() => setDialogOpen(true)}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted transition-colors"
                    >
                      <BarChart3 className="w-4 h-4" />
                      详细图表
                    </button>
                  </div>
                  <TokenStats
                    currentEntry={selectedEntry}
                    totalStats={totalStats}
                    entriesCount={entries.length}
                  />
                </div>

                {/* 详情内容 */}
                <div className="flex-1 overflow-y-auto">
                  <ContextDetailPanel
                    entry={selectedEntry}
                    entries={entries}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && entries.length === 0 && viewMode !== 'sessions' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">暂无数据</h2>
            <p className="text-muted-foreground">
              {viewMode === 'session'
                ? '该会话中没有日志记录'
                : Object.values(filters).some((v) => v !== null)
                ? '没有符合筛选条件的记录，请尝试调整筛选条件'
                : '数据库中暂无日志记录'}
            </p>
            {viewMode === 'all' && Object.values(filters).some((v) => v !== null) && (
              <button
                onClick={() => handleFilterChange({ model: null, status: null, startDate: null, endDate: null })}
                className="mt-4 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                清除筛选条件
              </button>
            )}
          </div>
        </div>
      )}

      {/* Database Status Footer */}
      {viewMode !== 'sessions' && (
        <DatabaseStatus
          health={dbHealth}
          loading={healthLoading}
          onRefresh={loadHealth}
          lastRefresh={lastHealthRefresh}
        />
      )}
      </>
      )}

      {/* Token 统计弹窗 */}
      <TokenStatsDialog
        totalStats={totalStats}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

export default App;
