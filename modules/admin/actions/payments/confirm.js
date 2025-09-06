const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const knex = require('../../../../modules/db/knex');
const { getUser, updateUser, addUserToGroup, incrementMonthCounter, addUserKickstarter, getKickstarter, hasUserPurchasedKickstarter } = require('../../../db/helpers');

module.exports = Composer.action(/^confirmPayment_/g, async (ctx) => {
  const data = ctx.callbackQuery.data.split('_');
  const userId = data[1];
  const type = data[2];
  // Get user data
  const userData = await getUser(userId);
  if (!userData) {
    await ctx.replyWithHTML('Пользователь не найден');
    return;
  }

  const userName = userData.username == 'not_set' ? userData.first_name : `@${userData.username}`;

  switch (type) {
    case 'group':
      year = data[3];
      month = data[4];
      groupType = data[5];
      
      // Check if user already has this group
      const alreadyHasGroup = await hasUserPurchasedMonth(userId, year, month, groupType);
      if (!alreadyHasGroup) {
        await addUserToGroup(userId, year, month, groupType);
        await incrementMonthCounter(year, month, groupType, 'paid');
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
      
      // Check if user already has this kickstarter
      const alreadyHasKickstarter = await hasUserPurchasedKickstarter(userId, ksId);
      if (!alreadyHasKickstarter) {
        await addUserKickstarter(userId, ksId);
        const kickstarterData = await getKickstarter(ksId);
        await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `ℹ️ user ${userId} got kickstarter ${ksId} an access given by @${ctx.callbackQuery.from.username || ctx.callbackQuery.from.first_name} (${ctx.callbackQuery.from.id})`)
        await ctx.telegram.sendMessage(userId, `Подтверждён доступ к кикстартеру ${kickstarterData?.name || 'Unknown'}`, {
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
      if (userData.purchases.collections.indexOf(collectionId) < 0) {
        userData.purchases.collections.push(collectionId);
        await updateUser(userId, userData);
        try {
          await knex('userCollections')
            .insert({ userId: Number(userId), collectionId: Number(collectionId) })
            .onConflict(['userId','collectionId']).ignore();
        } catch (e) { console.log('Failed to persist userCollections via Knex', e); }
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
      if (userData.purchases.releases[studioName].indexOf(`${year}_${month}`) < 0) {
        userData.purchases.releases[studioName].push(`${year}_${month}`)
        await updateUser(userId, userData);
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