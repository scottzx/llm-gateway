import { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronRight, Lightbulb, AlertCircle, Info } from 'lucide-react';

/**
 * 可折叠内容区块
 */
function CollapsibleSection({ title, icon, defaultOpen = false, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-2 text-sm text-muted-foreground border-t">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Token 使用指南组件
 * 展示智能体 Token 消耗的详细解释和洞察
 */
export default function TokenUsageGuide() {
  return (
    <div className="space-y-4">
      {/* 标题 */}
      <div className="flex items-center gap-2 pb-2 border-b">
        <HelpCircle className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Token 消耗可视化解读</h3>
      </div>

      <div className="space-y-3">
        {/* 核心概念 */}
        <CollapsibleSection
          title="核心概念：为什么会有重复消耗？"
          icon={<Lightbulb className="w-4 h-4 text-yellow-500" />}
          defaultOpen={true}
        >
          <div className="space-y-2">
            <p>
              大模型本身是<strong>无状态</strong>的，它没有记忆。智能体需要为每一轮对话重新构建完整的上下文，
              把所有必要的信息再次发送给大模型。这就是为什么每一轮都会产生 token 消耗。
            </p>
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-yellow-800 dark:text-yellow-200 text-xs">
                <strong>关键点：</strong>即使是同样的工具定义或系统提示，每一轮对话都需要重新发送，
                这就是为什么 Tools-Reminder 会占据如此大的比例。
              </p>
            </div>
          </div>
        </CollapsibleSection>

        {/* 数据解读 - 总体统计 */}
        <CollapsibleSection
          title="数据解读：总体统计（左侧卡片）"
          icon={<Info className="w-4 h-4 text-blue-500" />}
        >
          <ul className="space-y-1 list-disc list-inside">
            <li><strong>总计</strong>：整个对话过程的总消耗</li>
            <li><strong>平均</strong>：每轮对话的平均消耗</li>
            <li><strong>峰值 vs 谷值</strong>：展示了不同轮次的巨大差异</li>
          </ul>
        </CollapsibleSection>

        {/* 数据解读 - 角色分布 */}
        <CollapsibleSection
          title="数据解读：角色分布（重点！）"
          icon={<AlertCircle className="w-4 h-4 text-red-500" />}
          defaultOpen={true}
        >
          <div className="space-y-3">
            <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
              <p className="text-red-800 dark:text-red-200 text-sm font-medium">
                Tools-Reminder 通常占据最大比例（可能达到 60-80%）
              </p>
            </div>
            <p className="font-medium">原因：</p>
            <ol className="space-y-1 list-decimal list-inside">
              <li><strong>工具定义很详细</strong>：每个工具都有完整的 JSON schema，包含参数类型、描述、验证规则等</li>
              <li><strong>每轮都发送</strong>：只要启用了工具，每一轮请求都要携带完整的工具定义</li>
              <li><strong>累积效应</strong>：从第 1 轮到第 N 轮，工具定义被重复发送了 N 次</li>
            </ol>
            <div className="mt-3 pt-3 border-t">
              <p className="font-medium mb-2">其他角色说明：</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
                  <span className="font-medium">System-Reminder</span>：动态注入的系统提示
                </div>
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded">
                  <span className="font-medium">System</span>：基础系统提示词
                </div>
                <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded">
                  <span className="font-medium">Tool</span>：实际的工具调用和结果
                </div>
                <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded">
                  <span className="font-medium">Assistant</span>：模型的回复内容
                </div>
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded col-span-2">
                  <span className="font-medium">User</span>：用户的实际输入（通常占比很小）
                </div>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* 数据解读 - 每轮对话 */}
        <CollapsibleSection
          title="数据解读：每轮对话柱状图"
          icon={<Info className="w-4 h-4 text-green-500" />}
        >
          <div className="space-y-2">
            <p>每一根柱子代表一轮对话的 token 消耗：</p>
            <ul className="space-y-1 list-disc list-inside">
              <li><strong>详细数据</strong>：鼠标悬停在柱子上可以看到该轮的详细分解</li>
              <li><strong>波动模式</strong>：不同轮次的差异很大
                <ul className="ml-4 mt-1 list-disc list-inside text-xs">
                  <li>工具调用多的轮次消耗就高</li>
                  <li>简单对话的轮次消耗就低</li>
                </ul>
              </li>
            </ul>
            <div className="mt-2 p-3 bg-muted rounded-lg">
              <p className="font-medium mb-2 text-xs">颜色编码：</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-gray-600"></span> 系统级
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-blue-500"></span> 用户
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-green-500"></span> 助手
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-purple-500"></span> 工具
                </span>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* 关键洞察 */}
        <CollapsibleSection
          title="关键洞察与优化方向"
          icon={<Lightbulb className="w-4 h-4 text-purple-500" />}
          defaultOpen={true}
        >
          <div className="space-y-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <p className="font-medium text-purple-800 dark:text-purple-200 mb-1">1. 工具定义是主要成本</p>
              <p className="text-xs">
                如果你的智能体使用了大量工具，工具定义的重复发送会成为主要的 token 消耗来源。
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <p className="font-medium text-blue-800 dark:text-blue-200 mb-1">2. 输入远大于输出</p>
              <p className="text-xs">
                通常输入/输出比例约 6:1。说明大部分 token 消耗在"告诉模型做什么"，
                而不是"模型生成答案"。
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <p className="font-medium text-green-800 dark:text-green-200 mb-1">3. 优化方向</p>
              <ul className="text-xs space-y-1 list-disc list-inside">
                <li><strong>工具精简</strong>：只启用必要的工具</li>
                <li><strong>工具描述优化</strong>：简洁的描述可以减少 tokens</li>
                <li><strong>上下文管理</strong>：智能地过滤和压缩历史对话</li>
              </ul>
            </div>
          </div>
        </CollapsibleSection>

        {/* 技术说明 */}
        <CollapsibleSection
          title="技术说明"
          icon={<Info className="w-4 h-4 text-gray-500" />}
        >
          <div className="space-y-2">
            <div>
              <p className="font-medium mb-1">数据来源：</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>
                  <span className="text-green-600 font-medium">准确值</span>：
                  从 API 响应的 <code className="bg-muted px-1 rounded">usage</code> 字段提取
                </li>
                <li>
                  <span className="text-yellow-600 font-medium">估算值</span>：
                  基于文本长度（中文 2 字符/token，英文 4 字符/token）
                </li>
              </ul>
            </div>
            <div className="pt-2 border-t">
              <p className="font-medium mb-1">角色分类：</p>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div><strong>System</strong>：系统提示词</div>
                <div><strong>System-Reminder</strong>：<code>&lt;system-reminder&gt;</code> 标签内容</div>
                <div><strong>Tools-Reminder</strong>：<code>tools</code> 数组的 JSON schema</div>
                <div><strong>User</strong>：用户实际输入</div>
                <div><strong>Assistant</strong>：助手回复文本</div>
                <div><strong>Tool</strong>：工具调用和结果</div>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* 总结 */}
        <div className="p-4 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg">
          <p className="font-medium text-sm mb-1">总结</p>
          <p className="text-xs">
            在使用工具的智能体场景中，<strong>工具定义的重复发送是最大的 token 成本来源</strong>。
            理解这一点，对于优化智能体的成本和性能至关重要。
          </p>
        </div>
      </div>
    </div>
  );
}
