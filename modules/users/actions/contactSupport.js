const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('contactSupport', async (ctx) => {
  const supportMessage = `${t('support.title')}\n\n` +
    `${t('support.how')}\n\n` +
    `${t('support.emailTitle')}\n${t('support.emailValue')}\n\n` +
    `${t('support.tgTitle')}\n${t('support.tgValue')}\n\n` +
    `${t('support.adminsTitle')}\n${t('support.adminList')}\n\n` +
    `${t('support.hoursTitle')}\n${t('support.hoursValue')}\n\n` +
    `${t('support.faqTitle')}\n${t('support.faqTopics')}`;

  const supportKeyboard = [
    [
      Markup.button.callback(t('support.buttons.faq'), 'showFAQ'),
      Markup.button.callback(t('support.buttons.write'), 'writeToSupport')
    ],
    [
      Markup.button.callback(t('support.buttons.back'), 'guestStart'),
      Markup.button.callback(t('support.buttons.home'), 'guestStart')
    ]
  ];

  await ctx.editMessageText(supportMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(supportKeyboard)
  });
});
