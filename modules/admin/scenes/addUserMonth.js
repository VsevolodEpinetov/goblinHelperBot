const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const { getUser, updateUser, getMonths, addUserToGroup, incrementMonthCounter } = require('../../db/helpers');

const sceneAddUserMonth = new Scenes.BaseScene('ADMIN_SCENE_ADD_USER_MONTH');

sceneAddUserMonth.enter(async (ctx) => {
  await ctx.replyWithHTML(`Пришли год-месяц, который нужно добавить. В конце "+", если плюс (duh)`).then(nctx => {
    ctx.session.toRemove = nctx.message_id;
  });
});

sceneAddUserMonth.on('text', async (ctx) => {
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

  let monthExists = false;
  let alreadyHave = false;

  // Check if month exists in PostgreSQL
  const monthsData = await getMonths();
  if (monthsData.list[year] && monthsData.list[year][month]) {
    monthExists = true;
  }

  if (userData.purchases.groups[type].indexOf(`${year}_${month}`) > -1) {
    alreadyHave = true;
  }

  if (!monthExists) {
    await ctx.replyWithHTML(`Отец, ${year}-${month} не существует. Попробуй ещё разок`)
    ctx.scene.enter('ADMIN_SCENE_ADD_USER_MONTH')
    return;
  }

  if (alreadyHave) {
    await ctx.replyWithHTML(`Отец, ${year}-${month} уже есть у этого пользователя. Попробуй ещё разок`)
    ctx.scene.enter('ADMIN_SCENE_ADD_USER_MONTH')
    return;
  }

  // Add user to group and increment month counter in PostgreSQL
  await addUserToGroup(userId, year, month, type);
  await incrementMonthCounter(year, month, type, 'paid');
  await ctx.replyWithHTML(`Добавил ${userData.username != 'not_set' ? `@${userData.username}` : `${userData.first_name}`} ${year}_${month}_${type}\n\n<b>Обычные:</b> ${userData.purchases.groups.regular.join(', ')}\n<b>Плюсовые:</b> ${userData.purchases.groups.plus.join(', ')}`, {
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
  await ctx.telegram.sendMessage(userId, `Тебе был выдан доступ к ${year}-${month} ${type == 'plus' ? 'Плюс' : ''}`)
  await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `ℹ️ ${ctx.message.from.id} gave a month ${year}-${month} ${type == 'plus' ? 'Плюс' : ''} access to ${userId}`)

  ctx.scene.leave();
});

module.exports = sceneAddUserMonth;
