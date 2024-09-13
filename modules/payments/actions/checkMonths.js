const { Composer, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util');

module.exports = Composer.action('actionCheckMonth', async ctx => {
  if (ctx.callbackQuery.from.id != SETTINGS.CHATS.EPINETOV) { return; }

  if (!ctx.globalSession.months) ctx.globalSession.months = {};
  if (!ctx.globalSession.currentMonth) ctx.globalSession.currentMonth = '';
  
  let message = `<b><i>Созданные месяцы</i></b>\n\n`;
  message += 'Какой месяц проверяем?'

  let buttons = [];

  for (const monthName in ctx.globalSession.months) {
    buttons.push(Markup.button.callback(monthName, `actionCheckMonth-${monthName}`));
  }

  ctx.replyWithHTML(message, {
    ...Markup.inlineKeyboard(buttons),
  })
});
