const { Markup } = require("telegraf");

/**
 * Menu for self-banned users
 */
function getSelfBannedUserMenu(ctx, userData) {
  return {
    message: `🚫 <b>Доступ ограничен</b>\n\n` +
            `Ты ранее отказался от участия в сообществе.`,
    keyboard: [
      [Markup.button.callback('🔄 Начать сначала', 'whatIsIt')]
    ]
  };
}

module.exports = { getSelfBannedUserMenu };
