const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action(/^userMonths/g, async (ctx) => {
  const userId = ctx.callbackQuery.from.id;
  const callbackData = ctx.callbackQuery.data;

  if (!ctx.months.list) ctx.months.list = {};

  let menu = [];

  if (callbackData.indexOf('_') < 0) {
    for (let year in ctx.months.list) {
      menu.push(Markup.button.callback(year, `userMonths_show_${year}`))
    }

    menu = util.splitMenu(menu);

    await ctx.editMessageText(`Доступные года`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        ...menu,
        [
          Markup.button.callback('🏠', `userMenu`)
        ]
      ])
    })
  } else {
    if (!callbackData.split('_')[3]) {
      const year = callbackData.split('_')[2];
      const sortedMonths = Object.keys(ctx.months.list[year]).sort((a, b) => a - b);

      for (let month of sortedMonths) {
        const monthIsPurchasable = !(ctx.users.list[userId].purchases.groups.regular.indexOf(`${year}_${month}`) > -1 && ctx.users.list[userId].purchases.groups.plus.indexOf(`${year}_${month}`) > -1)
        menu.push(Markup.button.callback(`${monthIsPurchasable ? '💰 ' : ''}${month}`, `userMonths_show_${year}_${month}`))
      }

      menu = util.splitMenu(menu);

      await ctx.editMessageText(`Доступные месяцы в ${year}. Если помечен знаком 💰, то месяц доступен для покупки`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          ...menu,
          [
            Markup.button.callback('←', `userMonths`),
            Markup.button.callback('🏠', `userMenu`),
          ]
        ])
      })
    } else {
      const year = callbackData.split('_')[2];
      const month = callbackData.split('_')[3];
      const info = ctx.months.list[year][month];
      const userInfo = ctx.users.list[userId];
      const regularPurchased = userInfo.purchases.groups.regular.indexOf(`${year}_${month}`) > -1;
      const plusPurchased = userInfo.purchases.groups.plus.indexOf(`${year}_${month}`) > -1;
      const monthIsPurchasable = !(regularPurchased && plusPurchased)
      const isAdmin = userInfo.roles.indexOf('admin') > -1;
      const isAdminPlus = userInfo.roles.indexOf('adminPlus') > -1;

      let message = `Данные за ${year}-${month}`;

      if (monthIsPurchasable) message += `\n`

      const isCurrent = ctx.globalSession.current.year == year && ctx.globalSession.current.month == month;

      if (regularPurchased || isAdmin || isAdminPlus) {
        if (info.regular.link.length > 0) {
          menu.push([Markup.button.url('Вступить в архив', info.regular.link)])
        } else {
          await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `❗️${year}_${month}_regular doesn't have a link!`)
          message += `\nℹ️ <i>Ссылка на вступление в обычную группу скоро будет добавлена</i>`
        }
      } else {
        message += `\nСтоимость обычной группы: ${isCurrent ? '600₽' : '1800₽'}`
      }
      if (plusPurchased || isAdminPlus) {
        if (info.plus.link.length > 0) {
          menu.push([Markup.button.url('Вступить в архив+', info.plus.link)])
        } else {
          await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `❗️${year}_${month}_regular doesn't have a link!`)
          message += `\nℹ️ <i>Ссылка на вступление в плюсовую группу скоро будет добавлена</i>`
        }
      } else {
        message += `\nСтоимость плюсовой группы: ${isCurrent ? '1000₽' : '3000₽'}`
      }
      if (monthIsPurchasable) menu.push([Markup.button.callback('Оплатить и отправить скрин', 'sendPayment')])

      ctx.userSession.purchasing = {
        type: 'group',
        year: year,
        month: month,
        userId: userId,
        isOld: !isCurrent
      }

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          ...menu,
          [
            Markup.button.callback('←', `userMonths_show_${year}`),
            Markup.button.callback('🏠', `userMenu`),
          ]
        ])
      })
    }
  }
});