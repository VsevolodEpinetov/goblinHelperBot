const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../../settings.json');
const { splitMenu, isSuperUser } = require("../../../util");
const { getKickstarters } = require('../../../db/helpers');

const searchKickstarterString = new Scenes.BaseScene('SCENE_SEARCH_STRING');

searchKickstarterString.enter(async (ctx) => {
  await ctx.replyWithHTML(`Пришли <b>строку</b> не менее 4 символов, по которой будет идти поиск проекта.\n\n<i>Поиск идёт по полям:\n— Название\n— Автор\n— Теги (мои)\n— Ссылка на проект</i>`).then(nctx => {
    ctx.session.toRemove = nctx.message_id;
    ctx.session.chatID = nctx.chat.id;
  });
});

searchKickstarterString.on('text', async (ctx) => {
  const searchString = ctx.message.text.toLowerCase();
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

  const kickstartersData = await getKickstarters();

  kickstartersData.list.forEach((project, id) => {
    for (const key in project) {
      if (results.indexOf(id) < 0) {
        if (typeof project[key] == 'object') {
          project[key].forEach(d => {
            if (d.toLowerCase().indexOf(searchString) > -1 && results.indexOf(id) < 0) {
              results.push(id);
            }
          })
        } else {
          if (project[key].toLowerCase().indexOf(searchString) > -1 && results.indexOf(id) < 0) {
            results.push(id);
          }
        }
      }
    }
  });

  let message = `Не было найдено ни одного кикстартера, отправить запрос?`;
  let menu = [
    Markup.button.callback('Отправить запрос', `sendRequest`),
    Markup.button.callback('Не надо', `cancel`)
  ]

  ctx.userSession.results = results;

  if (results.length > 0) {
    message = `Найдено ${results.length} проектов\n\n`;
    menu = [];
    results.forEach((ksID, id) => {
      message += `${id + 1}. ${kickstartersData.list[ksID].creator} - ${kickstartersData.list[ksID].name}\n`
      menu.push(Markup.button.callback(id + 1, `showKickstarter_${id}`))
    })

    message += `\nКакой проект вывести?`
  }

  let bottomButtonAction = isSuperUser(ctx.message.from.id) ? 'adminKickstarters' : 'userKickstarters';

  menu = splitMenu(menu, 6);

  ctx.replyWithHTML(message, {
    ...Markup.inlineKeyboard([
      ...menu,
      [
        Markup.button.callback('←', bottomButtonAction),
        Markup.button.callback('🔍', 'searchKickstarter')
      ]
    ])
  })

  ctx.scene.leave();

});

module.exports = searchKickstarterString;