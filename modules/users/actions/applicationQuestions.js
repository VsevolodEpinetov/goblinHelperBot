const { Composer, Markup } = require("telegraf");
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('applicationQuestions', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  const questionsMessage = t('messages.questions.text');

  const questionsKeyboard = [
    [Markup.button.callback(t('messages.questions.submit'), 'startApplication')],
    [Markup.button.callback(t('messages.questions.rules'), 'showRules')],
    [Markup.button.callback(t('messages.questions.whatIs'), 'showWhatIs')],
    [Markup.button.callback(t('messages.questions.support'), 'contactSupport')],
    [
      Markup.button.callback(t('messages.back'), 'applyInit'),
      Markup.button.callback(t('messages.home'), 'guestStart')
    ]
  ];

  await ctx.editMessageText(questionsMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(questionsKeyboard)
  });
});
