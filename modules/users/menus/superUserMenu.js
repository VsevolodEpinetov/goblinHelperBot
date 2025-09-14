const { Markup } = require("telegraf");

/**
 * Menu for super users (admin interface)
 */
function getSuperUserMenu(ctx, userData) {
  return {
    message: `👑 <b>Админ панель</b>\n\n` +
            `Добро пожаловать в админ панель!\n\n` +
            `Выберите раздел для управления:`,
    keyboard: [
      [
        Markup.button.callback('Месяцы', 'adminMonths'),
        Markup.button.callback('Месяцы Плюс', 'adminMonthsPlus')
      ],
      [
        Markup.button.callback('Кикстартеры', 'adminKickstarters'),
        Markup.button.callback('Релизы', 'adminReleases')
      ],
      [
        Markup.button.callback('Люди', 'adminParticipants'),
        Markup.button.callback('Голосования', 'adminPolls'),
      ],
      [
        Markup.button.callback('📋 Управление заявками', 'adminAllApplications'),
        Markup.button.callback('🔍 Поиск пользователя', 'admin_search_user')
      ],
      [
        Markup.button.callback('💫 Баланс звёзд', 'adminStarsBalance'),
        Markup.button.callback('💸 Вывод звёзд', 'adminStarsWithdraw')
      ]
    ]
  };
}

module.exports = { getSuperUserMenu };
