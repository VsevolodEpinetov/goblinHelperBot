const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../../settings.json');
const { getUser, updateUser } = require('../../../db/helpers');

const changeBalance = new Scenes.BaseScene('ADMIN_SCENE_CHANGE_BALANCE');

changeBalance.enter(async (ctx) => {
  await ctx.replyWithHTML(`Пришли <b>строку</b>`).then(nctx => {
    ctx.session.toRemove = nctx.message_id;
    ctx.session.chatID = nctx.chat.id;
  });
});

changeBalance.on('text', async (ctx) => {
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
    userData.purchases.balance = userData.purchases.balance - amount;
  } else {
    amount = parseInt(ctx.message.text);
    userData.purchases.balance = userData.purchases.balance + amount;
  }

  // Update user in database
  await updateUser(userId, userData);

  await ctx.deleteMessage(ctx.message.message_id);
  await ctx.deleteMessage(ctx.session.toRemove);
  ctx.replyWithHTML(`Изменил баланс на ${isSubstract ? '-' : ''}${amount}, новый баланс: ${userData.purchases.balance}`)
  ctx.telegram.sendMessage(userId, `Твой баланс был изменён на ${isSubstract ? '-' : ''}${amount}\n\nНовый баланс: ${userData.purchases.balance}`)
  await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `ℹ️ ${ctx.message.from.id} changed balance ${userId} by ${isSubstract ? '-' : ''}${amount}`)
  ctx.scene.leave();
});

// Deprecated: balance management removed
module.exports = changeBalance;
