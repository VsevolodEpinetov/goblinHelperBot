const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const SETTINGS = require('../../../settings.json');

module.exports = Composer.action(/^userMenu/g, async (ctx) => {
  const userData = ctx.users.list[ctx.callbackQuery.from.id];

  if (userData.roles.indexOf('goblin') > -1) {
    const message = util.getUserMessage(ctx, userData)
    let menu = util.getUserButtons(ctx, userData);

    if (roles.indexOf('polls') > -1) {
      menu = [
        [
          Markup.button.callback('Голосования', `adminPolls`),
        ],
        ...menu
      ]
    }
    
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(menu)
    });
    return;
  }
});