const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../../settings.json');
const { getUser, updateUser } = require('../../../db/helpers');

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

  // Get current user data
  const userData = await getUser(userId);
  if (!userData) {
    await ctx.replyWithHTML('Пользователь не найден');
    ctx.scene.leave();
    return;
  }

  if (isSubstract) {
    amount = parseInt(ctx.message.text.split('-')[1]);
    userData.purchases.ticketsSpent = userData.purchases.ticketsSpent - amount;
  } else {
    amount = parseInt(ctx.message.text);
    userData.purchases.ticketsSpent = userData.purchases.ticketsSpent + amount;
  }

  // Update user in database
  await updateUser(userId, userData);

  const tickets = Math.floor(userData.purchases.groups.plus.length / 3) * 2 - userData.purchases.ticketsSpent;

  await ctx.deleteMessage(ctx.message.message_id);
  await ctx.deleteMessage(ctx.session.toRemove);
  ctx.replyWithHTML(`Изменил баланс на ${isSubstract ? '-' : ''}${amount}, новый баланс: ${tickets}`)
  ctx.telegram.sendMessage(userId, `Твоё количество билетиков было изменено на ${isSubstract ? '-' : ''}${amount}\n\nНовый баланс: ${tickets}`)
  await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `ℹ️ ${ctx.message.from.id} changed ticketsSpent amount for ${userId} by ${isSubstract ? '-' : ''}${amount}`)
  ctx.scene.leave();
});

module.exports = changeTicketsSpent;
