const { Composer, Markup } = require("telegraf");
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('guestStart', async (ctx) => {
  // Guest menu - show the same welcome message as /start command
  await ctx.editMessageText(t('start.welcome'), {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(t('start.buttons.rules'), 'showRules')],
      [Markup.button.callback(t('start.buttons.apply'), 'applyInit')],
      [Markup.button.callback(t('start.buttons.whatIs'), 'showWhatIs')]
    ])
  });
});
