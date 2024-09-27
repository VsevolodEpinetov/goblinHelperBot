const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action(/^finishAdminPayment_/g, async (ctx) => {
  const paymentId = ctx.callbackQuery.data.split('_')[1];

  ctx.globalSession.toRemove[SETTINGS.CHATS.EPINETOV][paymentId].forEach(async messageId => {
    await ctx.deleteMessage(messageId);
  })

  ctx.globalSession.toRemove[SETTINGS.CHATS.EPINETOV][paymentId] = null;
});