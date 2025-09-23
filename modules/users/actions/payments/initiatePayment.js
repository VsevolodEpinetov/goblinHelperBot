const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action(/^sendPayment/g, async (ctx) => {
  try {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  } catch (e) {
    await ctx.replyWithHTML(`Из-за ограничений телеграма тебе нужно использовать /start ещё раз. Старое сообщение останется, можешь его удалить вручную, если мешает.`)
    return;
  }
  if (ctx.callbackQuery.data.indexOf('currentMonth') > -1) {
    // Redirect to the new secure payment flow instead of old scene
    const { Composer } = require('telegraf');
    const payCurrentMonthAction = require('../payCurrentMonth');
    return payCurrentMonthAction(ctx);
  }
  // For other payment types, use the old scene (kickstarters, etc.)
  ctx.scene.enter('SEND_PAYMENT');
});