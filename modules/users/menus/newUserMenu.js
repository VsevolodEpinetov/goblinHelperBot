const { Markup } = require("telegraf");

/**
 * Menu for new users (no roles)
 */
function getNewUserMenu(ctx, userData) {
  return {
    message: `🌑 <b>Добро пожаловать в логово Главгоблина!</b>\n\n` +
            `Здесь копятся STL-сокровища. Но двери открываются лишь тем, кто готов заплатить звёздами из своей казны.\n\n` +
            `Хочешь узнать, что это такое?`,
    keyboard: [
      [Markup.button.callback('❓ Что это такое?', 'whatIsIt')]
    ]
  };
}

module.exports = { getNewUserMenu };
