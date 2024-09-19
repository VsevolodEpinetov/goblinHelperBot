const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const SETTINGS = require('../../../settings.json');

module.exports = Composer.action(/^adminMonths/g, async (ctx) => {
  const userId = ctx.callbackQuery.from.id;
  const callbackData = ctx.callbackQuery.data;
  
  if (userId != SETTINGS.CHATS.EPINETOV) {
    return;
  }

  if (!ctx.months.list) ctx.months.list = {};

  const menu = [];
  let choosing = true;
  let chosenYear;
  let chosen;

  if (callbackData.indexOf('_') < 0) {
    for (let year in ctx.months.list) {
      menu.push(Markup.button.callback(year, `adminMonths_show_${year}`))
    }

    await ctx.editMessageText(`Доступные года`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        menu,
        [
          Markup.button.callback('←', `adminMenu`),
          Markup.button.callback('+', `monthsAddYear`),
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

      await ctx.editMessageText(`Доступные месяцы в ${year}`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          menu,
          [
            Markup.button.callback('←', `adminMonths`),
            Markup.button.callback('+', `monthsAdd_${year}`),
          ]
        ])
      })
    } else {
      choosing = false;
      const year = callbackData.split('_')[2];
      const month = callbackData.split('_')[3];
      const info = ctx.months.list[year][month];

      await ctx.editMessageText(`Данные за ${year}-${month}:\n\nСсылка на обычную группу: ${ctx.months.list[year][month].regular.link || 'not set'}\nПодтверждено участников: ${ctx.months.list[year][month].regular.counter}\n\nСсылка на плюсовую группу: ${ctx.months.list[year][month].plus.link || 'not set'}\nПодтверждено участников: ${ctx.months.list[year][month].plus.counter}`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('Ссылка на обычную', `adminAddLink_${year}_${month}`),
            Markup.button.callback('Ссылка на плюсовую', `adminAddLinkPlus_${year}_${month}`)
          ],
          [
            Markup.button.callback('←', `adminMonths_show_${year}`),
            Markup.button.callback('В начало', `adminMonths`),
          ]
        ])
      })
    }
  }
});