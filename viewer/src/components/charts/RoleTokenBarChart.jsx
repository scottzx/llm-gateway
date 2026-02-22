import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

/**
 * 角色颜色配置
 * 与 MessageCard 的角色颜色保持一致
 */
const ROLE_COLORS = {
  user: '#3b82f6',    // 蓝色
  assistant: '#10b981', // 绿色
  system: '#6b7280',    // 灰色
  systemReminder: '#f59e0b', // 黄色
  tool: '#8b5cf6',      // 紫色
};

/**
 * 自定义 Tooltip 组件
 * 显示详细的 token 数量和百分比
 */
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0].payload;
  const total = data.total;

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3 min-w-[200px]">
      <div className="text-sm font-semibold mb-2 pb-2 border-b">
        对话轮次 #{data.messageIndex + 1}
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: ROLE_COLORS.system }} />
            System
          </span>
          <span className="font-mono font-medium">
            {data.system.toLocaleString()} ({total > 0 ? Math.round(data.system / total * 100) : 0}%)
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: ROLE_COLORS.systemReminder }} />
            System-Reminder
          </span>
          <span className="font-mono font-medium">
            {data.systemReminder.toLocaleString()} ({total > 0 ? Math.round(data.systemReminder / total * 100) : 0}%)
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: ROLE_COLORS.user }} />
            User
          </span>
          <span className="font-mono font-medium">
            {data.user.toLocaleString()} ({total > 0 ? Math.round(data.user / total * 100) : 0}%)
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: ROLE_COLORS.assistant }} />
            Assistant
          </span>
          <span className="font-mono font-medium">
            {data.assistant.toLocaleString()} ({total > 0 ? Math.round(data.assistant / total * 100) : 0}%)
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: ROLE_COLORS.tool }} />
            Tool
          </span>
          <span className="font-mono font-medium">
            {data.tool.toLocaleString()} ({total > 0 ? Math.round(data.tool / total * 100) : 0}%)
          </span>
        </div>
        <div className="pt-2 mt-2 border-t flex items-center justify-between font-semibold">
          <span>总计</span>
          <span className="font-mono">{total.toLocaleString()} tokens</span>
        </div>
      </div>
    </div>
  );
};

/**
 * 角色图例组件
 */
const CustomLegend = () => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 text-sm py-2">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: ROLE_COLORS.system }} />
        <span>System</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: ROLE_COLORS.systemReminder }} />
        <span>System-Reminder</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: ROLE_COLORS.user }} />
        <span>User</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: ROLE_COLORS.assistant }} />
        <span>Assistant</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: ROLE_COLORS.tool }} />
        <span>Tool</span>
      </div>
    </div>
  );
};

/**
 * RoleTokenBarChart 组件
 * 展示各角色在每轮对话中的 token 使用情况
 *
 * @param {Array} data - token 分析数据数组
 */
export default function RoleTokenBarChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        暂无数据
      </div>
    );
  }

  // 为每个条目添加显示标签
  const chartData = data.map((item, index) => ({
    ...item,
    label: `#${index + 1}`,
  }));

  return (
    <div className="w-full">
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{
              top: 5,
              right: 20,
              left: 60,
              bottom: 5,
            }}
            barCategoryGap={2}
          >
            <XAxis
              type="number"
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 11 }}
              width={55}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="system"
              stackId="tokens"
              fill={ROLE_COLORS.system}
              name="System"
            />
            <Bar
              dataKey="systemReminder"
              stackId="tokens"
              fill={ROLE_COLORS.systemReminder}
              name="System-Reminder"
            />
            <Bar
              dataKey="user"
              stackId="tokens"
              fill={ROLE_COLORS.user}
              name="User"
            />
            <Bar
              dataKey="assistant"
              stackId="tokens"
              fill={ROLE_COLORS.assistant}
              name="Assistant"
            />
            <Bar
              dataKey="tool"
              stackId="tokens"
              fill={ROLE_COLORS.tool}
              name="Tool"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <CustomLegend />
    </div>
  );
}
