const { Composer, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.command('pa', async (ctx) => {
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) { return; }
  const telegramID = ctx.message.text.split('/pa ')[1];

  ctx.globalSession.months[ctx.globalSession.currentMonth].members[telegramID] = {
    paid: true,
    plus: false
  }

  await ctx.telegram.sendMessage(telegramID, `Твоя оплата на месяц "${ctx.globalSession.currentMonth}" подтверждена.\n\nСсылка для вступления в группу: ${ctx.globalSession.months[ctx.globalSession.currentMonth].mainInvitationLink}.\n\nБот подтвердит твоё вступление`)
  await ctx.reply(`Добавил ${telegramID} в базовую подписку.`)
})