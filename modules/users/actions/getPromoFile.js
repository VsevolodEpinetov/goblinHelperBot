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
        caption: `🪙 Гоблинский свиток 🪙

        Ну что, путник, повезло тебе — нашёл монетку у входа в логово.  
        Гоблины не такие уж жадные, можешь оставить себе.  
        
        Но знай: это только затравка. Настоящие клады ждут глубже в Архивах.  
        В скором времени откроется ворота в Логово — и там будет настоящее буйство сокровищ.
        
        📚 Следи за вестями в нашем канале:  
        https://t.me/groupbuyrf
        
        Гоблины всегда рады новым союзникам.  
        Но помни — в темноте Архивов монетки звенят громче…`,
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
