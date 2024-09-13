const { Composer } = require("telegraf");
const lotsUtils = require('../utils');
const util = require('../../util');

module.exports = Composer.action(/^action-leave-lot-[0-9]+$/g, async (ctx) => {
  try {
    util.log(ctx);
    
    const lotID = parseInt(ctx.callbackQuery.data.split('action-leave-lot-')[1]);

    if (!ctx.globalSession.lots[lotID]) {
      return await ctx.answerCbQuery('Лот не найден');
    }

    const lotData = ctx.globalSession.lots[lotID];

    if (!lotData.opened) {
      return await ctx.answerCbQuery('Этот лот уже закрыт!');
    }

    const userID = ctx.callbackQuery.from.id;
    const participantIndex = lotData.participants.findIndex((p) => p.id === userID);

    if (participantIndex === -1) {
      return await ctx.answerCbQuery('Вы не участвуете в этом лоте!');
    }

    // Remove the user from the participants list
    lotData.participants.splice(participantIndex, 1);

    // Update the caption and participants
    await lotsUtils.updateLotMessageCaption(ctx, lotID, lotData);

    await ctx.answerCbQuery('Вы вышли из лота!');
  } catch (error) {
    console.error('Failed to leave lot:', error);
    await ctx.reply('Ошибка при выходе из лота.');
  }
});
