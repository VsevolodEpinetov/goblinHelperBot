const { Composer } = require("telegraf");
const lotsUtils = require('../utils');
const util = require('../../util');

module.exports = Composer.action(/^action-close-lot-[0-9]+$/g, async (ctx) => {
  try {
    util.log(ctx);
    
    const lotID = parseInt(ctx.callbackQuery.data.split('action-close-lot-')[1]);

    if (!ctx.globalSession.lots[lotID]) {
      return await ctx.answerCbQuery('Лот не найден');
    }

    const lotData = ctx.globalSession.lots[lotID];

    if (!lotsUtils.isUserAuthorizedToClose(ctx, lotData)) {
      return await ctx.answerCbQuery('Только создатель может закрыть лот!');
    }

    if (!lotData.opened) {
      return await ctx.answerCbQuery('Лот уже закрыт!');
    }

    // Mark the lot as closed
    lotData.opened = false;

    // Remove any additional system messages
    if (lotData.additionalMessageID) {
      await ctx.telegram.deleteMessage(lotData.chatID, lotData.additionalMessageID);
    }

    // Update the caption to indicate the lot is closed
    await lotsUtils.updateLotMessageCaption(ctx, lotID, lotData, true);

    await ctx.answerCbQuery('Лот успешно закрыт!');
  } catch (error) {
    console.error('Failed to close lot:', error);
    await ctx.reply('Ошибка при закрытии лота.');
  }
});
