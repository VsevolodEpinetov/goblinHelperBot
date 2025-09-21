const { Composer, Markup } = require("telegraf");
const util = require('../../util');

module.exports = Composer.action('showFAQ', async (ctx) => {
  const faqMessage = `❓ <b>Частые вопросы</b>\n\nВыбери свиток, что тревожит твою душу:`;

  const faqKeyboard = [
    [
      Markup.button.callback("📅 Подписки", 'faqSubscriptions'),
      Markup.button.callback("🎮 RPG и уровни", 'faqRpg')
    ],
    [
      Markup.button.callback("📜 Свитки", 'faqScrolls'),
      Markup.button.callback("🚀 Кикстартеры", 'faqKickstarters')
    ],
    [
      Markup.button.callback("🔐 Доступ и безопасность", 'faqAccess'),
      Markup.button.callback("⚙️ Технические вопросы", 'faqTechnical')
    ],
    [
      Markup.button.callback("🔙 Назад", 'contactSupport'),
      Markup.button.callback("🏠 В начало", 'whatIsIt')
    ]
  ];

  await ctx.editMessageText(faqMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(faqKeyboard)
  });
});
