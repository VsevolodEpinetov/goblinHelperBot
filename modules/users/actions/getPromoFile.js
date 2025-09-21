const { Composer, Markup } = require("telegraf");
const promoService = require('../../promo/promoService');

module.exports = Composer.action('getPromoFile', async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    // Check if user is on cooldown
    const cooldownStatus = await promoService.checkUserCooldown(userId);
    
    if (cooldownStatus.isOnCooldown) {
      const timeRemaining = promoService.getTimeRemaining(cooldownStatus.cooldownUntil);
      await ctx.answerCbQuery(`⏰ Монетка ещё не готова! Осталось: ${timeRemaining}`);
      return;
    }

    // Get a random promo file
    const promoFile = await promoService.getRandomPromoFile(userId);
    
    if (!promoFile) {
      await ctx.answerCbQuery('😔 Все монетки разобраны! Попробуй позже.');
      return;
    }

    // Record the usage
    const usageRecorded = await promoService.recordPromoUsage(userId, promoFile.id);
    
    if (!usageRecorded) {
      await ctx.answerCbQuery('❌ Произошла ошибка. Попробуй ещё раз.');
      return;
    }

    // Send the document
    try {
      await ctx.replyWithDocument(promoFile.file_id, {
        caption: '🪙 <b>Твоя монетка!</b>\n\nУдачной охоты за сокровищами!',
        parse_mode: 'HTML'
      });
      
      await ctx.answerCbQuery('🪙 Монетка получена!');
      
    } catch (sendError) {
      console.error('❌ Error sending promo file:', sendError);
      await ctx.answerCbQuery('❌ Не удалось отправить файл. Попробуй ещё раз.');
    }
    
  } catch (error) {
    console.error('❌ Error in getPromoFile:', error);
    await ctx.answerCbQuery('❌ Произошла ошибка. Попробуй ещё раз.');
  }
});
