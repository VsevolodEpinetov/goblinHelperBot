const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const knex = require('../../../../modules/db/knex');
const { getUser, updateUser, addUserToGroup, incrementMonthCounter, addUserKickstarter, getKickstarter, hasUserPurchasedKickstarter, hasUserPurchasedMonth } = require('../../../db/helpers');
const { applyXpGain, getSubscriptionBaseUnits } = require('../../../loyalty/xpService');
const rpgConfig = require('../../../../configs/rpg');

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
        
        // Grant XP for subscription confirmation (1.3 XP per base star price)
        try {
          const regularBasePrice = parseInt(rpgConfig.prices.regularStars || process.env.REGULAR_PRICE);
          const plusBasePrice = parseInt(rpgConfig.prices.plusStars || process.env.PLUS_PRICE);
          const baseStars = groupType === 'plus' ? plusBasePrice : regularBasePrice;
          const period = `${year}-${month}`;
          await applyXpGain(Number(userId), baseStars, 'admin_payment_confirm', {
            subscriptionType: groupType,
            period: period,
            description: `Admin confirmed ${groupType} subscription for ${period}`,
            confirmedBy: ctx.callbackQuery.from.id,
            confirmedByUsername: ctx.callbackQuery.from.username || ctx.callbackQuery.from.first_name
          });
        } catch (xpError) {
          console.error('⚠️ Failed to grant XP for admin payment confirmation:', xpError);
        }
        
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
        
        // Grant XP for kickstarter confirmation (1.3 XP per star, use kickstarter cost)
        try {
          const kickstarterData = await getKickstarter(ksId);
          const ksCost = kickstarterData?.cost ? parseInt(kickstarterData.cost) : 350; // Use actual cost or default
          await applyXpGain(Number(userId), ksCost, 'admin_kickstarter_confirm', {
            kickstarterId: ksId,
            kickstarterName: kickstarterData?.name || 'Unknown',
            description: `Admin confirmed kickstarter access: ${kickstarterData?.name || 'Unknown'}`,
            confirmedBy: ctx.callbackQuery.from.id,
            confirmedByUsername: ctx.callbackQuery.from.username || ctx.callbackQuery.from.first_name
          });
        } catch (xpError) {
          console.error('⚠️ Failed to grant XP for admin kickstarter confirmation:', xpError);
        }
        
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