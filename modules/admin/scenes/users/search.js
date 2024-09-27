const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../../settings.json')

const searchUser = new Scenes.BaseScene('SCENE_SEARCH_USER');

searchUser.enter(async (ctx) => {
  await ctx.replyWithHTML(`Пришли <b>строку</b>`).then(nctx => {
    ctx.session.toRemove = nctx.message_id;
    ctx.session.chatID = nctx.chat.id;
  });
});

searchUser.on('text', async (ctx) => {
  const searchString = ctx.message.text;
  if (ctx.message.text.length < 4) {
    await ctx.replyWithHTML(`Минимум 4 символа. Пришли новую <b>строку</b>`).then(nctx => {
      ctx.session.toRemove = nctx.message_id;
      ctx.session.chatID = nctx.chat.id;
    });
    return;
  }

  let results = [];

  await ctx.deleteMessage(ctx.message.message_id);
  await ctx.deleteMessage(ctx.session.toRemove);

  for (const userID in ctx.users.list) {
    const userData = ctx.users.list[userID];
    const name = userData.first_name;
    const lastName = userData.last_name;
    const username = userData.username;
    if (userID.indexOf(searchString) > -1 || name.indexOf(searchString) > -1 || lastName.indexOf(searchString) > -1 || username.indexOf(searchString) > -1 ) {
      results.push(userID)
      break;
    }
  }

  let message = `Не было найдено ни одного пользователя`;
  let menu = [
  ]

  ctx.userSession.results = results;

  if (results.length > 0) {
    message = `Найдено ${results.length} пользователей\n\n`;
    menu = [];
    results.forEach((userID, id) => {
      message += `${id + 1}. ${ctx.users.list[userID].first_name}${ctx.users.list[userID].username != 'not_set' ? ` - @${ctx.users.list[userID].username}` : ''} (${userID})\n`
      menu.push(Markup.button.callback(id + 1, `showUser_${userID}`))
    })

    message += `\nКакого пользователя вывести?`
  }

  ctx.replyWithHTML(message, {
    ...Markup.inlineKeyboard([
      menu,
      [
        Markup.button.callback('←', 'adminParticipants'),
        Markup.button.callback('🔍', 'searchUser')
      ]
    ])
  })

  ctx.scene.leave();

});

module.exports = searchUser;
