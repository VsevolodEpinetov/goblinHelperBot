const { Composer, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.command('months', async (ctx) => {
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) { return; }

  if (!ctx.months.list) ctx.months.list = {};
  if (!ctx.globalSession.currentMonth) ctx.globalSession.currentMonth = '';
  
  let message = `<b><i>Созданные месяцы</i></b>\n\n`;
  let counter = 1;
  for (const monthName in ctx.months.list) {
    message += `${counter}. ${monthName}${ctx.globalSession.currentMonth === monthName ? ' ✅' : ''}`
    counter++;
  }

  ctx.replyWithHTML(message, {
    ...Markup.inlineKeyboard([
      Markup.button.callback("Создать месяц", `actionAddMonth`),
      Markup.button.callback("Посмотреть месяц", 'actionCheckMonth')
    ]),
  })
})