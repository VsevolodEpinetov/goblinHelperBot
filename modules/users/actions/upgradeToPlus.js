const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { getUserSubscriptionStatus, getCurrentMonthPeriod } = require('../subscriptionHelpers');
const { createSubscriptionInvoice } = require('../../payments/subscriptionPaymentService');

module.exports = Composer.action('upgradeToPlus', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  console.log(`[INFO] @${ctx.from.username || ctx.from.id} (${ctx.from.id}) upgradeToPlus action - DM`);
  
  try {
    const userData = await getUser(ctx.from.id);
    if (!userData) {
      await ctx.editMessageText('❌ <b>Лицо не найдено в хрониках</b>\n\nТвои данные исчезли в тумане. Попробуй снова позже.', {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'refreshUserStatus')]])
      });
      return;
    }

    // Check current subscription status
    const subscriptionStatus = await getUserSubscriptionStatus(userData.id);
    const currentPeriod = getCurrentMonthPeriod();
    
    // Only allow upgrade if user has regular subscription
    if (subscriptionStatus.status !== 'paid_regular') {
      let errorMessage = '';
      if (subscriptionStatus.status === 'paid_plus') {
        errorMessage = `✅ <b>У тебя уже есть расширенный сундук!</b>\n\nТы уже оплатил ${currentPeriod} с расширенной версией.\n\nЕсли видишь это сообщение по ошибке, нажми "Обновить" в главном меню.`;
      } else {
        errorMessage = `❌ <b>Сначала оплати обычный сундук</b>\n\nОбновление доступно только тем, кто уже оплатил обычную версию за ${currentPeriod}.`;
      }
      
      await ctx.editMessageText(errorMessage, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'refreshUserStatus')]])
      });
      return;
    }

    // Get base prices and calculate discounts
    const { hasYearsOfService, getAchievementMultiplier, YEARS_OF_SERVICE } = require('../../loyalty/achievementsService');
    
    const regularBasePrice = parseInt(process.env.REGULAR_PRICE || '100');
    const plusBasePrice = parseInt(process.env.PLUS_PRICE || '150');
    
    // Apply achievement discounts
    const hasYears = await hasYearsOfService(Number(userData.id));
    const achievementMultiplier = hasYears ? getAchievementMultiplier(YEARS_OF_SERVICE) : 1.0;
    const discountPercent = hasYears ? Math.round((1 - achievementMultiplier) * 100) : 0;
    
    const regularPrice = Math.round(regularBasePrice * achievementMultiplier);
    const plusPrice = Math.round(plusBasePrice * achievementMultiplier);
    
    // Calculate upgrade price (difference between plus and regular)
    const upgradePrice = plusPrice - regularPrice;
    
    const isTestMode = process.env.PAYMENT_TEST_MODE === 'true';
    
    // Show upgrade options with discounted prices
    const testModeText = isTestMode ? '\n\n🧪 <b>ТЕСТОВЫЙ РЕЖИМ</b> - Платежи будут симулированы' : '';
    const discountText = hasYears ? `\n\n🏆 <b>Применена скидка "За выслугу лет": ${discountPercent}%</b>` : '';
    
    let upgradeMessage = '⬆️ <b>Обновление до Расширенного сундука</b>\n\n';
    upgradeMessage += `Ты уже оплатил обычную версию за ${currentPeriod}.\n\n`;
    upgradeMessage += `Доплата за расширенную версию:\n\n`;
    
    if (hasYears && discountPercent > 0) {
      upgradeMessage += `Обычная — ~~${regularBasePrice}⭐~~ ${regularPrice}⭐ (уже оплачено)\n`;
      upgradeMessage += `Плюс — ~~${plusBasePrice}⭐~~ ${plusPrice}⭐\n`;
      upgradeMessage += `Доплата — ${upgradePrice}⭐\n`;
    } else {
      upgradeMessage += `Обычная — ${regularPrice}⭐ (уже оплачено)\n`;
      upgradeMessage += `Плюс — ${plusPrice}⭐\n`;
      upgradeMessage += `Доплата — ${upgradePrice}⭐\n`;
    }
    
    upgradeMessage += `\n🕯 Главгоблин говорит: хочешь больше сокровищ — доплачивай звёздами.` + discountText + testModeText;

    const upgradeLabel = hasYears ? `Доплатить ${upgradePrice}⭐ (${discountPercent}% скидка)` : `Доплатить ${upgradePrice}⭐`;

    const upgradeKeyboard = [
      [
        Markup.button.callback(upgradeLabel, 'payPlusUpgrade')
      ],
      [Markup.button.callback('🔙 Назад', 'refreshUserStatus')]
    ];

    await ctx.editMessageText(upgradeMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(upgradeKeyboard)
    });
    
  } catch (error) {
    console.error('Error in upgradeToPlus:', error);
    await ctx.editMessageText('❌ <b>Произошла ошибка</b>\n\nПопробуй ещё раз позже.', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'refreshUserStatus')]])
    });
  }
});
