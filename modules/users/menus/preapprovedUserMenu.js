const { Markup } = require("telegraf");

/**
 * Menu for preapproved users (need interview)
 */
function getPreapprovedUserMenu(ctx, userData) {
  return {
    message: '✅ <b>Заявка принята к рассмотрению</b>\n\n' +
'Ты прошёл первый круг. Теперь тебя ждёт собеседование.\n\n' +
'Напиши @EvgenMol и прошепчи кодовую фразу:\n' +
            `<code>гоблин-${ctx.from.id.toString().slice(-4)}</code>\n\n` +
            'Совет решит, достоин ли ты логова. Ответ будет окончательным.',
    keyboard: [
      [Markup.button.callback('❓ Помощь', 'userHelp')]
    ]
  };
}

module.exports = { getPreapprovedUserMenu };
