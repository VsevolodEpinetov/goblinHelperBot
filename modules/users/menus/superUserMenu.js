const { Markup } = require("telegraf");

/**
 * Menu for super users (admin interface)
 */
function getSuperUserMenu(ctx, userData) {
  return {
    message: `👑 <b>Супер админ панель</b>\n\n` +
            `Добро пожаловать в панель управления!\n\n` +
            `Выберите раздел для управления:`,
    keyboard: [
      [
        Markup.button.callback('📅 Месяцы', 'adminMonths'),
        Markup.button.callback('🚀 Кикстартеры', 'adminKickstarters')
      ],
      [
        Markup.button.callback('👥 Пользователи', 'super_users_menu'),
        Markup.button.callback('🗳️ Голосования', 'adminPolls')
      ],
      [
        Markup.button.callback('💳 Платежи', 'adminPayments'),
        Markup.button.callback('📢 Напоминания', 'adminRemind')
      ],
      [
        Markup.button.callback('🏆 Достижения', 'adminAchievements')
      ]
    ]
  };
}

module.exports = { getSuperUserMenu };
