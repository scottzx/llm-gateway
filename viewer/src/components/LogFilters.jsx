import { Filter, X, Calendar, Cpu, AlertCircle } from 'lucide-react';

/**
 * 日志过滤器组件
 * 提供模型、状态、时间范围筛选功能
 *
 * @param {Object} props
 * @param {Object} props.filters - 当前过滤器状态
 * @param {string|null} props.filters.model - 选中的模型
 * @param {string|null} props.filters.status - 选中的状态
 * @param {string|null} props.filters.startDate - 开始日期
 * @param {string|null} props.filters.endDate - 结束日期
 * @param {Function} props.onFilterChange - 过滤器变化回调
 * @param {Array<string>} props.models - 可用的模型列表
 * @param {number} props.totalRecords - 总记录数（用于显示）
 * @param {string} props.viewMode - 视图模式 ('all' | 'session' | 'sessions')
 */
export default function LogFilters({ filters, onFilterChange, models = [], totalRecords = 0, viewMode = 'all' }) {
  const updateFilter = (key, value) => {
    onFilterChange({
      ...filters,
      [key]: value || null,
    });
  };

  const clearAllFilters = () => {
    onFilterChange({
      model: null,
      status: null,
      startDate: null,
      endDate: null,
    });
  };

  const hasActiveFilters = filters.model || filters.status || filters.startDate || filters.endDate;

  // 格式化日期显示
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  // 获取今天和7天前的日期字符串（用于快捷选择）
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getWeekAgoStr = () => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  };

  const setLast7Days = () => {
    onFilterChange({
      ...filters,
      startDate: getWeekAgoStr(),
      endDate: getTodayStr(),
    });
  };

  const setToday = () => {
    const today = getTodayStr();
    onFilterChange({
      ...filters,
      startDate: today,
      endDate: today,
    });
  };

  const isSessionView = viewMode === 'session';

  return (
    <div className="border-b bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">筛选条件</span>
          {isSessionView && (
            <span className="text-xs text-muted-foreground">
              (应用于当前会话)
            </span>
          )}
          {hasActiveFilters && !isSessionView && (
            <span className="text-xs text-muted-foreground">
              ({totalRecords.toLocaleString()} 条记录)
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" />
            清除全部
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* 模型筛选 */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <Cpu className="w-3 h-3" />
            模型
          </label>
          <select
            value={filters.model || ''}
            onChange={(e) => updateFilter('model', e.target.value)}
            className="px-2 py-1.5 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary min-w-[180px]"
          >
            <option value="">所有模型</option>
            {models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>

        {/* 状态筛选 */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <AlertCircle className="w-3 h-3" />
            状态
          </label>
          <select
            value={filters.status || ''}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="px-2 py-1.5 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">所有状态</option>
            <option value="200">成功 (200)</option>
            <option value="400">客户端错误 (400)</option>
            <option value="500">服务器错误 (500)</option>
            <option value="error">错误</option>
          </select>
        </div>

        {/* 时间范围筛选 */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            时间范围
          </label>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => updateFilter('startDate', e.target.value)}
              className="px-2 py-1.5 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              max={filters.endDate || getTodayStr()}
            />
            <span className="text-xs text-muted-foreground">至</span>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => updateFilter('endDate', e.target.value)}
              className="px-2 py-1.5 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              min={filters.startDate}
              max={getTodayStr()}
            />
          </div>
        </div>

        {/* 快捷时间选择 */}
        <div className="flex items-center gap-1">
          <button
            onClick={setToday}
            className="px-2 py-1.5 text-xs bg-background border rounded-md hover:bg-muted transition-colors"
          >
            今天
          </button>
          <button
            onClick={setLast7Days}
            className="px-2 py-1.5 text-xs bg-background border rounded-md hover:bg-muted transition-colors"
          >
            最近7天
          </button>
        </div>
      </div>

      {/* 活跃过滤器标签 */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t">
          {filters.model && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md">
              <Cpu className="w-3 h-3" />
              {filters.model}
              <button
                onClick={() => updateFilter('model', null)}
                className="ml-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.status && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md">
              <AlertCircle className="w-3 h-3" />
              状态: {filters.status}
              <button
                onClick={() => updateFilter('status', null)}
                className="ml-1 hover:bg-green-200 dark:hover:bg-green-800 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {(filters.startDate || filters.endDate) && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md">
              <Calendar className="w-3 h-3" />
              {formatDateDisplay(filters.startDate)} - {formatDateDisplay(filters.endDate)}
              <button
                onClick={() => {
                  onFilterChange({
                    ...filters,
                    startDate: null,
                    endDate: null,
                  });
                }}
                className="ml-1 hover:bg-purple-200 dark:hover:bg-purple-800 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
