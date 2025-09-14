const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('showFAQ', async (ctx) => {
  const faqMessage = `${t('faq.menu.title')}\n\n${t('faq.menu.prompt')}`;

  const faqKeyboard = [
    [
      Markup.button.callback(t('faq.menu.buttons.subscriptions'), 'faqSubscriptions'),
      Markup.button.callback(t('faq.menu.buttons.rpg'), 'faqRpg')
    ],
    [
      Markup.button.callback(t('faq.menu.buttons.scrolls'), 'faqScrolls'),
      Markup.button.callback(t('faq.menu.buttons.kickstarters'), 'faqKickstarters')
    ],
    [
      Markup.button.callback(t('faq.menu.buttons.access'), 'faqAccess'),
      Markup.button.callback(t('faq.menu.buttons.technical'), 'faqTechnical')
    ],
    [
      Markup.button.callback(t('faq.menu.buttons.back'), 'contactSupport'),
      Markup.button.callback(t('faq.menu.buttons.home'), 'guestStart')
    ]
  ];

  await ctx.editMessageText(faqMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(faqKeyboard)
  });
});
