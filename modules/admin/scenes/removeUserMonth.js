const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const { getUser, updateUser, incrementMonthCounter } = require('../../db/helpers');

const sceneRemoveUserMonth = new Scenes.BaseScene('ADMIN_SCENE_REMOVE_USER_MONTH');

sceneRemoveUserMonth.enter(async (ctx) => {
  await ctx.replyWithHTML(`Пришли год-месяц, который нужно убрать. В конце "+", если плюс (duh)`).then(nctx => {
    ctx.session.toRemove = nctx.message_id;
  });
});

sceneRemoveUserMonth.on('text', async (ctx) => {
  const userId = ctx.userSession.userId;
  const data = ctx.message.text.split('-');
  const userData = await getUser(userId);
  const year = data[0], type = data[1].indexOf('+') > -1 ? 'plus' : 'regular', month = type == 'regular' ? data[1] : data[1].split('+')[0];
  await ctx.deleteMessage(ctx.session.toRemove);
  await ctx.deleteMessage(ctx.message.message_id);

  if (!userData) {
    await ctx.replyWithHTML('Пользователь не найден');
    ctx.scene.leave();
    return;
  }

  let alreadyHave = false;

  if (userData.purchases.groups[type].indexOf(`${year}_${month}`) > -1) {
    alreadyHave = true;
  }

  if (!alreadyHave) {
    await ctx.replyWithHTML(`Отец, ${year}-${month} нет у этого пользователя. Попробуй ещё разок`)
    ctx.scene.enter('ADMIN_SCENE_ADD_USER_MONTH')
    return;
  }

  // Remove user from group and decrement month counter in PostgreSQL
  let copy = userData.purchases.groups[type];
  let index = copy.indexOf(`${year}_${month}`);
  if (index !== -1) {
    copy.splice(index, 1);
  }

  userData.purchases.groups[type] = copy;
  await updateUser(userId, userData);
  await incrementMonthCounter(year, month, type, 'paid', -1);
  await ctx.replyWithHTML(`Убрал у ${userData.username != 'not_set' ? `@${userData.username}` : `${userData.first_name}`} ${year}_${month}_${type}\n\n<b>Обычные:</b> ${userData.purchases.groups.regular.join(', ')}\n<b>Плюсовые:</b> ${userData.purchases.groups.plus.join(', ')}`, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback(`Добавить`, `addUserMonth_${userId}`),
        Markup.button.callback(`Убрать`, `removeUserMonth_${userId}`),
      ],
      [
        Markup.button.callback('←', `showUser_${userId}`),
        Markup.button.callback('В начало', `userMenu`)
      ]
    ])
  })
  await ctx.telegram.sendMessage(userId, `У тебя забрали доступ к ${year}-${month} ${type == 'plus' ? ' Плюс' : ''}`)
  await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `ℹ️ ${ctx.message.from.id} removed a month ${year}-${month} ${type == 'plus' ? 'Плюс' : ''} access from ${userId}`)

  ctx.scene.leave();
});

module.exports = sceneRemoveUserMonth;
