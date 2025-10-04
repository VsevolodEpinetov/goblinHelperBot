const { Composer, Markup } = require("telegraf");
const { t } = require('../../../../modules/i18n');
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { getUser, updateUser } = require('../../../db/helpers');

module.exports = Composer.action(/^getKickstarterForScroll_/g, async (ctx) => {
  try {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  } catch (e) {
    await ctx.replyWithHTML(t('user.messages.telegramLimitation'))
    return;
  }
  const ksId = ctx.callbackQuery.data.split('_')[2];
  const userId = ctx.callbackQuery.data.split('_')[1];

  const userData = await getUser(userId);
  const scrolls = Math.floor(userData.purchases.groups.plus.length / 3) * 2 - userData.purchases.scrollsSpent;

  if (scrolls > 0) {
    if (userData.purchases.kickstarters.indexOf(ksId) < 0) {
      userData.purchases.scrollsSpent = userData.purchases.scrollsSpent + 1;
      userData.purchases.kickstarters.push(ksId);
      await updateUser(userId, userData);
      await ctx.replyWithHTML(t('kickstarters.scroll.received'), {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(t('kickstarters.scroll.goTo'), `userKickstarters`)
          ],
          [
            Markup.button.callback(t('buttons.homeIcon'), `userMenu`)
          ]
        ])
      })
      await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `ℹ️ user ${userId} got kickstarter ${ksId} for a scroll. ${scrolls - 1} remaining`);
    }
  } else {
    ctx.replyWithHTML(t('kickstarters.scroll.noneLeft'))
    await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `⚠️ user ${userId} attempted got kickstarter ${ksId} for a scroll, but he got only ${scrolls} left `)
  }
});