const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('contactSupport', async (ctx) => {
  const supportMessage = `💬 <b>ПОДДЕРЖКА И КОНТАКТЫ</b>\n\n` +
    `🤝 <b>Как получить помощь:</b>\n\n` +
    `📧 <b>Email поддержка:</b>\n` +
    `support@goblinhelper.com\n\n` +
    `💬 <b>Telegram чат:</b>\n` +
    `@goblin_support\n\n` +
    `📱 <b>Администраторы:</b>\n` +
    `@epinetov - главный администратор\n` +
    `@ann_admin - администратор\n\n` +
    `⏰ <b>Время работы поддержки:</b>\n` +
    `Пн-Пт: 9:00-18:00 (МСК)\n` +
    `Сб-Вс: 10:00-16:00 (МСК)\n\n` +
    `💡 <b>Часто задаваемые вопросы:</b>\n` +
    `• Как пополнить баланс?\n` +
    `• Как получить билетики?\n` +
    `• Проблемы с доступом\n` +
    `• Технические вопросы`;

  const supportKeyboard = [
    [
      Markup.button.callback('❓ FAQ', 'showFAQ'),
      Markup.button.callback('📧 Написать в поддержку', 'writeToSupport')
    ],
    [
      Markup.button.callback('🔙 Назад', 'guestStart'),
      Markup.button.callback('🏠 В начало', 'guestStart')
    ]
  ];

  await ctx.editMessageText(supportMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(supportKeyboard)
  });
});
