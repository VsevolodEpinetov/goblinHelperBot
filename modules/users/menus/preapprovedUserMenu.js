const { Markup } = require("telegraf");

/**
 * Menu for preapproved users (need interview)
 */
function getPreapprovedUserMenu(ctx, userData) {
  return {
    message: `✅ <b>Заявка принята к рассмотрению</b>\n\n` +
            `Твоя заявка была принята к рассмотрению. Для прохождения собеседования свяжись с @test и используй кодовую фразу:\n\n` +
            `<code>гоблин-${ctx.from.id.toString().slice(-4)}</code>\n\n` +
            `После собеседования будет принято окончательное решение о твоем участии в сообществе.`,
    keyboard: [
      [Markup.button.callback('❓ Помощь', 'userHelp')]
    ]
  };
}

module.exports = { getPreapprovedUserMenu };
