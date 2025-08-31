const { Composer, Markup } = require('telegraf');
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('applyInit', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  const text = t('apply.confirmation');
  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(t('start.buttons.ready'), 'applyYes')],
      [Markup.button.callback(t('start.buttons.scared'), 'applyNo')],
      [Markup.button.callback(t('start.buttons.back'), 'guestStart')]
    ])
  });
});


