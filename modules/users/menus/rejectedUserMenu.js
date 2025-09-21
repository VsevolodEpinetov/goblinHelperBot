const { Markup } = require("telegraf");

/**
 * Menu for rejected users
 */
function getRejectedUserMenu(ctx, userData) {
  return {
    message: '❌ <b>Заявка отклонена</b>\n\n' +
'Совет посмотрел на тебя и расхохотался. Нет тебе дороги в логово.\n\n' +
'Иди к эльфам — там тебя, может, и приголубят.',
  };
}

module.exports = { getRejectedUserMenu };
