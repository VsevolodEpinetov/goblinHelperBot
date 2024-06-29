const { Composer, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.command('months', async (ctx) => {
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) { return; }

  if (!ctx.globalSession.months) ctx.globalSession.months = {};
  if (!ctx.globalSession.currentMonth) ctx.globalSession.currentMonth = '';

  console.log(ctx.globalSession.months)
  
  let message = `<b><i>Созданные месяцы</i></b>\n\n`;
  let counter = 1;
  for (const monthName in ctx.globalSession.months) {
    message += `${counter}. ${monthName}${ctx.globalSession.currentMonth === monthName ? ' ✅' : ''}`
  }

  ctx.replyWithHTML(message, {
    ...Markup.inlineKeyboard([
      Markup.button.callback("Создать месяц", `actionAddMonth`),
      Markup.button.callback("Посмотреть месяц", 'actionCheckMonth')
    ]),
  })
})