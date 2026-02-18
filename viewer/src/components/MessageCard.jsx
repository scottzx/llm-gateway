import { getRoleBadgeClass, isToolUseMessage, isToolResultMessage, isTextMessage, isImageMessage } from '../lib/utils';
import { Badge } from './ui/badge';
import { Code, Image as ImageIcon, FileText, Languages, Undo2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import ToolInfoDialog from './ToolInfoDialog';

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
  // 翻译状态管理
  const [translationState, setTranslationState] = useState({
    isTranslated: false,
    isLoading: false,
    error: null,
    translatedText: '',
    fromCache: false
  });

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

  // 翻译按钮处理
  const handleTranslate = async () => {
    // 防止重复点击
    if (translationState.isLoading) return;

    // 如果已翻译，切换回原文
    if (translationState.isTranslated) {
      setTranslationState(prev => ({ ...prev, isTranslated: false }));
      return;
    }

    // 开始翻译
    setTranslationState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // 调用翻译 API（自动检查缓存 + 翻译）
      const response = await fetch('/api/translation/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ block })
      });

      const data = await response.json();

      if (data.success) {
        setTranslationState({
          isTranslated: true,
          isLoading: false,
          translatedText: data.translatedText,
          fromCache: data.fromCache,
          error: null
        });
      } else {
        throw new Error(data.error || '翻译失败');
      }
    } catch (err) {
      // 显示错误提示
      alert(`翻译失败：${err.message}`);
      setTranslationState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message
      }));
    }
  };

  // 渲染翻译按钮
  const renderTranslateButton = () => (
    <button
      onClick={handleTranslate}
      disabled={translationState.isLoading}
      className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded disabled:opacity-50"
      title={translationState.isTranslated ? "显示原文" : "翻译"}
    >
      {translationState.isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : translationState.isTranslated ? (
        <Undo2 className="w-4 h-4" />
      ) : (
        <Languages className="w-4 h-4" />
      )}
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

    const displayText = translationState.isTranslated
      ? translationState.translatedText
      : block.text;

    return (
      <div className={`p-3 ${bgClass} rounded-lg border ${borderClass} group relative`}>
        <div className="flex items-center gap-2 mb-2">
          <FileText className={`w-4 h-4 ${iconColorClass}`} />
          <span className={`text-sm font-medium ${titleColorClass}`}>
            {translationState.isTranslated ? '翻译结果' : '文本内容'}
          </span>
          {renderTranslateButton()}
          {translationState.isTranslated && translationState.fromCache && (
            <Badge variant="secondary" className="text-xs">来自缓存</Badge>
          )}
        </div>
        <div className={`text-sm whitespace-pre-wrap break-words ${contentColorClass}`}>
          {displayText}
        </div>
      </div>
    );
  }

  if (isToolUseMessage(block)) {
    const displayContent = translationState.isTranslated
      ? translationState.translatedText
      : block.input
        ? JSON.stringify(block.input, null, 2)
        : '';

    return (
      <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 group relative">
        <div className="flex items-center gap-2 mb-2">
          <Code className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="font-mono text-sm font-medium text-purple-800 dark:text-purple-200">
            {translationState.isTranslated ? '翻译结果' : `tool_use: ${block.name}`}
          </span>
          {renderTranslateButton()}
          {translationState.isTranslated && translationState.fromCache && (
            <Badge variant="secondary" className="text-xs">来自缓存</Badge>
          )}
        </div>
        <pre className="text-xs overflow-x-auto bg-purple-100 dark:bg-purple-900/40 p-2 rounded mt-2">
          {displayContent}
        </pre>
      </div>
    );
  }

  if (isToolResultMessage(block)) {
    const displayContent = translationState.isTranslated
      ? translationState.translatedText
      : block.content;

    return (
      <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 group relative">
        <div className="flex items-center gap-2 mb-2">
          <Code className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          <span className="font-mono text-sm font-medium text-orange-800 dark:text-orange-200">
            {translationState.isTranslated ? '翻译结果' : `tool_result: ${block.tool_use_id}`}
          </span>
          {renderTranslateButton()}
          {translationState.isTranslated && translationState.fromCache && (
            <Badge variant="secondary" className="text-xs">来自缓存</Badge>
          )}
        </div>
        {displayContent && (
          <div className="text-xs text-muted-foreground">
            {typeof displayContent === 'string' ? (
              <div className="max-h-32 overflow-y-auto whitespace-pre-wrap">
                {displayContent}
              </div>
            ) : (
              <pre className="overflow-x-auto max-h-32">
                {JSON.stringify(displayContent, null, 2)}
              </pre>
            )}
          </div>
        )}
        {block.isError && (
          <span className="text-xs text-red-600 dark:text-red-400 mt-2 inline-block">
            (工具执行出错)
          </span>
        )}
      </div>
    );
  }

  if (isImageMessage(block)) {
    const displayContent = translationState.isTranslated
      ? translationState.translatedText
      : block.source?.type
        ? `类型: ${block.source.type}`
        : '';

    return (
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 group relative">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm text-blue-800 dark:text-blue-200">
            {translationState.isTranslated ? '翻译结果' : '图片内容'}
          </span>
          {!translationState.isTranslated && block.source?.type && (
            <span className="text-xs text-muted-foreground">
              ({block.source.type})
            </span>
          )}
          {renderTranslateButton()}
          {translationState.isTranslated && translationState.fromCache && (
            <Badge variant="secondary" className="text-xs">来自缓存</Badge>
          )}
        </div>
        {translationState.isTranslated && (
          <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
            {displayContent}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 bg-muted rounded-lg group relative">
      <pre className="text-xs overflow-x-auto">
        {translationState.isTranslated
          ? translationState.translatedText
          : JSON.stringify(block, null, 2)}
      </pre>
      {renderTranslateButton()}
      {translationState.isTranslated && translationState.fromCache && (
        <Badge variant="secondary" className="text-xs mt-2">来自缓存</Badge>
      )}
    </div>
  );
}

function SystemPromptItem({ item, idx }) {
  const [translationState, setTranslationState] = useState({
    isTranslated: false,
    isLoading: false,
    error: null,
    translatedText: '',
    fromCache: false
  });

  // 翻译按钮处理
  const handleTranslate = async () => {
    // 防止重复点击
    if (translationState.isLoading) return;

    // 如果已翻译，切换回原文
    if (translationState.isTranslated) {
      setTranslationState(prev => ({ ...prev, isTranslated: false }));
      return;
    }

    // 开始翻译
    setTranslationState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // 构造与 text block 相同的结构
      const block = { type: 'text', text: item.text };

      // 调用翻译 API（自动检查缓存 + 翻译）
      const response = await fetch('/api/translation/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ block })
      });

      const data = await response.json();

      if (data.success) {
        setTranslationState({
          isTranslated: true,
          isLoading: false,
          translatedText: data.translatedText,
          fromCache: data.fromCache,
          error: null
        });
      } else {
        throw new Error(data.error || '翻译失败');
      }
    } catch (err) {
      // 显示错误提示
      alert(`翻译失败：${err.message}`);
      setTranslationState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message
      }));
    }
  };

  const displayText = translationState.isTranslated
    ? translationState.translatedText
    : item.text;

  return (
    <div key={idx} className="p-3 bg-background rounded-lg border group relative">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">
          {translationState.isTranslated ? '翻译结果' : `系统提示词 #${idx + 1}`}
        </span>
        <div className="flex items-center gap-1">
          {translationState.isTranslated && translationState.fromCache && (
            <Badge variant="secondary" className="text-xs">来自缓存</Badge>
          )}
          <button
            onClick={handleTranslate}
            disabled={translationState.isLoading}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded disabled:opacity-50"
            title={translationState.isTranslated ? "显示原文" : "翻译"}
          >
            {translationState.isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : translationState.isTranslated ? (
              <Undo2 className="w-3.5 h-3.5" />
            ) : (
              <Languages className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
        {displayText}
      </p>
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
              <SystemPromptItem key={idx} item={item} idx={idx} />
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
