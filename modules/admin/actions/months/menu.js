const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { getMonths } = require('../../../db/helpers');

module.exports = Composer.action(/^adminMonths_/, async (ctx) => {
  const userId = ctx.callbackQuery.from.id;
  const callbackData = ctx.callbackQuery.data;

  if (userId != SETTINGS.CHATS.EPINETOV && userId != SETTINGS.CHATS.GLAVGOBLIN) {
    return;
  }

  const monthsData = await getMonths();

  let menu = [];

  if (callbackData.indexOf('_') < 0) {
    for (let year in monthsData.list) {
      menu.push(Markup.button.callback(year, `adminMonths_show_${year}`))
    }

    menu = util.splitMenu(menu);

    await ctx.editMessageText(`Доступные года`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        ...menu,
        [
          Markup.button.callback('←', `userMenu`),
          Markup.button.callback('+', `monthsAddYear`),
          Markup.button.callback('-', `monthsRemoveYear`),
        ]
      ])
    })
  } else {
    if (!callbackData.split('_')[3]) {
      const year = callbackData.split('_')[2] || callbackData.split('_')[1];
      for (let month in monthsData.list[year]) {
        if (!monthsData.list[year][month]) {
          monthsData.list[year][month] = {
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
      const year = callbackData.split('_')[2] || callbackData.split('_')[1];
      const month = callbackData.split('_')[3];
      const info = monthsData.list[year][month];
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
            Markup.button.callback('←', `adminMonths_show_${year}`),
            Markup.button.callback('В начало', `userMenu`),
          ]
        ])
      })
    }
  }
});