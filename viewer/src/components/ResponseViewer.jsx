import { useState } from 'react';
import { Badge } from './ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';

function ResponseViewer({ entry }) {
  const [expandedSections, setExpandedSections] = useState({
    content: true,
    metadata: false,
    full: false,
    sse: false,
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const { responseBody, responseHeaders, responseStatus, duration, responseType, sseData } = entry;

  return (
    <div className="space-y-4">
      {/* 响应概览 */}
      <div className="flex items-center gap-3">
        <Badge
          variant={responseStatus >= 200 && responseStatus < 300 ? 'default' : 'destructive'}
        >
          {responseStatus}
        </Badge>
        {duration && (
          <span className="text-sm text-muted-foreground">
            {duration}ms
          </span>
        )}
      </div>

      {/* 响应类型标识 */}
      {responseType && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {responseType === 'sse' ? 'SSE 流式响应' : responseType === 'json' ? 'JSON 响应' : '原始响应'}
          </Badge>
          {responseType === 'sse' && sseData?.inputTokens > 0 && (
            <span className="text-xs text-muted-foreground">
              Input: {sseData.inputTokens} tokens · Output: {sseData.outputTokens} tokens
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <Section
        title="响应内容"
        expanded={expandedSections.content}
        onToggle={() => toggleSection('content')}
      >
        {responseType === 'sse' ? (
          <SSEResponseViewer sseData={sseData} />
        ) : (
          <ResponseContent content={responseBody} />
        )}
      </Section>

      {/* Metadata */}
      <Section
        title="响应元数据"
        expanded={expandedSections.metadata}
        onToggle={() => toggleSection('metadata')}
      >
        <div className="space-y-2 text-sm">
          {responseType === 'sse' ? (
            // SSE 流式响应元数据
            <>
              {sseData?.inputTokens > 0 && (
                <div className="flex items-baseline gap-2">
                  <span className="text-muted-foreground w-32">Input Tokens:</span>
                  <Badge variant="secondary">{sseData.inputTokens}</Badge>
                </div>
              )}
              {sseData?.outputTokens > 0 && (
                <div className="flex items-baseline gap-2">
                  <span className="text-muted-foreground w-32">Output Tokens:</span>
                  <Badge variant="secondary">{sseData.outputTokens}</Badge>
                </div>
              )}
              {sseData?.contentBlocks && sseData.contentBlocks.length > 0 && (
                <div className="flex items-baseline gap-2">
                  <span className="text-muted-foreground w-32">Content Blocks:</span>
                  <span>{sseData.contentBlocks.length}</span>
                </div>
              )}
              {sseData?.events && (
                <div className="flex items-baseline gap-2">
                  <span className="text-muted-foreground w-32">Events Count:</span>
                  <span>{sseData.events.length}</span>
                </div>
              )}
            </>
          ) : (
            // JSON 响应元数据
            <>
              {responseBody?.id && (
                <div className="flex items-baseline gap-2">
                  <span className="text-muted-foreground w-24">ID:</span>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{responseBody.id}</code>
                </div>
              )}
              {responseBody?.type && (
                <div className="flex items-baseline gap-2">
                  <span className="text-muted-foreground w-24">Type:</span>
                  <span>{responseBody.type}</span>
                </div>
              )}
              {responseBody?.role && (
                <div className="flex items-baseline gap-2">
                  <span className="text-muted-foreground w-24">Role:</span>
                  <Badge variant="outline">{responseBody.role}</Badge>
                </div>
              )}
              {responseBody?.model && (
                <div className="flex items-baseline gap-2">
                  <span className="text-muted-foreground w-24">Model:</span>
                  <span>{responseBody.model}</span>
                </div>
              )}
              {responseBody?.stop_reason && (
                <div className="flex items-baseline gap-2">
                  <span className="text-muted-foreground w-24">Stop Reason:</span>
                  <Badge variant="outline">{responseBody.stop_reason}</Badge>
                </div>
              )}
            </>
          )}
        </div>
      </Section>

      {/* 完整响应体 */}
      <Section
        title={responseType === 'sse' ? '原始 SSE 文本' : '完整响应体 JSON'}
        expanded={expandedSections.full}
        onToggle={() => toggleSection('full')}
      >
        <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
          <code>
            {responseType === 'sse' ? responseBody : JSON.stringify(responseBody, null, 2)}
          </code>
        </pre>
      </Section>

      {/* Response Headers */}
      {responseHeaders && Object.keys(responseHeaders).length > 0 && (
        <Section
          title="响应头"
          expanded={false}
          onToggle={() => toggleSection('headers')}
        >
          <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
            <code>{JSON.stringify(responseHeaders, null, 2)}</code>
          </pre>
        </Section>
      )}
    </div>
  );
}

function Section({ title, expanded, onToggle, children }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <span className="font-medium text-sm">{title}</span>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <div className="p-4 bg-background">
          {children}
        </div>
      )}
    </div>
  );
}

function ResponseContent({ content }) {
  if (!content) {
    return <p className="text-sm text-muted-foreground">无响应内容</p>;
  }

  // 处理 Anthropic Messages API 响应格式
  if (content.content) {
    return (
      <div className="space-y-3">
        {Array.isArray(content.content) ? (
          content.content.map((block, idx) => (
            <ContentBlock key={idx} block={block} />
          ))
        ) : (
          <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
            {JSON.stringify(content.content, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  // 通用 JSON 渲染
  return (
    <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
      <code>{JSON.stringify(content, null, 2)}</code>
    </pre>
  );
}

function ContentBlock({ block }) {
  if (block.type === 'text') {
    return (
      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-green-700 dark:text-green-300">
            TEXT
          </span>
        </div>
        <div className="text-sm whitespace-pre-wrap">
          {block.text}
        </div>
      </div>
    );
  }

  if (block.type === 'tool_use') {
    return (
      <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
            TOOL_USE
          </span>
          <code className="text-xs">{block.name}</code>
        </div>
        {block.input && (
          <pre className="text-xs bg-purple-100 dark:bg-purple-900/40 p-2 rounded mt-2 overflow-x-auto">
            {JSON.stringify(block.input, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  return (
    <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
      {JSON.stringify(block, null, 2)}
    </pre>
  );
}

// SSE 流式响应查看器
function SSEResponseViewer({ sseData }) {
  if (!sseData) {
    return <p className="text-sm text-muted-foreground">无 SSE 数据</p>;
  }

  const { events, contentBlocks } = sseData;

  // 按事件类型分组
  const eventsByType = events.reduce((acc, event) => {
    if (!acc[event.type]) {
      acc[event.type] = [];
    }
    acc[event.type].push(event);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* 重建的内容块 - 这是从 SSE 事件流重建的完整内容 */}
      {contentBlocks && contentBlocks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            重建的内容块 (从 SSE 流事件重建):
          </p>
          {contentBlocks.map((block, idx) => (
            <ContentBlock key={idx} block={block} />
          ))}
        </div>
      )}

      {/* SSE 事件时间轴 - 可折叠 */}
      <details className="group">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground list-none flex items-center gap-2">
          <span>▼</span>
          <span>SSE 事件流 ({events.length} 个事件)</span>
        </summary>
        <div className="mt-2 space-y-1 pl-4 border-l-2 border-muted">
          {events.slice(0, 50).map((event, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs py-1">
              <span className="font-mono text-blue-600 dark:text-blue-400 w-36 shrink-0">
                {event.type}:
              </span>
              <span className="text-muted-foreground break-all">
                {JSON.stringify(event.data)}
              </span>
            </div>
          ))}
          {events.length > 50 && (
            <p className="text-xs text-muted-foreground italic">
              ... 还有 {events.length - 50} 个事件
            </p>
          )}
        </div>
      </details>

      {/* 按类型统计 */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {Object.entries(eventsByType).map(([type, typeEvents]) => (
          <div key={type} className="flex items-center gap-2 p-2 bg-muted rounded">
            <span className="font-medium">{type}</span>
            <Badge variant="secondary">{typeEvents.length}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ResponseViewer;
