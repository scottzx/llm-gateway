import { getRoleBadgeClass, isToolUseMessage, isToolResultMessage, isTextMessage, isImageMessage } from '../lib/utils';
import { Badge } from './ui/badge';
import { Code, Image as ImageIcon, FileText } from 'lucide-react';
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
            <ContentBlock key={idx} block={block} />
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

function ContentBlock({ block }) {
  if (isTextMessage(block)) {
    return (
      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />
          <span className="text-sm font-medium text-green-800 dark:text-green-200">
            文本内容
          </span>
        </div>
        <div className="text-sm whitespace-pre-wrap break-words text-green-900 dark:text-green-100">
          {block.text}
        </div>
      </div>
    );
  }

  if (isToolUseMessage(block)) {
    return (
      <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
        <div className="flex items-center gap-2 mb-2">
          <Code className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="font-mono text-sm font-medium text-purple-800 dark:text-purple-200">
            tool_use: {block.name}
          </span>
        </div>
        {block.input && (
          <pre className="text-xs overflow-x-auto bg-purple-100 dark:bg-purple-900/40 p-2 rounded mt-2">
            {JSON.stringify(block.input, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  if (isToolResultMessage(block)) {
    return (
      <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
        <div className="flex items-center gap-2 mb-2">
          <Code className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          <span className="font-mono text-sm font-medium text-orange-800 dark:text-orange-200">
            tool_result: {block.tool_use_id}
          </span>
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
      </div>
    );
  }

  if (isImageMessage(block)) {
    return (
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
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
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-muted rounded-lg">
      <pre className="text-xs overflow-x-auto">
        {JSON.stringify(block, null, 2)}
      </pre>
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
