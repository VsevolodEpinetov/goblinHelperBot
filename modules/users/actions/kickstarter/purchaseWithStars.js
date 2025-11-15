const { Composer } = require("telegraf");
const { createKickstarterInvoice } = require('../../../payments/kickstarterPaymentService');

module.exports = Composer.action(/^purchaseKickstarterWithStars_(\d+)$/, async (ctx) => {
  try {
    const kickstarterId = parseInt(ctx.match[1]);
    const userId = ctx.from.id;

    await ctx.answerCbQuery('Открываю счёт...');
    
    const result = await createKickstarterInvoice(ctx, kickstarterId, userId);
    
    if (!result.success) {
      await ctx.reply(`❌ Ошибка создания счёта: ${result.error}`);
    }
  } catch (error) {
    console.error('Error creating kickstarter invoice:', error);
    await ctx.answerCbQuery('❌ Произошла ошибка');
  }
});

