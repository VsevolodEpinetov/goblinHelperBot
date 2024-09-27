const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../../settings.json')

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

  if (isSubstract) {
    amount = parseInt(ctx.message.text.split('-')[1]);
    ctx.users.list[userId].purchases.balance = ctx.users.list[userId].purchases.balance - amount;
  } else {
    amount = parseInt(ctx.message.text);
    ctx.users.list[userId].purchases.balance = ctx.users.list[userId].purchases.balance + amount;
  }

  await ctx.deleteMessage(ctx.message.message_id);
  await ctx.deleteMessage(ctx.session.toRemove);
  ctx.replyWithHTML(`Изменил баланс на ${isSubstract ? '-' : ''}${amount}, новый баланс: ${ctx.users.list[userId].purchases.balance}`)
  ctx.telegram.sendMessage(userId, `Твой баланс был изменён на ${isSubstract ? '-' : ''}${amount}\n\nНовый баланс: ${ctx.users.list[userId].purchases.balance}`)
  await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `ℹ️ ${ctx.message.from.id} changed balance ${userId} by ${isSubstract ? '-' : ''}${amount}`)
  ctx.scene.leave();
});

module.exports = changeBalance;
