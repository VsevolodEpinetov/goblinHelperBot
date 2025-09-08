const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('guestStart', async (ctx) => {
  const welcomeMessage = t('start.welcome');

  const welcomeKeyboard = [
    [Markup.button.callback(t('buttons.rules'), 'showRules')],
    [Markup.button.callback(t('start.buttons.apply'), 'applyInit')],
    [Markup.button.callback('❓ Что это такое?', 'showWhatIs')],
    [Markup.button.callback('💬 Поддержка', 'contactSupport')]
  ];

  await ctx.editMessageText(welcomeMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(welcomeKeyboard)
  });
});
