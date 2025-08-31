const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action(/^showUser_/g, async (ctx) => {
  const userId = ctx.callbackQuery.data.split('_')[1];

  ctx.editMessageText(util.getUserDescription(ctx, userId), {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      ...util.getUserMenu(userId),
      [Markup.button.callback('🔗 Выслать ссылку', `resendInvite_${userId}`)]
    ])
  })
});