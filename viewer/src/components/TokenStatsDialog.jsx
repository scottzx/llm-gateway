import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from './ui/dialog';
import { formatTokens } from '../lib/utils';
import RoleTokenBarChart from './charts/RoleTokenBarChart';
import TokenUsageGuide from './TokenUsageGuide';
import { BarChart3, Database, TrendingUp, Activity, Info, Zap, HelpCircle } from 'lucide-react';

/**
 * 统计卡片组件
 */
function StatCard({ icon, label, value, color, bgColor }) {
  return (
    <div className={`${bgColor} rounded-lg p-3 flex items-center gap-3`}>
      <div className={color}>{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-semibold ${color}`}>{value}</p>
      </div>
    </div>
  );
}

/**
 * TokenStatsDialog 组件
 * 展示 token 使用统计的可视化弹窗
 *
 * @param {Object} totalStats - 统一计算的总统计数据
 * @param {boolean} open - 弹窗是否打开
 * @param {Function} onOpenChange - 打开状态变化回调
 */
export default function TokenStatsDialog({ totalStats, open, onOpenChange }) {
  // 从 totalStats 中解构所需数据
  const {
    totalTokens,
    avgTokens,
    maxTokens,
    minTokens,
    byRole,
    roleSum,
    perRound: tokenData,
    hasAccurateData,
    totalInputTokens,
    totalOutputTokens,
  } = totalStats;

  // 标签页状态
  const [activeTab, setActiveTab] = useState('stats');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Token 使用统计
            </DialogTitle>
            {/* 标签页切换 */}
            <div className="flex gap-1 mr-8">
              <button
                onClick={() => setActiveTab('stats')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'stats'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                统计图表
              </button>
              <button
                onClick={() => setActiveTab('guide')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'guide'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                使用指南
              </button>
            </div>
          </div>
          <DialogClose />
        </DialogHeader>

        {/* 标签页内容 */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'stats' ? (
            <div className="space-y-6">
              {/* 统计摘要 */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              icon={<Database className="w-4 h-4" />}
              label="总计"
              value={formatTokens(totalTokens)}
              color="text-purple-600 dark:text-purple-400"
              bgColor="bg-purple-100 dark:bg-purple-900/20"
            />
            <StatCard
              icon={<Activity className="w-4 h-4" />}
              label="平均"
              value={formatTokens(avgTokens)}
              color="text-orange-600 dark:text-orange-400"
              bgColor="bg-orange-100 dark:bg-orange-900/20"
            />
            <StatCard
              icon={<TrendingUp className="w-4 h-4" />}
              label="最大"
              value={formatTokens(maxTokens)}
              color="text-green-600 dark:text-green-400"
              bgColor="bg-green-100 dark:bg-green-900/20"
            />
            <StatCard
              icon={<TrendingUp className="w-4 h-4" />}
              label="最小"
              value={formatTokens(minTokens)}
              color="text-blue-600 dark:text-blue-400"
              bgColor="bg-blue-100 dark:bg-blue-900/20"
            />
          </div>

          {/* Input/Output 分离统计 */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            <StatCard
              icon={<TrendingUp className="w-4 h-4" />}
              label="总输入"
              value={formatTokens(totalInputTokens)}
              color="text-blue-600 dark:text-blue-400"
              bgColor="bg-blue-100 dark:bg-blue-900/20"
            />
            <StatCard
              icon={<Zap className="w-4 h-4" />}
              label="总输出"
              value={formatTokens(totalOutputTokens)}
              color="text-green-600 dark:text-green-400"
              bgColor="bg-green-100 dark:bg-green-900/20"
            />
          </div>

          {/* 角色分布统计 */}
          <div className="border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-3">角色分布</h3>
            <div className="grid grid-cols-6 gap-3">
              <div className="text-center p-2 bg-gray-300 dark:bg-gray-600 rounded">
                <p className="text-xs text-muted-foreground">System</p>
                <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                  {formatTokens(byRole.system)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {roleSum > 0
                    ? Math.round(byRole.system / roleSum * 100)
                    : 0}%
                </p>
              </div>
              <div className="text-center p-2 bg-gray-200 dark:bg-gray-700 rounded">
                <p className="text-xs text-muted-foreground">System-Reminder</p>
                <p className="text-lg font-semibold text-gray-600 dark:text-gray-300">
                  {formatTokens(byRole.systemReminder)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {roleSum > 0
                    ? Math.round(byRole.systemReminder / roleSum * 100)
                    : 0}%
                </p>
              </div>
              <div className="text-center p-2 bg-gray-100 dark:bg-gray-800 rounded">
                <p className="text-xs text-muted-foreground">Tools-Reminder</p>
                <p className="text-lg font-semibold text-gray-500 dark:text-gray-400">
                  {formatTokens(byRole.toolsReminder)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {roleSum > 0
                    ? Math.round(byRole.toolsReminder / roleSum * 100)
                    : 0}%
                </p>
              </div>
              <div className="text-center p-2 bg-blue-100 dark:bg-blue-900/20 rounded">
                <p className="text-xs text-muted-foreground">User</p>
                <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                  {formatTokens(byRole.user)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {roleSum > 0
                    ? Math.round(byRole.user / roleSum * 100)
                    : 0}%
                </p>
              </div>
              <div className="text-center p-2 bg-green-100 dark:bg-green-900/20 rounded">
                <p className="text-xs text-muted-foreground">Assistant</p>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                  {formatTokens(byRole.assistant)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {roleSum > 0
                    ? Math.round(byRole.assistant / roleSum * 100)
                    : 0}%
                </p>
              </div>
              <div className="text-center p-2 bg-purple-100 dark:bg-purple-900/20 rounded">
                <p className="text-xs text-muted-foreground">Tool</p>
                <p className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                  {formatTokens(byRole.tool)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {roleSum > 0
                    ? Math.round(byRole.tool / roleSum * 100)
                    : 0}%
                </p>
              </div>
            </div>
          </div>

          {/* 主图表 */}
          <div className="border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-4">每轮对话 Token 使用</h3>
            <RoleTokenBarChart data={tokenData} />
          </div>

          {/* 数据来源说明 */}
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">数据来源说明</p>
              {hasAccurateData ? (
                <p>
                  部分数据来自 API 响应中的准确 token 计数，其余为基于文本的估算值。
                  中文按 2 字符/token，英文按 4 字符/token 估算。
                </p>
              ) : (
                <p>
                  所有数据均为基于文本的估算值。中文按 2 字符/token，英文按 4 字符/token 估算。
                </p>
              )}
              <p className="mt-1">
                User 包含用户消息（不含 system-reminder），Assistant 包含助手回复，
                System 包含系统提示词，System-Reminder 包含注入到用户消息中的系统提示，
                Tools-Reminder 包含可用工具定义，Tool 包含 tool_use 调用。
              </p>
            </div>
          </div>
            </div>
          ) : (
            <TokenUsageGuide />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
