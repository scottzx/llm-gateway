import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchDBLogs,
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
import { 
  AlertCircle, 
  Loader2, 
  BarChart3, 
  Database, 
  Users, 
  ArrowLeft, 
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Badge } from './components/ui/badge';

function App() {
  // 视图模式: 'all' (全部日志), 'session' (特定会话的日志), 或 'sessions' (会话列表)
  const [viewMode, setViewMode] = useState('all');

  // 数据状态
  const [entries, setEntries] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // 会话状态
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  // 侧边栏和 Token 统计栏折叠状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [statsCollapsed, setStatsCollapsed] = useState(false);

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
        setSelectedEntry(result.entries[0]);
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
    loadEntries();

    // 定期刷新数据库健康状态（每30秒）
    const interval = setInterval(loadHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // 当过滤器变化时，重置分页并加载数据
  useEffect(() => {
    if (viewMode === 'all') {
      setPagination((prev) => ({ ...prev, offset: 0 }));
      loadEntries();
    }
  }, [filters.model, filters.status, filters.startDate, filters.endDate, viewMode]);

  // 当 offset 变化时加载数据（用于分页）
  useEffect(() => {
    if (pagination.offset > 0) {
      if (viewMode === 'all') {
        loadEntries();
      } else if (viewMode === 'session' && selectedSessionId) {
        loadSessionLogs(selectedSessionId);
      }
    }
  }, [pagination.offset]);

  // 当在会话视图中且过滤器变化时，重载会话日志
  useEffect(() => {
    if (viewMode === 'session' && selectedSessionId) {
      setPagination((prev) => ({ ...prev, offset: 0 }));
      loadSessionLogs(selectedSessionId);
    }
  }, [filters.model, filters.status, filters.startDate, filters.endDate, selectedSessionId]);

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
    loadHealth();
    if (viewMode === 'all') {
      loadEntries();
    } else if (viewMode === 'session' && selectedSessionId) {
      loadSessionLogs(selectedSessionId);
    }
  }, [loadEntries, loadHealth, viewMode, selectedSessionId]);

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
        ...filters,
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
    setPagination((prev) => ({ ...prev, offset: 0 }));
    loadEntries();
  }, [loadEntries]);

  // 计算总 Token 统计
  const totalStats = useMemo(() => calculateTotalStats(entries), [entries]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden text-foreground">
      {/* Premium Header - 大一统融合头部栏 */}
      <header className="border-b bg-card py-3 px-6 shadow-sm flex-shrink-0 z-30">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* 常驻侧栏折叠开关（一键统一控制侧栏伸缩） */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={`p-2 border rounded-xl transition-all shadow-sm flex items-center justify-center bg-background hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 hover:scale-105 active:scale-95 ${
                sidebarCollapsed ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border'
              }`}
              title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4 text-primary animate-pulse" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
            
            <div className="p-2.5 bg-primary/10 rounded-xl shrink-0">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 hidden sm:block">
              <h1 className="text-md font-bold leading-tight truncate">LLM Gateway 日志查看器</h1>
              <p className="text-[11px] text-muted-foreground truncate">
                本地网关日志持久化 & 上下文管理面板
              </p>
            </div>
          </div>

          {/* Header 右侧：完美融合 Request ID 状态、图标详细分析与刷新控制 */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {selectedEntry && (
              <div className="flex items-center gap-3 border-r pr-3 border-border/80 mr-1 min-w-0">
                <div className="text-right hidden md:block min-w-0">
                  <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5 justify-end">
                    实时 Token 消耗
                    {statsCollapsed && (
                      <Badge variant="outline" className="text-[9px] py-0 font-normal text-primary border-primary/30 bg-primary/5 scale-90">
                        已收起
                      </Badge>
                    )}
                  </h3>
                  <span className="text-[10px] text-muted-foreground font-mono truncate block" title={`Request ID: ${selectedEntry.id} • Model: ${selectedEntry.model}`}>
                    ID: {selectedEntry.id} · Model: {selectedEntry.model || 'Unknown'}
                  </span>
                </div>

                {/* 详细分析图表 */}
                <button
                  onClick={() => setDialogOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-background border rounded-lg text-xs font-semibold hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-sm shrink-0"
                  title="查看详细分析图表"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">分析图表</span>
                </button>

                {/* 折叠/展开 Token 统计面板 */}
                <button
                  onClick={() => setStatsCollapsed(!statsCollapsed)}
                  className={`p-1.5 border rounded-lg transition-colors shrink-0 ${
                    statsCollapsed 
                      ? 'bg-background text-muted-foreground border-border hover:bg-muted' 
                      : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
                  }`}
                  title={statsCollapsed ? "展开 Token 数据条" : "收起 Token 数据条"}
                >
                  {statsCollapsed ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronUp className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            )}

            {/* 常驻刷新数据按钮 */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-background border rounded-lg text-xs font-semibold hover:bg-muted transition-colors disabled:opacity-50 shrink-0"
              title="刷新数据"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </div>
        </div>
      </header>

      {/* Main Unified Dashboard Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar Pane (Unified Navigation, Filtering & Timeline) */}
        <div className={`border-r bg-card flex flex-col flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out relative ${
          sidebarCollapsed ? 'w-0 opacity-0 border-r-0' : 'w-[360px] opacity-100'
        }`}>
          {/* Tab Switcher / Session Header */}
          {viewMode === 'session' && selectedSessionId ? (
            <div className="p-3 border-b bg-primary/5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  onClick={() => {
                    setSelectedSessionId(null);
                    setViewMode('sessions');
                  }}
                  className="p-1.5 hover:bg-muted border rounded-lg transition-colors flex-shrink-0"
                  title="返回会话列表"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-primary" />
                </button>
                <div className="min-w-0">
                  <h3 className="font-semibold text-xs text-foreground truncate" title={selectedSessionId}>
                    {selectedSessionId === 'no-session' ? '常规/未分类代理日志' : `会话: ${selectedSessionId.slice(0, 12)}...`}
                  </h3>
                  <span className="text-[10px] text-muted-foreground">会话对话历史</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={handleBackToAll}
                  className="text-[10px] text-primary hover:underline font-semibold"
                >
                  返回全部
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 border-b bg-card flex-shrink-0">
              <div className="flex bg-muted p-1 rounded-xl">
                <button
                  onClick={() => {
                    setViewMode('all');
                    setSelectedSessionId(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    viewMode === 'all'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  🕒 实时日志
                </button>
                <button
                  onClick={() => {
                    setViewMode('sessions');
                    setSelectedSessionId(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    viewMode === 'sessions'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  💬 对话会话
                </button>
              </div>
            </div>
          )}

          {/* Sidebar Body */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            {viewMode === 'sessions' ? (
              <SessionSelector
                selectedSessionId={selectedSessionId}
                onSessionSelect={handleSessionSelect}
                onBack={handleBackToAll}
              />
            ) : (
              <>
                {/* Filters */}
                <LogFilters
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  models={viewMode === 'session' ? (sessionModels || []) : models}
                  totalRecords={pagination.total}
                  viewMode={viewMode}
                />

                {/* Timeline */}
                <div className="flex-1 overflow-y-auto">
                  {loading && entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
                      <span className="text-xs">加载对话轮次中...</span>
                    </div>
                  ) : entries.length === 0 ? (
                    <div className="text-center py-12 text-xs text-muted-foreground border border-dashed rounded-xl m-4 p-4">
                      没有找到匹配的记录
                    </div>
                  ) : (
                    <ConversationTimeline
                      entries={entries}
                      selectedEntry={selectedEntry}
                      onEntrySelect={handleEntrySelect}
                    />
                  )}
                </div>

                {/* Pagination */}
                {pagination.hasMore && entries.length > 0 && (
                  <div className="p-3 border-t bg-card flex-shrink-0">
                    <button
                      onClick={loadMore}
                      disabled={loading}
                      className="w-full py-2.5 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-dashed border-primary/20 rounded-xl disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          加载中...
                        </>
                      ) : (
                        `加载更多 (余 ${pagination.total - entries.length} 条)`
                      )}
                    </button>
                  </div>
                )}

                <div className="px-3 py-2 border-t bg-muted/20 text-[10px] text-center text-muted-foreground font-mono flex-shrink-0">
                  显示 {entries.length} / {pagination.total.toLocaleString()} 条记录
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Content Pane (Detailed Context & Analysis) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-muted/10">
          {viewMode === 'sessions' && !selectedSessionId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-muted/10 animate-fadeIn">
              <div className="p-5 bg-primary/10 rounded-2xl mb-4 text-primary animate-pulse">
                <Users className="w-10 h-10" />
              </div>
              <h2 className="text-lg font-bold text-foreground mb-2">对话会话浏览器</h2>
              <p className="text-xs text-muted-foreground max-w-sm">
                左侧列表展示了系统中被归并的 Messages API 会话。选择任意会话，系统将在下方呈现该上下文完整的轮次记录、Token 消耗流及提示词差异。
              </p>
            </div>
          ) : selectedEntry ? (
            <div className="flex-1 flex flex-col overflow-hidden animate-fadeIn">
              {/* 如果没有折叠，在最上方展示纯粹、精致的 TokenStats 横向数据窄带，绝无文字重合 */}
              {!statsCollapsed && (
                <div className="border-b bg-card px-6 py-3.5 flex-shrink-0 shadow-sm animate-slideDown z-10">
                  <TokenStats
                    currentEntry={selectedEntry}
                    totalStats={totalStats}
                    entriesCount={entries.length}
                  />
                </div>
              )}

              {/* Detail Panel */}
              <div className="flex-1 overflow-y-auto">
                <ContextDetailPanel
                  entry={selectedEntry}
                  entries={entries}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-muted/10 animate-fadeIn">
              <Database className="w-10 h-10 text-muted-foreground mb-3 animate-pulse" />
              <h2 className="text-sm font-semibold text-foreground mb-2">无选中的日志详情</h2>
              <p className="text-xs text-muted-foreground">
                请在左侧时间轴选择一条对话轮次来查看其请求载荷、上下文差异和 translation 详情。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Database Status Footer */}
      <DatabaseStatus
        health={dbHealth}
        loading={healthLoading}
        onRefresh={loadHealth}
        lastRefresh={lastHealthRefresh}
      />

      {/* Token Stats Dialog */}
      <TokenStatsDialog
        totalStats={totalStats}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

export default App;
