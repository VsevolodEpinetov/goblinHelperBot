const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action(/^sendPayment/g, async (ctx) => {
  await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  if (ctx.callbackQuery.data.indexOf('currentMonth') > -1) {
    ctx.userSession.purchasing = {
      type: 'group',
      year: ctx.globalSession.current.year,
      month: ctx.globalSession.current.month,
      userId: ctx.callbackQuery.from.id,
      isOld: false
    }
  }
  ctx.scene.enter('SEND_PAYMENT');
});