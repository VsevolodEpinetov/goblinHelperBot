const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const { t } = require('../../../modules/i18n');
const SETTINGS = require('../../../settings.json');
const { getUser } = require('../../db/helpers');

module.exports = Composer.action('userMenu', async (ctx) => {
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData) return;
  const roles = userData.roles;

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