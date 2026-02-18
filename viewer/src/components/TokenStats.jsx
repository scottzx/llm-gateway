import { formatTokens } from '../lib/utils';
import { TrendingUp, Activity, Database, Zap } from 'lucide-react';

function TokenStats({ currentEntry, totalStats, entriesCount }) {
  const stats = [
    {
      label: '本轮输入',
      value: currentEntry?.inputTokens || 0,
      icon: <TrendingUp className="w-4 h-4" />,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20',
    },
    {
      label: '本轮输出',
      value: currentEntry?.outputTokens || 0,
      icon: <Zap className="w-4 h-4" />,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
    },
    {
      label: '累计总计',
      value: totalStats.totalTokens,
      icon: <Database className="w-4 h-4" />,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20',
    },
    {
      label: '平均每轮',
      value: entriesCount > 0 ? Math.round(totalStats.totalTokens / entriesCount) : 0,
      icon: <Activity className="w-4 h-4" />,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-100 dark:bg-orange-900/20',
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`${stat.bgColor} rounded-lg p-3 flex items-center gap-3`}
        >
          <div className={`${stat.color}`}>
            {stat.icon}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={`text-lg font-semibold ${stat.color}`}>
              {formatTokens(stat.value)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default TokenStats;
