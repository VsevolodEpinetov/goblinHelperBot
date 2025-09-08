const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('applyInit', async (ctx) => {
  const applyMessage = t('messages.apply.intro');

  const applyKeyboard = [
    [Markup.button.callback(t('messages.apply.readRules'), 'showRules')],
    [Markup.button.callback(t('messages.apply.start'), 'startApplication')],
    [Markup.button.callback(t('messages.apply.questions'), 'applicationQuestions')],
    [
      Markup.button.callback(t('messages.back'), 'guestStart'),
      Markup.button.callback(t('messages.home'), 'guestStart')
    ]
  ];

  await ctx.editMessageText(applyMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(applyKeyboard)
  });
});


