import { useState } from 'react';
import { Badge } from './ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';

function RequestViewer({ entry }) {
  const [expandedSections, setExpandedSections] = useState({
    messages: true,
    tools: false,
    metadata: false,
    full: false,
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const { requestBody, requestQuery, requestHeaders, path, method } = entry;

  return (
    <div className="space-y-4">
      {/* 请求概览 */}
      <div className="flex items-center gap-2">
        <Badge variant="outline">{method}</Badge>
        <code className="text-sm bg-muted px-2 py-1 rounded">{path}</code>
      </div>

      {/* Messages */}
      <Section
        title="Messages"
        count={requestBody?.messages?.length || 0}
        expanded={expandedSections.messages}
        onToggle={() => toggleSection('messages')}
      >
        <JsonView data={requestBody?.messages} />
      </Section>

      {/* Tools */}
      {requestBody?.tools && requestBody.tools.length > 0 && (
        <Section
          title="Tools"
          count={requestBody.tools.length}
          expanded={expandedSections.tools}
          onToggle={() => toggleSection('tools')}
        >
          <JsonView data={requestBody.tools} />
        </Section>
      )}

      {/* Model & Metadata */}
      <Section
        title="模型与参数"
        expanded={expandedSections.metadata}
        onToggle={() => toggleSection('metadata')}
      >
        <div className="space-y-2 text-sm">
          <div className="flex items-baseline gap-2">
            <span className="text-muted-foreground w-24">Model:</span>
            <code className="bg-muted px-2 py-1 rounded">{requestBody?.model}</code>
          </div>
          {requestBody?.max_tokens && (
            <div className="flex items-baseline gap-2">
              <span className="text-muted-foreground w-24">Max Tokens:</span>
              <span>{requestBody.max_tokens}</span>
            </div>
          )}
          {requestBody?.temperature !== undefined && (
            <div className="flex items-baseline gap-2">
              <span className="text-muted-foreground w-24">Temperature:</span>
              <span>{requestBody.temperature}</span>
            </div>
          )}
          {requestBody?.stream && (
            <div className="flex items-baseline gap-2">
              <span className="text-muted-foreground w-24">Stream:</span>
              <Badge variant="outline">enabled</Badge>
            </div>
          )}
        </div>
      </Section>

      {/* Query Parameters */}
      {requestQuery && Object.keys(requestQuery).length > 0 && (
        <Section
          title="Query Parameters"
          count={Object.keys(requestQuery).length}
          expanded={false}
          onToggle={() => toggleSection('query')}
        >
          <JsonView data={requestQuery} />
        </Section>
      )}

      {/* 完整请求体 */}
      <Section
        title="完整请求体 JSON"
        expanded={expandedSections.full}
        onToggle={() => toggleSection('full')}
      >
        <JsonView data={requestBody} />
      </Section>
    </div>
  );
}

function Section({ title, count, expanded, onToggle, children }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <span className="font-medium text-sm">
          {title}
          {count !== undefined && <span className="ml-2 text-muted-foreground">({count})</span>}
        </span>
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

function JsonView({ data }) {
  return (
    <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
      <code>{JSON.stringify(data, null, 2)}</code>
    </pre>
  );
}

export default RequestViewer;
