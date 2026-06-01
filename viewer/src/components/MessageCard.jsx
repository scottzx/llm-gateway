import { getRoleBadgeClass, isToolUseMessage, isToolResultMessage, isTextMessage, isImageMessage } from '../lib/utils';
import { Badge } from './ui/badge';
import { 
  Code, 
  Image as ImageIcon, 
  FileText, 
  Languages, 
  Undo2, 
  Loader2, 
  User, 
  Cpu, 
  Settings, 
  Wrench, 
  CheckCircle, 
  Brain, 
  Play, 
  Copy, 
  Terminal, 
  AlertTriangle, 
  CornerDownRight, 
  ChevronDown, 
  ChevronUp,
  ExternalLink,
  WrapText
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import ToolInfoDialog from './ToolInfoDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from './ui/dialog';
import { marked, Marked } from 'marked';

// 自定义 HTML 渲染器，防止自定义 XML/HTML 标签 (如 <msg>, <intent> 等) 被浏览器作为 DOM 节点解析隐藏
const customRenderer = {
  html(token) {
    const text = typeof token === 'string' ? token : (token.text || '');
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
};

const customMarked = new Marked();
customMarked.use({ renderer: customRenderer });

// 智能转义代码块/行内代码外的自定义 XML/HTML 标签，以在 Markdown 渲染时完美保留换行与后续解析
function escapeXmlOutsideCode(text) {
  if (!text || typeof text !== 'string') return '';
  
  // 1. 按代码块 (```) 切分
  const parts = text.split(/(```[\s\S]*?```)/g);
  
  return parts.map((part, index) => {
    // 奇数项在代码块内，保持原样
    if (index % 2 === 1) {
      return part;
    }
    
    // 偶数项在代码块外，需要进一步按行内代码 (`) 切分
    const inlineParts = part.split(/(`[^`\n]*?`)/g);
    return inlineParts.map((inlinePart, inlineIndex) => {
      // 奇数项在行内代码内，保持原样
      if (inlineIndex % 2 === 1) {
        return inlinePart;
      }
      
      // 偶数项在纯文本中，安全转义 HTML/XML 关键字符
      return inlinePart
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }).join('');
  }).join('');
}

/**
 * 极简精致的“复制按钮”组件，带 1.5s 状态恢复
 */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      const content = typeof text === 'object' ? JSON.stringify(text, null, 2) : text;
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 hover:bg-background border rounded-lg transition-all text-muted-foreground hover:text-foreground shrink-0 flex items-center justify-center bg-card shadow-sm"
      title="复制内容"
    >
      {copied ? (
        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

/**
 * 专为智能体日志打造的高颜值、支持暗黑模式的 Markdown 安全渲染器
 * 支持代码块自动换行、手动换行切换 (Word-Wrap Toggle) 以及代码独立复制
 */
function Markdown({ content, className = '' }) {
  const containerRef = useRef(null);

  if (!content) return null;

  let rawHtml = '';
  try {
    // 智能转义并保留普通文字的换行效果与标准 Markdown 元素解析
    const escapedContent = escapeXmlOutsideCode(content);
    rawHtml = customMarked.parse(escapedContent, {
      gfm: true,
      breaks: true
    });
  } catch (err) {
    console.error('[Markdown] Parsing failed: ', err);
    rawHtml = content;
  }

  // 利用 React useEffect 动态扫描渲染出的代码 pre 容器，动态挂载换行及复制面板
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const pres = container.querySelectorAll('pre');
    pres.forEach((pre) => {
      // 避免重复追加面板
      if (pre.querySelector('.code-toolbar')) return;

      // 1. 设置 pre 容器布局样式类（默认自动换行）
      pre.classList.add('relative', 'group/pre', 'whitespace-pre-wrap', 'break-all');

      // 2. 获取代码内容
      const codeEl = pre.querySelector('code');
      const codeText = codeEl ? codeEl.innerText : pre.innerText;

      // 3. 创建顶层浮动控制栏
      const toolbar = document.createElement('div');
      toolbar.className = 'code-toolbar absolute right-2.5 top-2.5 z-20 flex items-center gap-1.5 opacity-0 group-hover/pre:opacity-100 transition-opacity duration-200 select-none';

      // 4. 定义统一极客暗色自适应按钮类名
      const btnDefaultClass = 'p-1.5 border rounded-lg transition-all shadow-sm flex items-center justify-center bg-zinc-900/80 text-zinc-400 border-zinc-700/50 hover:text-zinc-200 hover:bg-zinc-800';
      const btnActiveClass = 'p-1.5 border rounded-lg transition-all shadow-sm flex items-center justify-center bg-primary/20 text-primary border-primary/30';

      // 5. 创建换行开关按钮
      const wrapBtn = document.createElement('button');
      wrapBtn.className = btnActiveClass;
      wrapBtn.title = '切换自动换行 (Word Wrap)';
      wrapBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wrap-text"><line x1="3" x2="21" y1="6" y2="6"/><path d="M3 12h15a3 3 0 1 1 0 6h-4m-2-2-2 2 2 2"/><line x1="3" x2="10" y1="18" y2="18"/></svg>
      `;

      let isWrapped = true;
      wrapBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isWrapped = !isWrapped;

        if (isWrapped) {
          pre.classList.remove('whitespace-pre', 'overflow-x-auto');
          pre.classList.add('whitespace-pre-wrap', 'break-all');
          wrapBtn.className = btnActiveClass;
        } else {
          pre.classList.remove('whitespace-pre-wrap', 'break-all');
          pre.classList.add('whitespace-pre', 'overflow-x-auto');
          wrapBtn.className = btnDefaultClass;
        }
      });

      // 6. 创建独立复制代码按钮
      const copyBtn = document.createElement('button');
      copyBtn.className = btnDefaultClass;
      copyBtn.title = '复制当前代码';
      copyBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
      `;

      copyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(codeText);
          copyBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-circle text-green-550"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          `;
          setTimeout(() => {
            copyBtn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            `;
          }, 1500);
        } catch (err) {
          console.error(err);
        }
      });

      // 6. 装配控制栏
      toolbar.appendChild(wrapBtn);
      toolbar.appendChild(copyBtn);
      pre.appendChild(toolbar);
    });
  }, [rawHtml]);

  return (
    <div
      ref={containerRef}
      className={`prose-custom select-all break-words leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: rawHtml }}
    />
  );
}

/**
 * 专为超长提示词/动态指令设计的精美 Dialog 详情弹窗
 * 内置独立一键翻译和复制交互，支持华丽的 Markdown 排版
 */
function TextDetailDialog({ title, icon, text, open, onOpenChange }) {
  const [translationState, setTranslationState] = useState({
    isTranslated: false,
    isLoading: false,
    error: null,
    translatedText: '',
    fromCache: false
  });

  const handleTranslate = async () => {
    if (translationState.isLoading) return;
    if (translationState.isTranslated) {
      setTranslationState(prev => ({ ...prev, isTranslated: false }));
      return;
    }

    setTranslationState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const block = { type: 'text', text: text };
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
      console.error('[TextDetailDialog] Translation failed', err);
      alert(`翻译失败：${err.message}`);
      setTranslationState(prev => ({ ...prev, isLoading: false, error: err.message }));
    }
  };

  const displayText = translationState.isTranslated ? translationState.translatedText : text;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-6 rounded-3xl overflow-hidden border border-border bg-card shadow-2xl">
        <DialogClose />
        <DialogHeader className="flex flex-row items-center justify-between border-b pb-4 shrink-0 pr-8">
          <DialogTitle className="flex items-center gap-2 text-base font-bold select-none text-foreground">
            {icon}
            <span>{title}</span>
          </DialogTitle>
          <div className="flex items-center gap-2">
            {translationState.isTranslated && translationState.fromCache && (
              <Badge variant="secondary" className="text-[10px] scale-90">来自缓存</Badge>
            )}
            <button
              onClick={handleTranslate}
              disabled={translationState.isLoading}
              className="p-1.5 hover:bg-muted border rounded-lg disabled:opacity-50 flex items-center justify-center bg-card shadow-sm text-muted-foreground hover:text-foreground transition-colors"
              title={translationState.isTranslated ? "显示原文" : "翻译内容"}
            >
              {translationState.isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : translationState.isTranslated ? (
                <Undo2 className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <Languages className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
              )}
            </button>
            <CopyButton text={displayText} />
          </div>
        </DialogHeader>

        {/* 弹窗内容：支持纵向流畅滚动的 Markdown 极客文本区 */}
        <div className="flex-1 overflow-y-auto pr-2 mt-4 scrollbar-thin select-all">
          <Markdown content={displayText} className="text-xs md:text-sm text-foreground" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 格式化参数值（处理复杂的 JSON 对象/数组，支持手动切换换行）
 */
function FormatParamValue({ value }) {
  const [wordWrap, setWordWrap] = useState(true); // 默认开启自动换行

  if (value === null) return <span className="text-muted-foreground font-mono text-xs">null</span>;
  if (value === undefined) return <span className="text-muted-foreground font-mono text-xs">undefined</span>;

  if (typeof value === 'object') {
    return (
      <div className="relative group/code mt-1 rounded-lg overflow-hidden border border-zinc-800">
        <div className="absolute right-2 top-2 z-10 opacity-0 group-hover/code:opacity-100 transition-opacity flex items-center gap-1.5">
          {/* 自动换行开关按钮 */}
          <button
            onClick={() => setWordWrap(!wordWrap)}
            className={`p-1.5 border rounded-lg transition-all shrink-0 flex items-center justify-center shadow-sm ${
              wordWrap 
                ? 'bg-primary/20 text-primary border-primary/30' 
                : 'bg-zinc-900/80 text-zinc-400 border-zinc-700/50 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
            title="切换自动换行"
          >
            <WrapText className="w-3.5 h-3.5" />
          </button>
          <CopyButton text={value} />
        </div>
        <pre className={`text-[11px] font-mono bg-zinc-950 text-zinc-300 p-3 px-4 overflow-x-auto max-h-40 max-w-full scrollbar-thin select-all transition-all duration-200 border border-zinc-800 rounded-xl ${
          wordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
        }`}>
          {JSON.stringify(value, null, 2)}
        </pre>
      </div>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${value ? 'bg-green-500/10 text-green-600 dark:bg-green-900/30' : 'bg-red-500/10 text-red-600 dark:bg-red-900/30'}`}>
        {value ? 'true' : 'false'}
      </span>
    );
  }

  return <span className="font-mono text-xs select-all text-foreground break-all">{value.toString()}</span>;
}

/**
 * 系统提示词单项组件（支持 Markdown 预览与弹窗详情模式）
 */
function SystemPromptItem({ item, idx }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const isLong = item.text && item.text.length > 200;
  const showText = isLong ? `${item.text.substring(0, 200)}...` : item.text;

  return (
    <div className="p-3.5 bg-muted/40 dark:bg-muted/15 rounded-xl border border-border/80 group relative transition-all hover:bg-muted/60 dark:hover:bg-muted/20 hover:shadow-sm duration-200 border-l-4 border-l-slate-400">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5 text-slate-500" />
          系统指令设定 #{idx + 1}
          {item.text && (
            <span className="text-[10px] text-muted-foreground/60 font-normal">
              ({item.text.length} 字符)
            </span>
          )}
        </span>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButton text={item.text} />
        </div>
      </div>
      
      {/* 预览区域同样地经过 Markdown 渲染 */}
      <Markdown content={showText} className="text-xs text-muted-foreground leading-relaxed" />
      
      {isLong && (
        <>
          <button
            onClick={() => setIsDialogOpen(true)}
            className="text-[10px] text-primary hover:underline mt-2.5 font-bold flex items-center gap-1.5 bg-primary/5 hover:bg-primary/10 px-2 py-0.5 rounded transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> 查看完整提示词
          </button>
          <TextDetailDialog
            title={`系统指令设定 #${idx + 1}`}
            icon={<Settings className="w-4 h-4 text-slate-500 animate-spin-slow" />}
            text={item.text}
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
          />
        </>
      )}
    </div>
  );
}

/**
 * 独立的普通文本消息渲染卡片（全面支持 Markdown、一键翻译和复制）
 */
function PlainTextBlock({ text, bgClass, borderClass, accentBorder, iconColor, titleClass, contentClass }) {
  const [translationState, setTranslationState] = useState({
    isTranslated: false,
    isLoading: false,
    error: null,
    translatedText: '',
    fromCache: false
  });

  const handleTranslate = async () => {
    if (translationState.isLoading) return;
    if (translationState.isTranslated) {
      setTranslationState(prev => ({ ...prev, isTranslated: false }));
      return;
    }

    setTranslationState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const block = { type: 'text', text };
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
      console.error('[PlainTextBlock] Translation failed', err);
      alert(`翻译失败：${err.message}`);
      setTranslationState(prev => ({ ...prev, isLoading: false, error: err.message }));
    }
  };

  const displayText = translationState.isTranslated ? translationState.translatedText : text;

  return (
    <div className={`p-4 ${bgClass} rounded-2xl border ${borderClass} ${accentBorder} group relative transition-all duration-300 hover:shadow-md hover:-translate-y-0.5`}>
      <div className="flex items-center gap-2 mb-2.5">
        <FileText className={`w-4 h-4 ${iconColor}`} />
        <span className={`text-xs font-bold ${titleClass}`}>
          {translationState.isTranslated ? '译文' : '文本内容'}
        </span>
        {translationState.isTranslated && translationState.fromCache && (
          <Badge variant="secondary" className="text-[10px] scale-90">来自缓存</Badge>
        )}
        <div className="ml-auto flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
          <button
            onClick={handleTranslate}
            disabled={translationState.isLoading}
            className="p-1.5 hover:bg-background border rounded-lg disabled:opacity-50 flex items-center justify-center bg-card shadow-sm"
            title={translationState.isTranslated ? "显示原文" : "翻译内容"}
          >
            {translationState.isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : translationState.isTranslated ? (
              <Undo2 className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <Languages className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            )}
          </button>
          <CopyButton text={displayText} />
        </div>
      </div>
      
      {/* 划时代地将纯文本直接升级为 Premium Markdown 渲染 */}
      <Markdown content={displayText} className={`text-xs md:text-sm select-all ${contentClass}`} />
    </div>
  );
}

/**
 * 独立的系统动态提醒卡片（System Reminder Block - 支持 Markdown 预览与弹窗详情模式）
 */
function SystemReminderBlock({ text }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const isLong = text && text.length > 250;
  const showText = isLong ? `${text.substring(0, 250)}...` : text;

  return (
    <div className="p-4 bg-gradient-to-r from-cyan-50/20 to-cyan-50/5 dark:from-cyan-950/5 dark:to-cyan-950/2 rounded-2xl border border-cyan-100/60 dark:border-cyan-900/30 border-l-4 border-l-cyan-400/80 group relative transition-all duration-300 hover:shadow-md">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          {/* 青色闪烁脉冲呼吸灯 */}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          <span className="text-xs font-bold text-cyan-900/90 dark:text-cyan-300 flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5 text-cyan-500 animate-spin-slow" />
            系统动态指令 (System Reminder)
          </span>
          {text && (
            <span className="text-[9px] text-cyan-600/70 dark:text-cyan-400/50 font-mono bg-cyan-100/30 dark:bg-cyan-900/20 px-1.5 py-0.5 rounded">
              {text.length} 字符
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <CopyButton text={text} />
        </div>
      </div>

      {/* 原位预览同样渲染成漂亮的 Markdown 结构 */}
      <Markdown content={showText} className="text-xs font-mono text-cyan-800/90 dark:text-cyan-300/90 pl-1" />

      {isLong && (
        <>
          <button
            onClick={() => setIsDialogOpen(true)}
            className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline mt-2.5 font-bold flex items-center gap-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 px-2 py-0.5 rounded transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> 查看完整指令
          </button>
          <TextDetailDialog
            title="系统动态指令 (System Reminder)"
            icon={
              <span className="relative flex h-3 w-3 select-none">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </span>
            }
            text={text}
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
          />
        </>
      )}
    </div>
  );
}

/**
 * 智能解析并分流渲染带有 <system-reminder> 标签的文本组件
 */
function RenderTextBlocks({ text, role }) {
  if (!text) return null;

  if (typeof text !== 'string') {
    return <div className="text-sm whitespace-pre-wrap leading-relaxed">{String(text)}</div>;
  }

  // 1. 无标签情况：直接走标准 PlainTextBlock
  if (!text.includes('<system-reminder>')) {
    const isUser = role === 'user';
    const bgClass = isUser 
      ? 'bg-gradient-to-r from-blue-50/50 to-blue-50/10 dark:from-blue-950/10 dark:to-blue-950/2' 
      : 'bg-gradient-to-r from-green-50/50 to-green-50/10 dark:from-green-950/10 dark:to-green-950/2';
    const borderClass = isUser ? 'border-blue-100 dark:border-blue-900/50' : 'border-green-100 dark:border-green-900/50';
    const accentBorder = isUser ? 'border-l-4 border-l-blue-400 dark:border-l-blue-500' : 'border-l-4 border-l-emerald-400 dark:border-l-emerald-500';
    const iconColor = isUser ? 'text-blue-500' : 'text-emerald-500';
    const titleClass = isUser ? 'text-blue-800 dark:text-blue-300' : 'text-green-800 dark:text-green-300';
    const contentClass = isUser ? 'text-blue-950 dark:text-blue-100' : 'text-green-950 dark:text-green-100';

    return (
      <PlainTextBlock 
        text={text} 
        bgClass={bgClass} 
        borderClass={borderClass} 
        accentBorder={accentBorder} 
        iconColor={iconColor} 
        titleClass={titleClass} 
        contentClass={contentClass}
      />
    );
  }

  // 2. 有标签情况：开始提取标签，将文本按标签切成数组块
  const regex = /<system-reminder>([\s\S]*?)<\/system-reminder>/g;
  const blocks = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const partText = text.substring(lastIndex, match.index).trim();
      if (partText) {
        blocks.push({ type: 'plain', text: partText });
      }
    }
    blocks.push({ type: 'reminder', text: match[1].trim() });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    const partText = text.substring(lastIndex).trim();
    if (partText) {
      blocks.push({ type: 'plain', text: partText });
    }
  }

  return (
    <div className="space-y-3.5">
      {blocks.map((block, i) => {
        if (block.type === 'reminder') {
          return <SystemReminderBlock key={i} text={block.text} />;
        } else {
          const isUser = role === 'user';
          const bgClass = isUser 
            ? 'bg-gradient-to-r from-blue-50/50 to-blue-50/10 dark:from-blue-950/10 dark:to-blue-950/2' 
            : 'bg-gradient-to-r from-green-50/50 to-green-50/10 dark:from-green-950/10 dark:to-green-950/2';
          const borderClass = isUser ? 'border-blue-100 dark:border-blue-900/50' : 'border-green-100 dark:border-green-900/50';
          const accentBorder = isUser ? 'border-l-4 border-l-blue-400 dark:border-l-blue-500' : 'border-l-4 border-l-emerald-400 dark:border-l-emerald-500';
          const iconColor = isUser ? 'text-blue-500' : 'text-emerald-500';
          const titleClass = isUser ? 'text-blue-800 dark:text-blue-300' : 'text-green-800 dark:text-green-300';
          const contentClass = isUser ? 'text-blue-950 dark:text-blue-100' : 'text-green-950 dark:text-green-100';

          return (
            <PlainTextBlock 
              key={i} 
              text={block.text} 
              bgClass={bgClass} 
              borderClass={borderClass} 
              accentBorder={accentBorder} 
              iconColor={iconColor} 
              titleClass={titleClass} 
              contentClass={contentClass}
            />
          );
        }
      })}
    </div>
  );
}

/**
 * 精美的内容块渲染组件
 */
function ContentBlock({ block, role }) {
  const [translationState, setTranslationState] = useState({
    isTranslated: false,
    isLoading: false,
    error: null,
    translatedText: '',
    fromCache: false
  });

  const [thinkingExpanded, setThinkingExpanded] = useState(true);

  // 翻译处理
  const handleTranslate = async () => {
    if (translationState.isLoading) return;
    if (translationState.isTranslated) {
      setTranslationState(prev => ({ ...prev, isTranslated: false }));
      return;
    }

    setTranslationState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
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
      console.error('[ContentBlock] Translation failed', err);
      alert(`翻译失败：${err.message}`);
      setTranslationState(prev => ({ ...prev, isLoading: false, error: err.message }));
    }
  };

  const renderTranslateButton = () => (
    <button
      onClick={handleTranslate}
      disabled={translationState.isLoading}
      className="p-1.5 hover:bg-background border rounded-lg disabled:opacity-50 flex items-center justify-center bg-card shadow-sm"
      title={translationState.isTranslated ? "显示原文" : "翻译内容"}
    >
      {translationState.isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : translationState.isTranslated ? (
        <Undo2 className="w-3.5 h-3.5 text-muted-foreground" />
      ) : (
        <Languages className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
      )}
    </button>
  );

  // 1. 文本内容块 (TEXT) - 内部支持动态指令提取与 Markdown 渲染
  if (isTextMessage(block)) {
    return <RenderTextBlocks text={block.text} role={role} />;
  }

  // 2. 思考过程块 (THINKING)
  if (block.type === 'thinking') {
    const displayText = translationState.isTranslated ? translationState.translatedText : block.thinking;

    return (
      <div className="p-4 bg-gradient-to-r from-zinc-50/60 to-zinc-50/20 dark:from-zinc-900/10 dark:to-zinc-900/2 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/40 border-l-4 border-l-zinc-400 dark:border-l-zinc-600 group relative transition-all duration-300 hover:shadow-md">
        <div className="flex items-center justify-between mb-2">
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => setThinkingExpanded(!thinkingExpanded)}
          >
            <Brain className="w-4 h-4 text-zinc-400 dark:text-zinc-500 animate-pulse" />
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              深度思考与推理过程 (Reasoning)
            </span>
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-normal">
              ({thinkingExpanded ? '点击收起' : '点击展开'})
            </span>
          </div>
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {renderTranslateButton()}
            {translationState.isTranslated && translationState.fromCache && (
              <Badge variant="secondary" className="text-[10px] scale-90">来自缓存</Badge>
            )}
            <CopyButton text={displayText} />
          </div>
        </div>

        {/* 思考推理过程现在同样支持精美的 Markdown 高级渲染 */}
        {thinkingExpanded && (
          <Markdown 
            content={displayText} 
            className="text-xs md:text-sm text-zinc-650 dark:text-zinc-300 font-sans pl-3.5 border-l-2 border-zinc-200/40 dark:border-zinc-800/30 mt-2.5" 
          />
        )}
      </div>
    );
  }

  // 3. 工具调用块 (TOOL USE)
  if (isToolUseMessage(block)) {
    const inputs = block.input || {};
    const hasParams = Object.keys(inputs).length > 0;

    return (
      <div className="p-4 bg-indigo-50/30 dark:bg-indigo-950/10 rounded-2xl border border-indigo-200/40 dark:border-indigo-900/30 border-l-4 border-l-indigo-400 group relative transition-all duration-300 hover:shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-indigo-500 fill-indigo-500" />
            <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
              触发工具调用 (Tool Call)
            </span>
            <code className="text-[11px] font-mono bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-200/50">
              {block.name}
            </code>
          </div>
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <CopyButton text={inputs} />
          </div>
        </div>

        {/* 完美呼应用户称赞的极高颜值参数卡片 */}
        {hasParams ? (
          <div className="space-y-2 mt-3">
            <p className="text-[10px] font-bold text-indigo-600/80 dark:text-indigo-400/80 uppercase tracking-wider pl-1">
              调用入参列表 (Arguments)
            </p>
            <div className="grid gap-2">
              {Object.entries(inputs).map(([paramName, paramVal]) => (
                <div 
                  key={paramName} 
                  className="p-3 bg-muted/40 dark:bg-muted/15 rounded-xl border border-indigo-100/50 dark:border-indigo-900/30 relative overflow-hidden transition-all duration-200 hover:bg-muted/60 dark:hover:bg-muted/20"
                >
                  {/* 侧边小彩条，代表输入参数的方向 */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-400/70"></div>
                  
                  <div className="pl-2 flex items-center justify-between gap-4 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <CornerDownRight className="w-3 h-3 text-indigo-400" />
                      <code className="text-xs font-bold font-mono text-indigo-800 dark:text-indigo-300 select-all">
                        {paramName}
                      </code>
                      <Badge variant="outline" className="text-[9px] py-0 font-normal scale-90 origin-left text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20">
                        {typeof paramVal}
                      </Badge>
                    </div>
                  </div>
                  <div className="pl-6 w-full overflow-hidden">
                    <FormatParamValue value={paramVal} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-indigo-500/70 dark:text-indigo-400/70 italic pl-1">
            无附加调用参数 (No Arguments)
          </p>
        )}
      </div>
    );
  }

  // 4. 工具执行结果块 (TOOL RESULT)
  if (isToolResultMessage(block)) {
    const displayContent = translationState.isTranslated ? translationState.translatedText : block.content;
    const isJson = typeof displayContent === 'object' || (typeof displayContent === 'string' && (displayContent.trim().startsWith('{') || displayContent.trim().startsWith('[')));

    return (
      <div className="p-4 bg-gradient-to-r from-amber-50/20 to-amber-50/5 dark:from-amber-950/5 dark:to-amber-950/2 rounded-2xl border border-amber-100/60 dark:border-amber-900/30 border-l-4 border-l-amber-400/80 group relative transition-all duration-300 hover:shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-500/90" />
            <span className="text-xs font-bold text-amber-900/90 dark:text-amber-300">
              工具返回结果 (Tool Output)
            </span>
            <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-mono bg-amber-50/30 dark:bg-amber-950/20 px-1.5 py-0.5 rounded border border-amber-100/40 dark:border-amber-900/30">
              ID: {block.tool_use_id}
            </span>
            {block.isError && (
              <Badge variant="destructive" className="text-[9px] py-0 scale-90">ERROR</Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {renderTranslateButton()}
            <CopyButton text={displayContent} />
          </div>
        </div>

        {/* 高颜值终端（Mac 样式 - 纯正深色极客控制台） */}
        <div className="mt-2.5 rounded-xl overflow-hidden border border-zinc-800 shadow-md transition-shadow hover:shadow-lg">
          {/* 终端头部栏 */}
          <div className="bg-zinc-900 dark:bg-zinc-950 px-4 py-2.5 flex items-center justify-between border-b border-zinc-800/80">
            <div className="flex items-center gap-1.5 select-none">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] opacity-90"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] opacity-90"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f] opacity-90"></div>
            </div>
            <span className="text-[10px] font-mono text-zinc-500 select-none">bash - tool_result.log</span>
            <div className="w-12"></div>
          </div>

          {/* 终端内容区 */}
          {isJson ? (
            <pre className="text-[11px] font-mono bg-zinc-950 text-zinc-300 p-4 overflow-x-auto max-h-64 scrollbar-thin select-all leading-relaxed border-none rounded-none m-0">
              {typeof displayContent === 'object' ? JSON.stringify(displayContent, null, 2) : displayContent}
            </pre>
          ) : (
            <div className="p-4 bg-zinc-950 text-zinc-300 font-mono text-[11px] whitespace-pre-wrap select-all leading-relaxed max-h-64 overflow-y-auto scrollbar-thin border-none rounded-none">
              {displayContent}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 5. 图片内容块 (IMAGE)
  if (isImageMessage(block)) {
    const isBase64 = block.source?.type === 'base64';
    const mediaType = block.source?.media_type || 'image/png';
    const data = block.source?.data;

    return (
      <div className="p-4 bg-sky-50/20 dark:bg-sky-950/5 rounded-2xl border border-sky-200/40 dark:border-sky-900/30 border-l-4 border-l-sky-400 group relative transition-all duration-300 hover:shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-sky-500" />
            <span className="text-xs font-bold text-sky-800 dark:text-sky-300">图片资源 (Image Input)</span>
            <Badge variant="outline" className="text-[9px] bg-sky-100/50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border-sky-200/30">
              {block.source?.type || 'url'}
            </Badge>
          </div>
        </div>

        {/* 支持直接渲染预览 Base64 / URL 图片，极富视觉冲击力 */}
        {isBase64 && data ? (
          <div className="mt-2 rounded-xl overflow-hidden border border-sky-100/50 dark:border-sky-900/30 max-w-md shadow-sm hover:shadow-md transition-shadow bg-muted">
            <img 
              src={`data:${mediaType};base64,${data}`} 
              alt="多模态输入图片" 
              className="w-full h-auto max-h-80 object-contain mx-auto"
            />
          </div>
        ) : block.url ? (
          <div className="mt-2 rounded-xl overflow-hidden border border-sky-100/50 dark:border-sky-900/30 max-w-md shadow-sm hover:shadow-md transition-shadow bg-muted">
            <img 
              src={block.url} 
              alt="多模态输入图片" 
              className="w-full h-auto max-h-80 object-contain mx-auto"
            />
          </div>
        ) : (
          <div className="mt-2 p-3 bg-muted/40 dark:bg-muted/10 rounded-xl text-xs text-muted-foreground italic flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            包含图片数据结构，但当前格式不支持直接渲染预览
          </div>
        )}
      </div>
    );
  }

  // 6. 其他通用内容块
  return (
    <div className="p-3 bg-muted rounded-xl group relative border border-border">
      <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={block} />
      </div>
      <pre className="text-xs overflow-x-auto font-mono scrollbar-thin select-all">
        {JSON.stringify(block, null, 2)}
      </pre>
    </div>
  );
}

/**
 * 消息卡片主组件（区分 User 和 Assistant，带有精致头像和左侧线条色彩标称）
 */
function MessageCard({ message }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  const renderContent = () => {
    if (typeof message.content === 'string') {
      return <RenderTextBlocks text={message.content} role={message.role} />;
    }

    if (Array.isArray(message.content)) {
      return (
        <div className="space-y-3.5">
          {message.content.map((block, idx) => (
            <ContentBlock key={idx} block={block} role={message.role} />
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className={`p-5 rounded-3xl border transition-all duration-300 shadow-sm relative group overflow-hidden ${
        isUser
          ? 'bg-card border-blue-100 dark:border-blue-950/40 hover:shadow-md hover:-translate-y-0.5'
          : 'bg-card border-green-100 dark:border-green-900/20 hover:shadow-md hover:-translate-y-0.5'
      }`}
    >
      {/* 侧边微发光彩色高亮条 */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${isUser ? 'bg-blue-400/80 dark:bg-blue-500' : 'bg-emerald-400/80 dark:bg-emerald-500'}`}></div>

      {/* 顶部元数据头区 */}
      <div className="flex items-center justify-between mb-4 pl-2">
        <div className="flex items-center gap-2.5">
          {/* 发光头像框 */}
          <div className={`w-7 h-7 rounded-full flex items-center justify-center border text-[10px] shadow-sm transition-all duration-300 ${
            isUser 
              ? 'bg-blue-500/10 text-blue-600 border-blue-200/50 dark:bg-blue-900/30 hover:scale-105' 
              : 'bg-emerald-500/10 text-emerald-600 border-emerald-200/50 dark:bg-emerald-900/30 hover:scale-105'
          }`}>
            {isUser ? <User className="w-3.5 h-3.5" /> : <Cpu className="w-3.5 h-3.5" />}
          </div>
          <Badge className={`${getRoleBadgeClass(message.role)} text-xs px-2.5 py-0.5 font-semibold`}>
            {isUser ? '用户请求 (User)' : '助手回复 (Assistant)'}
          </Badge>
        </div>
        {message.role === 'assistant' && message.content && (
          <span className="text-[10px] text-muted-foreground/70 font-mono bg-muted/50 dark:bg-muted/10 px-2 py-0.5 rounded border border-border/50">
            {typeof message.content === 'string'
              ? '文本响应'
              : `共 ${message.content.length} 个内容块`}
          </span>
        )}
      </div>

      {/* 卡片主体 */}
      <div className="pl-2 pr-1">
        {renderContent()}
      </div>
    </div>
  );
}

/**
 * 消息列表主组件（包含系统提示词卡片、工具卡片及历史消息）
 */
function MessageList({ messages, tools, system }) {
  const [selectedTool, setSelectedTool] = useState(null);

  if (messages.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border border-dashed rounded-3xl bg-muted/5">
        暂无对话数据
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* System 模块（带高档背景和 CPU 说明） */}
      {system && system.length > 0 && (
        <div className="mb-6 p-4 bg-muted/20 dark:bg-muted/5 rounded-3xl border border-border/80 shadow-sm">
          <h4 className="text-xs font-bold uppercase tracking-wider mb-3.5 flex items-center gap-1.5 text-foreground/80">
            <Settings className="w-4 h-4 text-slate-500 animate-spin-slow" />
            系统级提示词设定 (System Prompt - {system.length})
          </h4>
          <div className="space-y-3">
            {system.map((item, idx) => (
              <SystemPromptItem key={idx} item={item} idx={idx} />
            ))}
          </div>
        </div>
      )}

      {/* 可用工具列表 (Badges Grid with click popup) */}
      {tools && tools.length > 0 && (
        <div className="mb-6 p-4 bg-muted/20 dark:bg-muted/5 rounded-3xl border border-border/80 shadow-sm animate-fadeIn">
          <h4 className="text-xs font-bold uppercase tracking-wider mb-3.5 flex items-center gap-1.5 text-foreground/80">
            <Wrench className="w-4 h-4 text-primary animate-pulse" />
            当前上下文可用工具绑定 (Available Tools - {tools.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {tools.map((tool) => (
              <Badge
                key={tool.name}
                variant="outline"
                className="font-mono text-xs cursor-pointer bg-background hover:bg-primary/10 hover:text-primary transition-all duration-200 py-1.5 px-3 rounded-xl border border-border shadow-sm flex items-center gap-1.5 hover:-translate-y-0.5"
                onClick={() => setSelectedTool(tool)}
              >
                <Code className="w-3.5 h-3.5 text-indigo-500" />
                {tool.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 消息时间轴渲染 */}
      <div className="space-y-5">
        {messages.map((msg, idx) => (
          <div key={idx} className="animate-fadeIn">
            <MessageCard message={msg} />
          </div>
        ))}
      </div>

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
