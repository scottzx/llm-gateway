import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Loader2, Languages } from 'lucide-react';

/**
 * 翻译对话框组件
 * @param {Object} props
 * @param {Object} props.block - Content block 对象
 * @param {string} props.blockType - Block 类型 ('text', 'tool_use', 'tool_result', 'image')
 * @param {string} props.originalText - 原文文本
 * @param {boolean} props.open - 是否打开对话框
 * @param {Function} props.onOpenChange - 打开状态改变回调
 */
function TranslationDialog({ block, blockType, originalText, open, onOpenChange }) {
  const [status, setStatus] = useState('idle'); // idle, checking, ready, translating, success, error
  const [translatedText, setTranslatedText] = useState('');
  const [fromCache, setFromCache] = useState(false);
  const [hitCount, setHitCount] = useState(0);
  const [error, setError] = useState('');

  // 重置状态当打开状态改变
  useEffect(() => {
    if (open) {
      setStatus('idle');
      setTranslatedText('');
      setFromCache(false);
      setHitCount(0);
      setError('');
      checkCacheAndTranslate();
    }
  }, [open, block]);

  // 检查缓存并执行翻译
  const checkCacheAndTranslate = async () => {
    if (!block) return;

    try {
      setStatus('checking');

      // 检查缓存（使用 POST 方法发送 block 数据）
      const checkResponse = await fetch('/api/translation/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ block, blockType }),
      });

      if (!checkResponse.ok) {
        throw new Error('检查缓存失败');
      }

      const checkData = await checkResponse.json();

      if (checkData.hasCache) {
        // 有缓存，直接显示
        setTranslatedText(checkData.translatedText);
        setFromCache(true);
        setHitCount(checkData.hitCount || 0);
        setStatus('success');
      } else {
        // 无缓存，等待用户点击翻译按钮
        setStatus('ready');
      }
    } catch (err) {
      console.error('检查缓存失败:', err);
      setError(err.message);
      setStatus('error');
    }
  };

  // 执行翻译
  const handleTranslate = async () => {
    if (!block) return;

    try {
      setStatus('translating');

      const response = await fetch('/api/translation/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ block }),
      });

      if (!response.ok) {
        throw new Error('翻译请求失败');
      }

      const data = await response.json();

      if (data.success) {
        setTranslatedText(data.translatedText);
        setFromCache(data.fromCache);
        setStatus('success');
      } else {
        throw new Error(data.error || '翻译失败');
      }
    } catch (err) {
      console.error('翻译失败:', err);
      setError(err.message);
      setStatus('error');
    }
  };

  // 获取类型对应的样式
  const getTypeStyle = () => {
    switch (blockType) {
      case 'text':
        return { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-800 dark:text-blue-200' };
      case 'tool_use':
        return { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-800 dark:text-purple-200' };
      case 'tool_result':
        return { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-800 dark:text-orange-200' };
      case 'image':
        return { bg: 'bg-cyan-50 dark:bg-cyan-900/20', border: 'border-cyan-200 dark:border-cyan-800', text: 'text-cyan-800 dark:text-cyan-200' };
      default:
        return { bg: 'bg-gray-50 dark:bg-gray-900/20', border: 'border-gray-200 dark:border-gray-800', text: 'text-gray-800 dark:text-gray-200' };
    }
  };

  const typeStyle = getTypeStyle();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="w-5 h-5" />
            翻译
          </DialogTitle>
          <DialogClose />
        </DialogHeader>

        <div className="space-y-4">
          {/* 原文显示区域 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">原文</span>
              <Badge variant="outline" className={typeStyle.text}>
                {blockType}
              </Badge>
            </div>
            <div className={`p-3 rounded-lg border ${typeStyle.bg} ${typeStyle.border}`}>
              <pre className="text-sm whitespace-pre-wrap break-words font-sans">
                {originalText}
              </pre>
            </div>
          </div>

          {/* 状态显示 */}
          {status === 'checking' && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              检查缓存中...
            </div>
          )}

          {status === 'ready' && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <p className="text-sm text-muted-foreground">未找到缓存翻译</p>
              <Button onClick={handleTranslate} size="lg">
                <Languages className="w-4 h-4 mr-2" />
                立即翻译
              </Button>
            </div>
          )}

          {status === 'translating' && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span className="text-lg">翻译中...</span>
            </div>
          )}

          {status === 'success' && translatedText && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">翻译结果</span>
                {fromCache && (
                  <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-600 dark:border-green-400">
                    来自缓存 {hitCount > 0 && `(命中 ${hitCount} 次)`}
                  </Badge>
                )}
              </div>
              <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                <p className="text-sm whitespace-pre-wrap break-words text-blue-900 dark:text-blue-100">
                  {translatedText}
                </p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
              <p className="text-sm text-red-600 dark:text-red-400">翻译失败：{error}</p>
              <Button onClick={handleTranslate} variant="outline" size="sm" className="mt-3">
                重试
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TranslationDialog;
