import { getRoleBadgeClass, isToolUseMessage, isToolResultMessage, isTextMessage, isImageMessage } from '../lib/utils';
import { Badge } from './ui/badge';
import { Code, Image as ImageIcon, FileText, Languages } from 'lucide-react';
import { useState } from 'react';
import ToolInfoDialog from './ToolInfoDialog';
import TranslationDialog from './TranslationDialog';

function MessageCard({ message }) {
  const renderContent = () => {
    if (typeof message.content === 'string') {
      return (
        <div className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </div>
      );
    }

    if (Array.isArray(message.content)) {
      return (
        <div className="space-y-3">
          {message.content.map((block, idx) => (
            <ContentBlock key={idx} block={block} role={message.role} />
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="p-4 rounded-lg border bg-card">
      <div className="flex items-center gap-2 mb-3">
        <Badge className={getRoleBadgeClass(message.role)}>
          {message.role}
        </Badge>
        {message.role === 'assistant' && message.content && (
          <span className="text-xs text-muted-foreground">
            {typeof message.content === 'string'
              ? '文本回复'
              : `包含 ${message.content.length} 个内容块`}
          </span>
        )}
      </div>

      {renderContent()}
    </div>
  );
}

function ContentBlock({ block, role }) {
  // 翻译对话框状态
  const [translationOpen, setTranslationOpen] = useState(false);

  // 获取可翻译的文本内容
  const getTranslatableText = () => {
    if (isTextMessage(block)) {
      return block.text || '';
    }
    if (isToolUseMessage(block)) {
      const name = block.name || '';
      const input = block.input ? JSON.stringify(block.input, null, 2) : '';
      return `工具调用: ${name}\n参数:\n${input}`;
    }
    if (isToolResultMessage(block)) {
      const toolId = block.tool_use_id || '';
      const content = typeof block.content === 'string'
        ? block.content
        : JSON.stringify(block.content, null, 2);
      return `工具结果 (ID: ${toolId}):\n${content}`;
    }
    if (isImageMessage(block)) {
      const imgType = block.source?.type || 'unknown';
      return `[图片内容 - 类型: ${imgType}]`;
    }
    return JSON.stringify(block, null, 2);
  };

  // 渲染翻译按钮
  const renderTranslateButton = (blockType) => (
    <button
      onClick={() => setTranslationOpen(true)}
      className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded"
      title="翻译"
    >
      <Languages className="w-4 h-4" />
    </button>
  );

  // 根据role选择颜色样式：user用蓝色，assistant用绿色
  const isUser = role === 'user';

  if (isTextMessage(block)) {
    const bgClass = isUser
      ? 'bg-blue-50 dark:bg-blue-900/20'
      : 'bg-green-50 dark:bg-green-900/20';
    const borderClass = isUser
      ? 'border-blue-200 dark:border-blue-800'
      : 'border-green-200 dark:border-green-800';
    const iconColorClass = isUser
      ? 'text-blue-600 dark:text-blue-400'
      : 'text-green-600 dark:text-green-400';
    const titleColorClass = isUser
      ? 'text-blue-800 dark:text-blue-200'
      : 'text-green-800 dark:text-green-200';
    const contentColorClass = isUser
      ? 'text-blue-900 dark:text-blue-100'
      : 'text-green-900 dark:text-green-100';

    return (
      <div className={`p-3 ${bgClass} rounded-lg border ${borderClass} group relative`}>
        <div className="flex items-center gap-2 mb-2">
          <FileText className={`w-4 h-4 ${iconColorClass}`} />
          <span className={`text-sm font-medium ${titleColorClass}`}>
            文本内容
          </span>
          {renderTranslateButton('text')}
        </div>
        <div className={`text-sm whitespace-pre-wrap break-words ${contentColorClass}`}>
          {block.text}
        </div>
        <TranslationDialog
          block={block}
          blockType="text"
          originalText={getTranslatableText()}
          open={translationOpen}
          onOpenChange={setTranslationOpen}
        />
      </div>
    );
  }

  if (isToolUseMessage(block)) {
    return (
      <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 group relative">
        <div className="flex items-center gap-2 mb-2">
          <Code className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="font-mono text-sm font-medium text-purple-800 dark:text-purple-200">
            tool_use: {block.name}
          </span>
          {renderTranslateButton('tool_use')}
        </div>
        {block.input && (
          <pre className="text-xs overflow-x-auto bg-purple-100 dark:bg-purple-900/40 p-2 rounded mt-2">
            {JSON.stringify(block.input, null, 2)}
          </pre>
        )}
        <TranslationDialog
          block={block}
          blockType="tool_use"
          originalText={getTranslatableText()}
          open={translationOpen}
          onOpenChange={setTranslationOpen}
        />
      </div>
    );
  }

  if (isToolResultMessage(block)) {
    return (
      <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 group relative">
        <div className="flex items-center gap-2 mb-2">
          <Code className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          <span className="font-mono text-sm font-medium text-orange-800 dark:text-orange-200">
            tool_result: {block.tool_use_id}
          </span>
          {renderTranslateButton('tool_result')}
        </div>
        {block.content && (
          <div className="text-xs text-muted-foreground">
            {typeof block.content === 'string' ? (
              <div className="max-h-32 overflow-y-auto whitespace-pre-wrap">
                {block.content}
              </div>
            ) : (
              <pre className="overflow-x-auto max-h-32">
                {JSON.stringify(block.content, null, 2)}
              </pre>
            )}
          </div>
        )}
        {block.isError && (
          <span className="text-xs text-red-600 dark:text-red-400 mt-2 inline-block">
            (工具执行出错)
          </span>
        )}
        <TranslationDialog
          block={block}
          blockType="tool_result"
          originalText={getTranslatableText()}
          open={translationOpen}
          onOpenChange={setTranslationOpen}
        />
      </div>
    );
  }

  if (isImageMessage(block)) {
    return (
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 group relative">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm text-blue-800 dark:text-blue-200">
            图片内容
          </span>
          {block.source?.type && (
            <span className="text-xs text-muted-foreground">
              ({block.source.type})
            </span>
          )}
          {renderTranslateButton('image')}
        </div>
        <TranslationDialog
          block={block}
          blockType="image"
          originalText={getTranslatableText()}
          open={translationOpen}
          onOpenChange={setTranslationOpen}
        />
      </div>
    );
  }

  return (
    <div className="p-3 bg-muted rounded-lg group relative">
      <pre className="text-xs overflow-x-auto">
        {JSON.stringify(block, null, 2)}
      </pre>
      {renderTranslateButton('unknown')}
      <TranslationDialog
        block={block}
        blockType="unknown"
        originalText={getTranslatableText()}
        open={translationOpen}
        onOpenChange={setTranslationOpen}
      />
    </div>
  );
}

function MessageList({ messages, tools, system }) {
  const [selectedTool, setSelectedTool] = useState(null);

  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        暂无消息
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* System 模块 */}
      {system && system.length > 0 && (
        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <h4 className="text-sm font-medium mb-2">
            系统提示词 ({system.length})
          </h4>
          <div className="space-y-2">
            {system.map((item, idx) => (
              <div key={idx} className="p-3 bg-background rounded-lg border">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 可用工具列表 */}
      {tools && tools.length > 0 && (
        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <h4 className="text-sm font-medium mb-2">
            可用工具 ({tools.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {tools.map((tool) => (
              <Badge
                key={tool.name}
                variant="outline"
                className="font-mono text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                onClick={() => setSelectedTool(tool)}
              >
                {tool.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 消息列表 */}
      {messages.map((msg, idx) => (
        <div key={idx}>
          <MessageCard message={msg} />
        </div>
      ))}

      {/* 工具详情弹窗 */}
      {selectedTool && (
        <ToolInfoDialog
          tool={selectedTool}
          open={!!selectedTool}
          onOpenChange={(open) => !open && setSelectedTool(null)}
        />
      )}
    </div>
  );
}

export default MessageCard;
export { MessageList, ContentBlock };
