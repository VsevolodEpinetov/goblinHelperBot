const { Composer, Markup } = require('telegraf');
const lotsUtils = require('../utils')
const SETTINGS = require('../../../settings.json');

module.exports = Composer.command('nf', async (ctx) => {
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) {
    return;
  }

  const lotID = ctx.message.text.split(' ')[1];
  const lotData = ctx.globalSession.lots[lotID];

  await lotsUtils.updateLotMessageCaption(ctx, lotID, lotData);
})