const { Composer, Markup } = require("telegraf");
const util = require('../../util');

module.exports = Composer.action('contactSupport', async (ctx) => {
  const supportMessage = `💬 <b>Связная и помощь</b>\n\n` +
    `🤝 <b>Как получить помощь:</b>\n\n` +
    `📧 <b>Почтовая сова:</b>\nsupport@goblinhelper.com\n\n` +
    `💬 <b>Телеграм-тропа:</b>\n@goblin_support\n\n` +
    `📱 <b>Администраторы:</b>\n@epinetov — Главгоблин\n@ann_admin — хранитель ключей\n\n` +
    `⏰ <b>Часы работы:</b>\nПн–Пт 9:00–18:00 (МСК)\nСб–Вс 10:00–16:00 (МСК)\n\n` +
    `💡 <b>Частые вопросы:</b>\n• Пополнение казны\n• Свитки\n• Доступ и ссылки\n• Технические вопросы`;

  const supportKeyboard = [
    [
      Markup.button.callback("❓ FAQ", 'showFAQ'),
      Markup.button.callback("📧 Написать в поддержку", 'writeToSupport')
    ],
    [
      Markup.button.callback("🔙 Назад", 'whatIsIt'),
      Markup.button.callback("🏠 В начало", 'whatIsIt')
    ]
  ];

  await ctx.editMessageText(supportMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(supportKeyboard)
  });
});
