const { Composer, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util');

module.exports = Composer.action(/actionCheckMonth-.+/, async ctx => {
  if (ctx.callbackQuery.from.id != SETTINGS.CHATS.EPINETOV) { return; }

  console.log(ctx.callbackQuery.data)
  const monthName = ctx.callbackQuery.data.split('actionCheckMonth-')[1];
  
  let message = `Данные за месяц <b><i>${monthName}</i></b>\n\n`;

  let counterBase = 0;
  let counterPlus = 0;
  let badBoys = 0;

  for (const telegramID in ctx.months.list[monthName].members) {
    if (ctx.months.list[monthName].members[telegramID].paid) counterBase++;
    if (ctx.months.list[monthName].members[telegramID].plus) counterPlus++;

    badBoys = Object.keys(ctx.globalSession.participants).length - counterBase;
  }

  message += `Оплатили: ${counterBase}\n`
  message += `С плюсом: ${counterPlus}\n`
  message += `Не оплатили: ${badBoys}\n`


  ctx.replyWithHTML(message, {
    ...Markup.inlineKeyboard([
      Markup.button.callback("Разослать предупреждения", `actionSendWarnings-${monthName}`),
      Markup.button.callback("Посмотреть неоплативших", `actionShowNonPayers-${monthName}`)
    ]),
  })
});
