const { Markup } = require("telegraf");

/**
 * Menu for super users (admin interface)
 */
function getSuperUserMenu(ctx, userData) {
  return {
    message: `👑 <b>Админ панель</b>\n\n` +
            `Выберите раздел:`,
    keyboard: [
      [
        Markup.button.callback('Месяцы', 'adminMonths'),
        Markup.button.callback('Кикстартеры', 'adminKickstarters')
      ],
      [
        Markup.button.callback('Люди', 'adminParticipants'),
        Markup.button.callback('Управление голосованиями', 'adminPolls')
      ],
      [
        Markup.button.callback('Платежи', 'adminPayments')
      ]
    ]
  };
}

module.exports = { getSuperUserMenu };
