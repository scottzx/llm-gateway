const { getTranslationService } = require('./translator');
const { getDatabase } = require('./database');

/**
 * 注册翻译相关的 API 路由
 * @param {Object} app - Express 应用实例
 */
function registerTranslationRoutes(app) {
  const translationService = getTranslationService();

  /**
   * POST /api/translation/check
   * 检查是否有缓存的翻译
   * Body: { block: Object, blockType?: string }
   */
  app.post('/api/translation/check', async (req, res) => {
    try {
      const { block, blockType } = req.body;

      if (!block || typeof block !== 'object') {
        return res.status(400).json({ error: 'Missing or invalid block parameter' });
      }

      // 如果提供了 blockType，覆盖 block 中的 type
      const checkBlock = blockType ? { ...block, type: blockType } : block;

      const result = translationService.checkCache(checkBlock);

      if (result && result.hasCache) {
        res.json({
          hasCache: true,
          translatedText: result.translatedText,
          sourceType: result.sourceType,
          hitCount: result.hitCount
        });
      } else {
        res.json({ hasCache: false });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * POST /api/translation/translate
   * 执行翻译
   * Body: { block: Object }
   */
  app.post('/api/translation/translate', async (req, res) => {
    try {
      const { block } = req.body;

      if (!block || typeof block !== 'object') {
        return res.status(400).json({ error: 'Missing or invalid block parameter' });
      }

      const result = await translationService.translateBlock(block);

      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/translation/stats
   * 获取翻译统计信息
   */
  app.get('/api/translation/stats', (req, res) => {
    try {
      const db = getDatabase();
      const stats = db.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = { registerTranslationRoutes };
