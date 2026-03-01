import { Database, HardDrive, Clock, Calendar, RefreshCw } from 'lucide-react';

/**
 * 格式化时间戳为本地时间
 */
function formatTime(timestamp) {
  if (!timestamp) return '未知';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 格式化文件大小
 */
function formatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * 数据库状态指示器
 */
function StatusIndicator({ status }) {
  const statusConfig = {
    healthy: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/20', label: '健康' },
    warning: { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/20', label: '警告' },
    error: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/20', label: '错误' },
  };

  const config = statusConfig[status] || statusConfig.healthy;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${config.bg} ${config.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.color} bg-current`} />
      {config.label}
    </span>
  );
}

/**
 * 数据库状态组件
 * 显示数据库健康状态、记录数、文件大小等信息
 *
 * @param {Object} props
 * @param {Object} props.health - 数据库健康信息
 * @param {boolean} props.loading - 加载状态
 * @param {Function} props.onRefresh - 刷新回调
 * @param {Date} props.lastRefresh - 上次刷新时间
 */
export default function DatabaseStatus({ health, loading = false, onRefresh, lastRefresh }) {
  if (!health) {
    return (
      <div className="border-t bg-muted/30 py-2 px-4">
        <div className="flex items-center justify-center text-xs text-muted-foreground">
          {loading ? (
            <>
              <RefreshCw className="w-3 h-3 animate-spin mr-2" />
              加载数据库状态...
            </>
          ) : (
            '无法加载数据库状态'
          )}
        </div>
      </div>
    );
  }

  const {
    status = 'healthy',
    totalRecords = 0,
    dbSize = {},
    latestEntry,
    oldestEntry,
    retentionDays,
    version,
  } = health;

  return (
    <div className="border-t bg-muted/30 py-2 px-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">数据库状态</span>
          <StatusIndicator status={status} />
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">
              更新于 {formatTime(lastRefresh)}
            </span>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="刷新状态"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        {/* 总记录数 */}
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">总记录:</span>
          <span className="font-semibold text-foreground">{totalRecords.toLocaleString()}</span>
        </div>

        {/* 数据库文件大小 */}
        <div className="flex items-center gap-2">
          <HardDrive className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">大小:</span>
          <span className="font-semibold text-foreground">
            {dbSize.mb ? `${dbSize.mb.toFixed(2)} MB` : formatSize(dbSize.bytes)}
          </span>
        </div>

        {/* 最新记录时间 */}
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">最新:</span>
          <span className="font-semibold text-foreground">{formatTime(latestEntry)}</span>
        </div>

        {/* 数据保留天数 */}
        {retentionDays && (
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">保留:</span>
            <span className="font-semibold text-foreground">{retentionDays} 天</span>
          </div>
        )}

        {/* 版本信息 */}
        {version && (
          <div className="ml-auto">
            <span className="text-xs text-muted-foreground">v{version}</span>
          </div>
        )}
      </div>

      {/* 时间范围信息 */}
      {oldestEntry && latestEntry && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>
              数据范围: {new Date(oldestEntry).toLocaleDateString('zh-CN')} 至{' '}
              {new Date(latestEntry).toLocaleDateString('zh-CN')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
