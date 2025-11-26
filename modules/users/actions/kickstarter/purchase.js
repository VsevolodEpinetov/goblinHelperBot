const { Composer, Markup } = require("telegraf");
const { getKickstarter, getUser, hasUserPurchasedKickstarter } = require('../../../db/helpers');
const { getUsableScrolls } = require('../../../util/scrolls');
const { createKickstarterInvoice } = require('../../../payments/kickstarterPaymentService');
const { hasYearsOfService, getAchievementMultiplier, YEARS_OF_SERVICE } = require('../../../loyalty/achievementsService');
const { applyTestUserPricing, isTestUser } = require('../../../payments/pricingUtils');

module.exports = Composer.action(/^purchaseKickstarter_(\d+)$/, async (ctx) => {
  try {
    const kickstarterId = parseInt(ctx.match[1]);
    const userId = ctx.from.id;

    // Get kickstarter data
    const kickstarterData = await getKickstarter(kickstarterId);
    if (!kickstarterData) {
      await ctx.answerCbQuery('❌ Демон молчит. Эта сделка в свитках не значится.');
      return;
    }

    // Check if user already has this kickstarter
    const alreadyHas = await hasUserPurchasedKickstarter(userId, kickstarterId);
    if (alreadyHas) {
      await ctx.answerCbQuery('🧐 Эта сделка уже в твоём гримуаре.');
      return;
    }

    // Get user data
    const userData = await getUser(userId);
    if (!userData) {
      await ctx.answerCbQuery('❌ Пользователь не найден');
      return;
    }

    // Calculate price with achievement discounts
    const hasYears = await hasYearsOfService(Number(userId));
    const achievementMultiplier = hasYears ? getAchievementMultiplier(YEARS_OF_SERVICE) : 1.0;
    const basePrice = kickstarterData.cost;
    let discountedPrice = Math.round(basePrice * achievementMultiplier);
    const discountPercent = hasYears ? Math.round((1 - achievementMultiplier) * 100) : 0;
    
    // Apply test user pricing (overrides all other discounts)
    discountedPrice = applyTestUserPricing(Number(userId), discountedPrice);

    // Check for usable scrolls (use discounted price for scroll threshold check)
    const usableScrolls = await getUsableScrolls(userId, discountedPrice);

    if (usableScrolls.length > 0) {
      // User has scrolls - offer choice
      let message = `😈 <b>Сделка с демоном</b>\n\n`;
      message += `<b>${kickstarterData.name}</b>\n`;
      message += `Источник силы: <b>${kickstarterData.creator}</b>\n`;
      
      if (hasYears && discountPercent > 0) {
        message += `Цена ритуала: ~~${basePrice}⭐~~ <b>${discountedPrice}⭐</b>\n`;
        message += `🏅 Скидка «За выслугу лет»: −${discountPercent}%\n\n`;
      } else {
        message += `Цена ритуала: <b>${discountedPrice}⭐</b>\n\n`;
      }
      
      message += `📜 <b>Доступные свитки Кругов</b>\n`;
      message += `Ты можешь заменить звёзды свитком достаточной силы:\n\n`;
      
      usableScrolls.forEach((scroll, index) => {
        message += `${index + 1}. <b>${scroll.scrollDef.name}</b> — ${scroll.amount} шт.\n`;
      });
      
      message += `\nВыбери, чем оплатить ритуал:`; 
      

      const keyboard = [];
      
      // Add scroll buttons
      usableScrolls.forEach((scroll, index) => {
        keyboard.push([
          Markup.button.callback(
            `📜 Использовать ${scroll.scrollDef.name} (${scroll.amount} шт.)`,
            `purchaseKickstarterWithScroll_${kickstarterId}_${scroll.scrollId}`
          )
        ]);
      });

      // Add stars payment button (show discounted price)
      const priceLabel = hasYears && discountPercent > 0 
        ? `⭐ Оплатить ${discountedPrice}⭐ (было ${basePrice}⭐)`
        : `⭐ Оплатить ${discountedPrice}⭐`;
      keyboard.push([
        Markup.button.callback(priceLabel, `purchaseKickstarterWithStars_${kickstarterId}`)
      ]);

      keyboard.push([
        Markup.button.callback('❌ Отмена', 'userKickstarters')
      ]);

      await ctx.answerCbQuery('Открываю меню оплаты...');
      // Send payment menu to user's DM instead of the group
      await ctx.telegram.sendMessage(userId, message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(keyboard)
      });
    } else {
      // No scrolls - send invoice directly
      await ctx.answerCbQuery('Открываю счёт...');
      const result = await createKickstarterInvoice(ctx, kickstarterId, userId);
      
      if (!result.success) {
        // Send error message to user's DM
        await ctx.telegram.sendMessage(userId, `❌ Ошибка создания счёта: ${result.error}`);
      }
    }
  } catch (error) {
    console.error('Error in purchase kickstarter:', error);
    await ctx.answerCbQuery('❌ Произошла ошибка');
  }
});
