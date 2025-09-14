const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../../settings.json');
const { getUser, updateUser } = require('../../../db/helpers');

const changeScrollsSpent = new Scenes.BaseScene('ADMIN_SCENE_CHANGE_SCROLLS_SPENT');

changeScrollsSpent.enter(async (ctx) => {
  await ctx.replyWithHTML(`Пришли <b>количество <u>потраченных</u> билетиков</b>. Со знаком "-" количество билетиков будет увеличено`).then(nctx => {
    ctx.session.toRemove = nctx.message_id;
    ctx.session.chatID = nctx.chat.id;
  });
});

changeScrollsSpent.on('text', async (ctx) => {
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
    userData.purchases.scrollsSpent = userData.purchases.scrollsSpent - amount;
  } else {
    amount = parseInt(ctx.message.text);
    userData.purchases.scrollsSpent = userData.purchases.scrollsSpent + amount;
  }

  // Update user in database
  await updateUser(userId, userData);

  const scrolls = Math.floor(userData.purchases.groups.plus.length / 3) * 2 - userData.purchases.scrollsSpent;

  await ctx.deleteMessage(ctx.message.message_id);
  await ctx.deleteMessage(ctx.session.toRemove);
  ctx.replyWithHTML(`Изменил баланс на ${isSubstract ? '-' : ''}${amount}, новый баланс: ${scrolls}`)
  ctx.telegram.sendMessage(userId, `Твоё количество свитков было изменено на ${isSubstract ? '-' : ''}${amount}\n\nНовый баланс: ${scrolls}`)
  await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `ℹ️ ${ctx.message.from.id} changed scrollsSpent amount for ${userId} by ${isSubstract ? '-' : ''}${amount}`)
  ctx.scene.leave();
});

module.exports = changeScrollsSpent;
