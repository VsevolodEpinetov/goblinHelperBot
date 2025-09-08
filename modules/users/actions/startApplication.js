const { Composer, Markup } = require("telegraf");
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('startApplication', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  const applicationMessage = t('messages.application.intro');

  const applicationKeyboard = [
    [Markup.button.callback(t('messages.application.submit'), 'applyYes')],
    [Markup.button.callback(t('messages.application.readRules'), 'showRules')],
    [Markup.button.callback(t('messages.application.faq'), 'showWhatIs')],
    [
      Markup.button.callback(t('messages.back'), 'applyInit'),
      Markup.button.callback(t('messages.home'), 'guestStart')
    ]
  ];

  await ctx.editMessageText(applicationMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(applicationKeyboard)
  });
});
