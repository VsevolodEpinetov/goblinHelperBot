const { Composer, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util');

module.exports = Composer.action('actionAdditional', async ctx => {
  try {
    const name = ctx.callbackQuery.message.text.split('Имя: ')[1].split('\n')[0];
    let telegramUsername = ctx.callbackQuery.message.text.split('Telegram Username: ')[1].split('\n')[0];
    if (telegramUsername.indexOf("@") > -1) telegramUsername = telegramUsername.split('@')[1];
    const telegramID = ctx.callbackQuery.message.text.split('Telegram ID: ')[1].split('\n')[0];
    
    ctx.months.list[ctx.globalSession.currentMonth].members[telegramID] = {
      paid: true,
      plus: true
    }

    await ctx.telegram.sendMessage(telegramID, `Твоя оплата на месяц "${ctx.globalSession.currentMonth}" подтверждена, включая плюс.\n\nСсылка для вступления в основную группу: ${ctx.months.list[ctx.globalSession.currentMonth].mainInvitationLink}\nСсылка для вступления в плюсовую группу: ${ctx.months.list[ctx.globalSession.currentMonth].plusInvitationLink}.\n\nБот подтвердит твоё вступление`)
    await ctx.reply(`Добавил ${telegramID} в базовую и плюсовую подписку.`)
  } catch (error) {
    console.error('Failed to add a month:', error);
  }
});
