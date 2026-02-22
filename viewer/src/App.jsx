import { useState, useEffect, useCallback } from 'react';
import { fetchLogFiles, fetchLogData } from './lib/api';
import ConversationTimeline from './components/ConversationTimeline';
import ContextDetailPanel from './components/ContextDetailPanel';
import TokenStats from './components/TokenStats';
import TokenStatsDialog from './components/TokenStatsDialog';
import { FileText, AlertCircle, Loader2, BarChart3 } from 'lucide-react';

function App() {
  const [logFiles, setLogFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // 加载日志文件列表
  useEffect(() => {
    const loadLogFiles = async () => {
      try {
        setLoading(true);
        setError(null);
        const files = await fetchLogFiles();
        setLogFiles(files);
        // 自动选择第一个文件
        if (files.length > 0) {
          setSelectedFile(files[0]);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadLogFiles();
  }, []);

  // 加载选中文件的数据
  useEffect(() => {
    const loadLogData = async () => {
      if (!selectedFile) return;
      try {
        setLoading(true);
        setError(null);
        const data = await fetchLogData(selectedFile);
        setEntries(data);
        // 选择第一条记录
        if (data.length > 0) {
          setSelectedEntry(data[0]);
        } else {
          setSelectedEntry(null);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadLogData();
  }, [selectedFile]);

  // 处理文件切换
  const handleFileChange = useCallback((file) => {
    setSelectedFile(file);
    setSelectedEntry(null);
  }, []);

  // 处理条目选择
  const handleEntrySelect = useCallback((entry) => {
    setSelectedEntry(entry);
  }, []);

  // 计算总 Token 统计
  const totalStats = entries.reduce(
    (acc, entry) => ({
      inputTokens: acc.inputTokens + (entry.inputTokens || 0),
      outputTokens: acc.outputTokens + (entry.outputTokens || 0),
      totalTokens: acc.totalTokens + (entry.inputTokens || 0) + (entry.outputTokens || 0),
    }),
    { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">LLM 对话上下文可视化</h1>
                <p className="text-sm text-muted-foreground">
                  理解 Messages API 的请求/响应结构、Token 计算和上下文管理
                </p>
              </div>
            </div>

            {/* 文件选择器 */}
            {logFiles.length > 0 && (
              <select
                value={selectedFile || ''}
                onChange={(e) => handleFileChange(e.target.value)}
                className="px-3 py-2 bg-background border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {logFiles.map((file) => (
                  <option key={file} value={file}>
                    {file}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </header>

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
      {error && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">加载失败</h2>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!loading && !error && entries.length > 0 && (
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧时间轴 */}
          <div className="w-80 border-r bg-card overflow-y-auto">
            <ConversationTimeline
              entries={entries}
              selectedEntry={selectedEntry}
              onEntrySelect={handleEntrySelect}
            />
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
      {!loading && !error && entries.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">暂无数据</h2>
            <p className="text-muted-foreground">
              该日志文件中没有找到对话记录
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t bg-card py-2 px-4 text-xs text-muted-foreground text-center">
        LLM Context Viewer - 帮助开发者理解 LLM 对话上下文的交互过程
      </footer>

      {/* Token 统计弹窗 */}
      <TokenStatsDialog
        entries={entries}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

export default App;
