const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action(/^confirmPayment_/g, async (ctx) => {
  const data = ctx.callbackQuery.data.split('_');
  const userId = data[1];
  const type = data[2];
  const userName = ctx.users.list[userId].username == 'not_set' ? ctx.users.list[userId].first_name : `@${ctx.users.list[userId].username}`;

  switch (type) {
    case 'group':
      year = data[3];
      month = data[4];
      groupType = data[5];
      if (ctx.users.list[userId].purchases.groups[groupType].indexOf(`${year}_${month}`) < 0) {
        ctx.users.list[userId].purchases.groups[groupType].push(`${year}_${month}`);
        ctx.months.list[year][month][groupType].counter.paid = ctx.months.list[year][month][groupType].counter.paid + 1;
        await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `ℹ️ user ${userId} got ${year}-${month}${groupType  == 'plus' ? '+' : ''} an access given by @${ctx.callbackQuery.from.username || ctx.callbackQuery.from.first_name} (${ctx.callbackQuery.from.id})`)
        ctx.replyWithHTML(`Выдал ${userName} (${userId}) доступ к ${year}-${month}${groupType  == 'plus' ? '+' : ''}`)
        ctx.telegram.sendMessage(userId, `Подтверждён доступ к ${year}-${month}${groupType  == 'plus' ? '+' : ''}`, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('Перейти к подписке', `userMonths_show_${year}_${month}`)
            ],
            [
              Markup.button.callback('🏠', `userMenu`)
            ]
          ])
        })
      } else {
        ctx.replyWithHTML(`У ${userName} (${userId}) уже есть доступ к ${year}-${month} 🤔`)
      }
      break;
    case 'kickstarter':
      ksId = data[3];
      if (ctx.users.list[userId].purchases.kickstarters.indexOf(ksId) < 0) {
        ctx.users.list[userId].purchases.kickstarters.push(ksId);
        await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `ℹ️ user ${userId} got kickstarter ${ksId} an access given by @${ctx.callbackQuery.from.username || ctx.callbackQuery.from.first_name} (${ctx.callbackQuery.from.id})`)
        await ctx.telegram.sendMessage(userId, `Подтверждён доступ к кикстартеру ${ctx.kickstarters.list[ksId].name}`, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('Перейти к кикстартерам', `userKickstarters`)
            ],
            [
              Markup.button.callback('🏠', `userMenu`)
            ]
          ])
        })
      } else {
        ctx.replyWithHTML(`У ${userName} (${userId}) уже есть доступ к кикстартеру ${ksId} 🤔`)
      }
      break;
    case 'collection':
      collectionId = data[3];
      if (ctx.users.list[userId].purchases.collections.indexOf(collectionId) < 0) {
        ctx.users.list[userId].purchases.collections.push(collectionId);
        await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `ℹ️ user ${userId} got collection ${collectionId} an access given by @${ctx.callbackQuery.from.username || ctx.callbackQuery.from.first_name} (${ctx.callbackQuery.from.id})`)
        ctx.telegram.sendMessage(userId, `Подтверждён доступ к коллекции ${ctx.collections.list[collectionId].name}`, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('Перейти к коллекциям', `userCollections`)
            ],
            [
              Markup.button.callback('🏠', `userMenu`)
            ]
          ])
        })
      } else {
        ctx.replyWithHTML(`У ${userName} (${userId}) уже есть доступ к коллекции ${collectionId} 🤔`)
      }
      break;
    case 'release':
      studioName = data[3];
      year = data[4];
      month = data[5];
      if (ctx.users.list[userId].purchases.releases[studioName].indexOf(`${year}_${month}`) < 0) {
        ctx.users.list[userId].purchases.releases[studioName].push(`${year}_${month}`)
        await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `ℹ️ user ${userId} got release an access given by @${ctx.callbackQuery.from.username || ctx.callbackQuery.from.first_name} (${ctx.callbackQuery.from.id})`)
        ctx.telegram.sendMessage(userId, `Подтверждён доступ к релизу ${ctx.collections.list[collectionId].name}`, {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('Перейти к релизам', `userReleases`)
            ],
            [
              Markup.button.callback('🏠', `userMenu`)
            ]
          ])
        })
      } else {
        ctx.replyWithHTML(`У ${userName} (${userId}) уже есть доступ к релизу ${studioName} ${year}-${month} 🤔`)
      }
      break;
  }
});