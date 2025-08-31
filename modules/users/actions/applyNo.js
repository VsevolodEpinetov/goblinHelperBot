const { Composer } = require('telegraf');
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('applyNo', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  await ctx.editMessageText(t('apply.declined'), {
    parse_mode: 'HTML'
  });
});


