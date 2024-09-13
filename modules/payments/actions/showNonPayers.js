const { Composer, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util');

module.exports = Composer.action(/actionShowNonPayers-.+/, async ctx => {
  if (ctx.callbackQuery.from.id != SETTINGS.CHATS.EPINETOV) { return; }

  console.log(ctx.callbackQuery.data)
  const monthName = ctx.callbackQuery.data.split('actionShowNonPayers-')[1];
  
  let message = `Данные за месяц <b><i>${monthName}</i></b>\n\n`;

  message += 'Неоплатившие:';
  let counter = 1;

  for (const telegramID in ctx.globalSession.participants) {
    if (!ctx.globalSession.months[monthName].members[telegramID]) {
      message += `\n${counter}. ${telegramID}`
      counter++;
    }
  }

  ctx.replyWithHTML(message);
});
