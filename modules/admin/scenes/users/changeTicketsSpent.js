const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../../settings.json')

const changeTicketsSpent = new Scenes.BaseScene('ADMIN_SCENE_CHANGE_TICKETS_SPENT');

changeTicketsSpent.enter(async (ctx) => {
  await ctx.replyWithHTML(`Пришли <b>количество <u>потраченных</u> билетиков</b>. Со знаком "-" количество билетиков будет увеличено`).then(nctx => {
    ctx.session.toRemove = nctx.message_id;
    ctx.session.chatID = nctx.chat.id;
  });
});

changeTicketsSpent.on('text', async (ctx) => {
  const isSubstract = ctx.message.text.indexOf('-') > -1 ? true : false;
  const userId = ctx.userSession.userId;
  let amount = 0;

  if (isSubstract) {
    amount = parseInt(ctx.message.text.split('-')[1]);
    ctx.users.list[userId].purchases.ticketsSpent = ctx.users.list[userId].purchases.ticketsSpent - amount;
  } else {
    amount = parseInt(ctx.message.text);
    ctx.users.list[userId].purchases.ticketsSpent = ctx.users.list[userId].purchases.ticketsSpent + amount;
  }

  const tickets = Math.floor(ctx.users.list[userId].purchases.groups.plus.length / 3) * 2 - ctx.users.list[userId].purchases.ticketsSpent;

  await ctx.deleteMessage(ctx.message.message_id);
  await ctx.deleteMessage(ctx.session.toRemove);
  ctx.replyWithHTML(`Изменил баланс на ${isSubstract ? '-' : ''}${amount}, новый баланс: ${tickets}`)
  ctx.telegram.sendMessage(userId, `Твоё количество билетиков было изменено на ${isSubstract ? '-' : ''}${amount}\n\nНовый баланс: ${tickets}`)
  await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `ℹ️ ${ctx.message.from.id} changed ticketsSpent amount for ${userId} by ${isSubstract ? '-' : ''}${amount}`)
  ctx.scene.leave();
});

module.exports = changeTicketsSpent;
