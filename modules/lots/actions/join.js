const { Composer } = require("telegraf");
const lotsUtils = require('../utils');
const util = require('../../util');

module.exports = Composer.action(/^action-join-lot-[0-9]+$/g, async (ctx) => {
  try {
    util.log(ctx);
    
    const lotID = parseInt(ctx.callbackQuery.data.split('action-join-lot-')[1]);

    if (!ctx.globalSession.lots[lotID]) {
      return await ctx.answerCbQuery('Лот не найден');
    }

    const lotData = ctx.globalSession.lots[lotID];

    if (!lotData.opened) {
      return await ctx.answerCbQuery('Этот лот уже закрыт!');
    }

    const userID = ctx.callbackQuery.from.id;

    if (lotData.participants.some((p) => p.id === userID)) {
      return await ctx.answerCbQuery('Ты уже участвуешь в лоте!');
    }

    // Add the user to the participants list
    lotData.participants.push(ctx.callbackQuery.from);

    // Update the caption and participants
    await lotsUtils.updateLotMessageCaption(ctx, lotID, lotData);

    await ctx.answerCbQuery('Вы присоединились к лоту!');
  } catch (error) {
    console.error('Failed to join lot:', error);
    await ctx.reply('Ошибка при присоединении к лоту.');
  }
});
