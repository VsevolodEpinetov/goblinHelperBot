const { Markup } = require('telegraf');

/**
 * Departed Menu - for users who left on good terms
 * Shows a simple message with contact information
 */
function getDepartedMenu(ctx, userData) {
  const message = `👋 <b>Привет, ${userData.username || 'друг'}!</b>\n\n` +
    `Мы помним тебя, ты был хорошим членом племени. Но сейчас ты не часть племени.\n\n` +
    `Если у тебя есть проблемы или вопросы, обратись к @glavgoblin\n\n` +
    `🕊️ <i>Мир тебе, странник</i>`;

  const keyboard = [
    [Markup.button.callback('📞 Связаться с @glavgoblin', 'contact_glavgoblin')]
  ];

  return { message, keyboard };
}

module.exports = {
  getDepartedMenu
};
