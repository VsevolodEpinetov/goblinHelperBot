const { Markup } = require("telegraf");

/**
 * Menu for pending users
 */
function getPendingUserMenu(ctx, userData) {
  return {
    message: `⏳ <b>Ожидай решения</b>\n\n` +
            `Твоя заявка находится на рассмотрении.\n\n` +
            `Мы изучим твой профиль и примем решение о допуске.\n\n` +
            `Уведомим тебя о результате.`,
    keyboard: [
      [Markup.button.callback('❓ Помощь', 'userHelp')]
    ]
  };
}

module.exports = { getPendingUserMenu };
