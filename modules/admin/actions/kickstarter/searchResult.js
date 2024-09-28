const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action('searchResultKickstarter', async (ctx) => {
  await ctx.deleteMessage(ctx.callbackQuery.message.message_id);

  const results = ctx.userSession.results;
  let menu = [];

  if (results.length > 0) {
    message = `Найдено ${results.length} проектов\n\n`;
    results.forEach((ksID, id) => {
      message += `${id + 1}. ${ctx.kickstarters.list[ksID].creator} - ${ctx.kickstarters.list[ksID].name}\n`
      menu.push(Markup.button.callback(id + 1, `showKickstarter_${id}`))
    })

    message += `\nКакой проект вывести?`
  }

  let bottomButtonAction = util.isSuperUser(ctx.callbackQuery.from.id) ? 'adminKickstarters' : 'userKickstarters';

  menu = util.splitMenu(menu, 6)

  ctx.replyWithHTML(message, {
    ...Markup.inlineKeyboard([
      ...menu,
      [
        Markup.button.callback('←', bottomButtonAction),
        Markup.button.callback('🔍', 'searchKickstarter')
      ]
    ])
  })

});