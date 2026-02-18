import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import RequestViewer from './RequestViewer';
import ResponseViewer from './ResponseViewer';
import { MessageList } from './MessageCard';
import DiffHighlighter from './DiffHighlighter';
import { formatTimestamp, getRoleBadgeClass } from '../lib/utils';

function ContextDetailPanel({ entry, entries }) {
  const [activeTab, setActiveTab] = useState('messages');

  // 找到前一条记录用于对比
  const currentIndex = entry.index;
  const prevEntry = currentIndex > 0 ? entries[currentIndex - 1] : null;

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold">
            请求 #{entry.index + 1}
          </h2>
          <Badge variant={entry.responseStatus >= 200 && entry.responseStatus < 300 ? 'default' : 'destructive'}>
            {entry.responseStatus}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatTimestamp(entry.timestamp)} · {entry.method} {entry.path}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="messages">消息</TabsTrigger>
          <TabsTrigger value="request">请求</TabsTrigger>
          <TabsTrigger value="response">响应</TabsTrigger>
          <TabsTrigger value="diff">差异</TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>对话消息</CardTitle>
              <CardDescription>
                查看 Messages API 的消息结构，理解上下文如何在多轮对话中累积
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MessageList
                messages={entry.requestBody?.messages || []}
                tools={entry.requestBody?.tools || []}
              />
            </CardContent>
          </Card>

          {/* 技术说明 */}
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Messages API 说明</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>role 字段：</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><code>user</code> - 用户消息</li>
                <li><code>assistant</code> - 助手回复（可能包含 tool_use）</li>
                <li><code>system</code> - 系统提示词</li>
              </ul>
              <p className="mt-3"><strong>工具调用流程：</strong></p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>assistant 返回 <code>tool_use</code> 类型的 content</li>
                <li>用户添加 <code>tool_result</code> 消息</li>
                <li>assistant 基于工具结果继续对话</li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="request">
          <Card>
            <CardHeader>
              <CardTitle>请求详情</CardTitle>
              <CardDescription>
                完整的 API 请求结构，包括 messages、tools、model 等参数
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RequestViewer entry={entry} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="response">
          <Card>
            <CardHeader>
              <CardTitle>响应详情</CardTitle>
              <CardDescription>
                API 返回的完整响应数据结构
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponseViewer entry={entry} />
            </CardContent>
          </Card>

          {/* SSE 流式响应说明 */}
          {entry.responseType === 'sse' && (
            <Card className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 mt-4">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  SSE 流式响应说明
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>这是 <strong>Server-Sent Events (SSE)</strong> 流式响应格式。</p>
                <p className="mt-2"><strong>事件流程：</strong></p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li><code className="text-xs">message_start</code> - 初始化消息，包含 message id 和角色</li>
                  <li><code className="text-xs">content_block_start</code> - 开始一个内容块（text 或 tool_use）</li>
                  <li><code className="text-xs">content_block_delta</code> - 增量添加内容（可以多次）</li>
                  <li><code className="text-xs">content_block_stop</code> - 内容块结束</li>
                  <li><code className="text-xs">message_delta</code> - 消息结束，包含准确的使用量统计</li>
                  <li><code className="text-xs">message_stop</code> - 流完全结束</li>
                </ol>
                <p className="mt-2"><strong>优势：</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>实时显示生成内容，改善用户体验</li>
                  <li>减少首字节时间（Time to First Token）</li>
                  <li><code className="text-xs">message_delta</code> 提供准确的 Token 计数</li>
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="diff">
          <Card>
            <CardHeader>
              <CardTitle>上下文变化</CardTitle>
              <CardDescription>
                对比上一轮对话，高亮显示新增的消息和内容
              </CardDescription>
            </CardHeader>
            <CardContent>
              {prevEntry ? (
                <DiffHighlighter
                  prevMessages={prevEntry.requestBody?.messages || []}
                  currentMessages={entry.requestBody?.messages || []}
                  prevTools={prevEntry.requestBody?.tools || []}
                  currentTools={entry.requestBody?.tools || []}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  这是第一条记录，没有前序数据可以对比。
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ContextDetailPanel;
