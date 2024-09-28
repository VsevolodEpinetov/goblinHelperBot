const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')

const sceneAddUserMonth = new Scenes.BaseScene('ADMIN_SCENE_ADD_USER_MONTH');

sceneAddUserMonth.enter(async (ctx) => {
  await ctx.replyWithHTML(`Пришли год-месяц, который нужно добавить. В конце "+", если плюс (duh)`).then(nctx => {
    ctx.session.toRemove = nctx.message_id;
  });
});

sceneAddUserMonth.on('text', async (ctx) => {
  const userId = ctx.userSession.userId;
  const data = ctx.message.text.split('-');
  const userData = ctx.users.list[userId];
  const year = data[0], type = data[1].indexOf('+') > -1 ? 'plus' : 'regular', month = type == 'regular' ? data[1] : data[1].split('+')[0];
  await ctx.deleteMessage(ctx.session.toRemove);
  await ctx.deleteMessage(ctx.message.message_id);

  let monthExists = false;
  let alreadyHave = false;

  if (ctx.months.list[year]) {
    if (ctx.months.list[year][month]) monthExists = true;
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

  ctx.users.list[userId].purchases.groups[type].push(`${year}_${month}`);
  ctx.months.list[year][month][type].counter.paid = ctx.months.list[year][month][type].counter.paid + 1;
  await ctx.replyWithHTML(`Добавил ${userData.username != 'not_set' ? `@${userData.username}` : `${userData.first_name}`} ${year}_${month}_${type}\n\n<b>Обычные:</b> ${userData.purchases.groups.regular.join(', ')}\n<b>Плюсовые:</b> ${userData.purchases.groups.plus.join(', ')}`, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback(`Добавить`, `addUserMonth_${userId}`),
        Markup.button.callback(`Убрать`, `removeUserMonth_${userId}`),
      ],
      [
        Markup.button.callback('←', `showUser_${userId}`),
        Markup.button.callback('В начало', `adminMenu`)
      ]
    ])
  })
  await ctx.telegram.sendMessage(userId, `Тебе был выдан доступ к ${year}-${month} ${type == 'plus' ? 'Плюс' : ''}`)
  await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `ℹ️ ${ctx.message.from.id} gave a month ${year}-${month} ${type == 'plus' ? 'Плюс' : ''} access to ${userId}`)

  ctx.scene.leave();
});

module.exports = sceneAddUserMonth;
