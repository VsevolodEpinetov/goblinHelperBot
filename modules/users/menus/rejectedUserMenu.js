const { Markup } = require("telegraf");

/**
 * Menu for rejected users
 */
function getRejectedUserMenu(ctx, userData) {
  return {
    message: `❌ <b>Заявка отклонена</b>\n\n` +
            `К сожалению, твоя заявка на участие в сообществе была отклонена.\n\n` +
            `Если у тебя есть вопросы, можешь обратиться к администрации.\n\n` +
            `Спасибо за понимание.`,
    keyboard: [
      [Markup.button.callback('❓ Помощь', 'userHelp')]
    ]
  };
}

module.exports = { getRejectedUserMenu };
