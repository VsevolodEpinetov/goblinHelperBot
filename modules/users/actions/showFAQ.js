const { Composer, Markup } = require("telegraf");
const util = require('../../util');

module.exports = Composer.action('showFAQ', async (ctx) => {
  const faqMessage = `❓ <b>ЧАСТО ЗАДАВАЕМЫЕ ВОПРОСЫ</b>\n\n` +
    `Выберите категорию вопросов, которая вас интересует:`;

  const faqKeyboard = [
    [
      Markup.button.callback('💰 Платежи и баланс', 'faqPayments'),
      Markup.button.callback('📅 Подписки', 'faqSubscriptions')
    ],
    [
      Markup.button.callback('🎟 Билетики', 'faqTickets'),
      Markup.button.callback('🚀 Кикстартеры', 'faqKickstarters')
    ],
    [
      Markup.button.callback('🔐 Доступ и безопасность', 'faqAccess'),
      Markup.button.callback('⚙️ Технические вопросы', 'faqTechnical')
    ],
    [
      Markup.button.callback('🔙 Назад', 'contactSupport'),
      Markup.button.callback('🏠 В начало', 'guestStart')
    ]
  ];

  await ctx.editMessageText(faqMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(faqKeyboard)
  });
});
