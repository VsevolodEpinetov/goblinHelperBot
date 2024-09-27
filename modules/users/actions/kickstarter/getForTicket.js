const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action(/^getKickstarterForTicket_/g, async (ctx) => {
  await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  const ksId = ctx.callbackQuery.data.split('_')[2];
  const userId = ctx.callbackQuery.data.split('_')[1];

  const userData = ctx.users.list[userId];
  const tickets = Math.floor(userData.purchases.groups.plus.length / 3) * 2 - userData.purchases.ticketsSpent;

  if (tickets > 0) {
    if (userData.purchases.kickstarters.indexOf(ksId) < 0) {
      ctx.users.list[userId].purchases.ticketsSpent = ctx.users.list[userId].purchases.ticketsSpent + 1;
      ctx.users.list[userId].purchases.kickstarters.push(ksId);
      await ctx.replyWithHTML(`Поздравляю, ты получил этот проект за билетик! Ты сможешь его найти в меню кикстартеров`, {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('Перейти к кикстартерам', `userKickstarters`)
          ],
          [
            Markup.button.callback('🏠', `userMenu`)
          ]
        ])
      })
      await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `ℹ️ user ${userId} got kickstarter ${ksId} for a ticket. ${tickets - 1} remaining`);
    }
  } else {
    ctx.replyWithHTML(`Не смог выдать кикстартер за билетик - похоже, что они у тебя кончились`)
    await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `⚠️ user ${userId} attempted got kickstarter ${ksId} for a ticket, but he got only ${tickets} left `)
  }
});