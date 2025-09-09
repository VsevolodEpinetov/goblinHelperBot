const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { getUserSubscriptionStatus, getCurrentMonthPeriod } = require('../subscriptionHelpers');
const { createSubscriptionInvoice } = require('../../payments/subscriptionPaymentService');
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('payCurrentMonth', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    const userData = await getUser(ctx.from.id);
    if (!userData) {
      await ctx.editMessageText(t('messages.user_not_found'), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.months.back'), 'refreshUserStatus')]])
      });
      return;
    }

    // Check current subscription status
    const subscriptionStatus = await getUserSubscriptionStatus(userData.id);
    const currentPeriod = getCurrentMonthPeriod();
    
    if (subscriptionStatus.status !== 'unpaid') {
      // User already has a subscription
      await ctx.editMessageText(t('payments.subscription.alreadyHas', { period: currentPeriod }), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.months.back'), 'refreshUserStatus')]])
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
    
    const isTestMode = process.env.PAYMENT_TEST_MODE === 'true';
    
    // Show payment options with discounted prices
    const testModeText = isTestMode ? '\n\n🧪 <b>ТЕСТОВЫЙ РЕЖИМ</b> - Платежи будут симулированы' : '';
    const discountText = hasYears ? `\n\n🏆 <b>Применена скидка "За выслугу лет": ${discountPercent}%</b>` : '';
    
    let paymentMessage = t('payments.subscription.choose') + `\n\n`;
    
    if (hasYears && discountPercent > 0) {
      paymentMessage += `${t('payments.subscription.regular')} — ~~${regularBasePrice}⭐~~ ${regularPrice}⭐\n`;
      paymentMessage += `${t('payments.subscription.plus')} — ~~${plusBasePrice}⭐~~ ${plusPrice}⭐\n`;
    } else {
      paymentMessage += `${t('payments.subscription.regular')} — ${regularPrice}⭐\n`;
      paymentMessage += `${t('payments.subscription.plus')} — ${plusPrice}⭐\n`;
    }
    
    paymentMessage += `\n` + t('messages.explain') + discountText + testModeText;

    const regularLabel = hasYears ? `${t('payments.subscription.regularLabel')} (${regularPrice}⭐, -${discountPercent}%)` : `${t('payments.subscription.regularLabel')} (${regularPrice}⭐)`;
    const plusLabel = hasYears ? `${t('payments.subscription.plusLabel')} (${plusPrice}⭐, -${discountPercent}%)` : `${t('payments.subscription.plusLabel')} (${plusPrice}⭐)`;

    const paymentKeyboard = [
      [
        Markup.button.callback(regularLabel, 'payRegularMonth'),
        Markup.button.callback(plusLabel, 'payPlusMonth')
      ],
      [Markup.button.callback(t('messages.months.back'), 'refreshUserStatus')]
    ];

    await ctx.editMessageText(paymentMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(paymentKeyboard)
    });
    
  } catch (error) {
    console.error('Error in payCurrentMonth:', error);
    await ctx.editMessageText(t('messages.try_again_later'), {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.months.back'), 'refreshUserStatus')]])
    });
  }
});
