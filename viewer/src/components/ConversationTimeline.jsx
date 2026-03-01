import { formatTimestamp, formatDuration, getStatusColor, cn } from '../lib/utils';
import { MessageSquare, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

function ConversationTimeline({ entries, selectedEntry, onEntrySelect }) {
  return (
    <div className="p-4 space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
        对话轮次 ({entries.length})
      </h2>

      {entries.map((entry, index) => {
        const isSelected = selectedEntry?.index === entry.index;
        const statusIcon = getStatusIcon(entry.responseStatus);

        return (
          <button
            key={entry.id || entry.index}
            onClick={() => onEntrySelect(entry)}
            className={cn(
              'w-full text-left p-3 rounded-lg transition-all hover:bg-accent',
              isSelected && 'bg-accent ring-2 ring-primary/20',
              entry.isNewConversation && 'mt-4 pt-4 border-t border-border'
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium',
                  isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}>
                  {index + 1}
                </span>
                <span className="text-xs font-medium truncate max-w-[150px]">
                  {entry.path}
                </span>
              </div>
              <span className={cn('text-sm', getStatusColor(entry.responseStatus))}>
                {statusIcon}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{formatTimestamp(entry.timestamp)}</span>
              </div>

              {entry.duration > 0 && (
                <div className="text-xs text-muted-foreground">
                  耗时: {formatDuration(entry.duration)}
                </div>
              )}

              {entry.inputTokens !== undefined && (
                <div className="text-xs text-muted-foreground">
                  输入: ~{entry.inputTokens} tokens
                  {entry.outputTokens && ` / 输出: ~${entry.outputTokens} tokens`}
                </div>
              )}

              {entry.requestBody?.messages && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageSquare className="w-3 h-3" />
                  <span>{entry.requestBody.messages.length} 条消息</span>
                </div>
              )}
            </div>

            {entry.isNewConversation && (
              <div className="mt-2 pt-2 border-t border-border">
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                  新对话
                </span>
              </div>
            )}

            {/* SSE 流式响应标识 */}
            {entry.responseType === 'sse' && (
              <div className="mt-1">
                <span className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded flex items-center gap-1 w-fit">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  流式响应
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function getStatusIcon(status) {
  if (status >= 200 && status < 300) {
    return <CheckCircle2 className="w-4 h-4" />;
  }
  if (status >= 400 && status < 500) {
    return <AlertTriangle className="w-4 h-4" />;
  }
  if (status >= 500) {
    return <XCircle className="w-4 h-4" />;
  }
  return null;
}

export default ConversationTimeline;
