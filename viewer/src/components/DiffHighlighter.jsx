import { useState } from 'react';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { ArrowRight, Plus } from 'lucide-react';
import { getRoleBadgeClass, truncateText } from '../lib/utils';
import MessageCard from './MessageCard';

function DiffHighlighter({ prevMessages, currentMessages, prevTools, currentTools }) {
  const [showAll, setShowAll] = useState(false);

  // 找到新增的消息
  const newMessages = getNewMessages(prevMessages, currentMessages);

  // 找到新增的工具
  const newTools = getNewTools(prevTools, currentTools);

  const hasChanges = newMessages.length > 0 || newTools.length > 0;

  return (
    <div className="space-y-6">
      {!hasChanges ? (
        <p className="text-sm text-muted-foreground">
          这轮对话没有新增内容。
        </p>
      ) : (
        <>
          {/* 新增工具 */}
          {newTools.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                  <Plus className="w-3 h-3 mr-1" />
                  新增工具 ({newTools.length})
                </Badge>
              </div>

              <div className="space-y-2">
                {newTools.map((tool) => (
                  <div
                    key={tool.name}
                    className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                  >
                    <div className="font-mono text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                      {tool.name}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {truncateText(tool.description, 100)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {newTools.length > 0 && newMessages.length > 0 && <Separator />}

          {/* 新增消息 */}
          {newMessages.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                  <Plus className="w-3 h-3 mr-1" />
                  新增消息 ({newMessages.length})
                </Badge>
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="text-xs text-primary hover:underline"
                >
                  {showAll ? '收起' : '展开详情'}
                </button>
              </div>

              <div className="space-y-3">
                {newMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Badge className={getRoleBadgeClass(msg.role)}>
                        {msg.role}
                      </Badge>
                      {msg.role === 'assistant' && (
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>

                    {showAll ? (
                      <MessageCard message={msg} />
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        {getMessagePreview(msg)}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 上下文累积说明 */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  上下文累积原理
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                  在多轮对话中，客户端需要将<strong>所有历史消息</strong>发送给 API。
                  这轮对话新增了 <strong>{newMessages.length}</strong> 条消息，
                  加上之前的 <strong>{prevMessages.length}</strong> 条历史消息，
                  总共发送了 <strong>{currentMessages.length}</strong> 条消息。
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-200 mt-2">
                  这就是为什么多轮对话的 Token 消耗会随着对话轮次增加而增长。
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * 获取新增的消息
 */
function getNewMessages(prevMessages, currentMessages) {
  if (prevMessages.length === 0) return currentMessages;

  // 从后往前找，找到最后一个相同的消息
  let newStartIndex = currentMessages.length;

  for (let i = Math.min(prevMessages.length, currentMessages.length) - 1; i >= 0; i--) {
    if (JSON.stringify(prevMessages[i]) === JSON.stringify(currentMessages[i])) {
      newStartIndex = i + 1;
      break;
    }
  }

  return currentMessages.slice(newStartIndex);
}

/**
 * 获取新增的工具
 */
function getNewTools(prevTools, currentTools) {
  if (prevTools.length === 0) return currentTools;

  const prevToolNames = new Set(prevTools.map(t => t.name));
  return currentTools.filter(t => !prevToolNames.has(t.name));
}

/**
 * 获取消息预览文本
 */
function getMessagePreview(msg) {
  if (typeof msg.content === 'string') {
    return truncateText(msg.content, 150);
  }

  if (Array.isArray(msg.content)) {
    const textBlocks = msg.content.filter(c => c.type === 'text');
    const toolUseBlocks = msg.content.filter(c => c.type === 'tool_use');
    const toolResultBlocks = msg.content.filter(c => c.type === 'tool_result');

    if (textBlocks.length > 0) {
      return truncateText(textBlocks.map(b => b.text).join('\n'), 150);
    }
    if (toolUseBlocks.length > 0) {
      return `工具调用: ${toolUseBlocks.map(b => b.name).join(', ')}`;
    }
    if (toolResultBlocks.length > 0) {
      return `工具结果: ${toolResultBlocks.length} 个`;
    }
  }

  return '[非文本内容]';
}

export default DiffHighlighter;
