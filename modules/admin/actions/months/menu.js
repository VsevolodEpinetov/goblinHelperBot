const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action(/^adminMonths/g, async (ctx) => {
  const userId = ctx.callbackQuery.from.id;
  const callbackData = ctx.callbackQuery.data;

  if (userId != SETTINGS.CHATS.EPINETOV && userId != SETTINGS.CHATS.GLAVGOBLIN) {
    return;
  }

  if (!ctx.months.list) ctx.months.list = {};

  let menu = [];

  if (callbackData.indexOf('_') < 0) {
    for (let year in ctx.months.list) {
      menu.push(Markup.button.callback(year, `adminMonths_show_${year}`))
    }

    menu = util.splitMenu(menu);

    await ctx.editMessageText(`Доступные года`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        ...menu,
        [
          Markup.button.callback('←', `adminMenu`),
          Markup.button.callback('+', `monthsAddYear`),
          Markup.button.callback('-', `monthsRemoveYear`),
        ]
      ])
    })
  } else {
    if (!callbackData.split('_')[3]) {
      const year = callbackData.split('_')[2];
      for (let month in ctx.months.list[year]) {
        if (!ctx.months.list[year][month]) {
          ctx.months.list[year][month] = {
            regular: {
              link: '',
              id: '',
              counter: 0
            },
            plus: {
              link: '',
              id: '',
              counter: 0
            }
          };
        }
        menu.push(Markup.button.callback(month, `adminMonths_show_${year}_${month}`))
      }

      menu = util.splitMenu(menu);

      await ctx.editMessageText(`Доступные месяцы в ${year}`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          ...menu,
          [
            Markup.button.callback('←', `adminMonths`),
            Markup.button.callback('+', `monthsAdd_${year}`),
            Markup.button.callback('-', `monthsRemove_${year}`),
          ]
        ])
      })
    } else {
      choosing = false;
      const year = callbackData.split('_')[2];
      const month = callbackData.split('_')[3];
      const info = ctx.months.list[year][month];
      let regularGroupInfo, plusGroupInfo;
      if (info.regular.id) regularGroupInfo = await ctx.getChat(info.regular.id)
      if (info.plus.id) plusGroupInfo = await ctx.getChat(info.plus.id)


      await ctx.editMessageText(`Данные за ${year}-${month}:\n\nСсылка на обычную группу: ${info.regular.link || 'not set'}\nСтатус: ${regularGroupInfo ? `✅` : '❌'}\nПодтверждено участников: ${info.regular.counter.joined}/${info.regular.counter.paid}\n\nСсылка на плюсовую группу: ${info.plus.link || 'not set'}\nСтатус: ${plusGroupInfo ? `✅` : '❌'}\nПодтверждено участников: ${info.plus.counter.paid}/${info.plus.counter.joined}`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('Ссылка на обычную', `adminAddLink_${year}_${month}`),
            Markup.button.callback('Ссылка на плюсовую', `adminAddLinkPlus_${year}_${month}`)
          ],
          [
            Markup.button.callback('🔔 Напомнить', `adminRemindLevels`),
          ],
          [
            Markup.button.callback('←', `adminMonths_show_${year}`),
            Markup.button.callback('В начало', `adminMenu`),
          ]
        ])
      })
    }
  }
});