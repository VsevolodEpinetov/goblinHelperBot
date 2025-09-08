const { Composer, Markup } = require("telegraf");
const { t } = require('../../../../modules/i18n');
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action(/^getKickstarterForTicket_/g, async (ctx) => {
  try {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  } catch (e) {
    await ctx.replyWithHTML(t('user.messages.telegramLimitation'))
    return;
  }
  const ksId = ctx.callbackQuery.data.split('_')[2];
  const userId = ctx.callbackQuery.data.split('_')[1];

  const userData = ctx.users.list[userId];
  const tickets = Math.floor(userData.purchases.groups.plus.length / 3) * 2 - userData.purchases.ticketsSpent;

  if (tickets > 0) {
    if (userData.purchases.kickstarters.indexOf(ksId) < 0) {
      ctx.users.list[userId].purchases.ticketsSpent = ctx.users.list[userId].purchases.ticketsSpent + 1;
      ctx.users.list[userId].purchases.kickstarters.push(ksId);
      await ctx.replyWithHTML(t('kickstarters.ticket.received'), {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(t('kickstarters.ticket.goTo'), `userKickstarters`)
          ],
          [
            Markup.button.callback(t('buttons.homeIcon'), `userMenu`)
          ]
        ])
      })
      await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `ℹ️ user ${userId} got kickstarter ${ksId} for a ticket. ${tickets - 1} remaining`);
    }
  } else {
    ctx.replyWithHTML(t('kickstarters.ticket.noneLeft'))
    await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `⚠️ user ${userId} attempted got kickstarter ${ksId} for a ticket, but he got only ${tickets} left `)
  }
});