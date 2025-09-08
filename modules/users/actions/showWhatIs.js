const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('showWhatIs', async (ctx) => {
  const whatIsMessage = t('messages.whatIs');

  const whatIsKeyboard = [
    [
      Markup.button.callback(t('buttons.rules'), 'showRules'),
      Markup.button.callback(t('start.buttons.apply'), 'startApplication')
    ],
    [
      Markup.button.callback('❓ FAQ', 'showFAQ'),
      Markup.button.callback(t('buttons.support'), 'contactSupport')
    ],
    [
      Markup.button.callback(t('messages.back'), 'guestStart'),
      Markup.button.callback(t('messages.home'), 'guestStart')
    ]
  ];

  await ctx.editMessageText(whatIsMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(whatIsKeyboard)
  });
});


