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
    // We need to manually execute the payCurrentMonth logic here
    const { getUser } = require('../../../db/helpers');
    const { getUserSubscriptionStatus, getCurrentMonthPeriod } = require('../../subscriptionHelpers');
    const { hasAchievement, getAchievementMultiplier, YEARS_OF_SERVICE } = require('../../../loyalty/achievementsService');
    const { applyTestUserPricing } = require('../../../payments/pricingUtils');
    
    try {
      const userData = await getUser(ctx.from.id);
      if (!userData) {
        await ctx.replyWithHTML(
          '❌ <b>Лицо не найдено в хрониках</b>\n\n' +
          'Твои следы растворились в тумане логова. Попробуй позже или позови старейшину.'
        );
        return;
      }

      // Check current subscription status
      const subscriptionStatus = await getUserSubscriptionStatus(userData.id);
      const currentPeriod = getCurrentMonthPeriod();

      if (subscriptionStatus.status !== 'unpaid') {
        // User already has a subscription
        await ctx.replyWithHTML(
          `✅ <b>Архив уже оплачен</b>\n\n` +
          `Ты внёс взнос за <b>${currentPeriod}</b>. Казна довольна, ворчать повода нет.\n\n` +
          `Если это ошибка — жми «Обновить» в главном меню.`
        );
        return;
      }

      // Get base prices and calculate discounts
      const SBP_PAYMENT = 'sbp_payment';
      const regularBasePrice = parseInt(process.env.REGULAR_PRICE);
      const plusBasePrice = parseInt(process.env.PLUS_PRICE);

      // Apply achievement discounts
      const hasYears = await hasAchievement(Number(userData.id), YEARS_OF_SERVICE);
      const hasSbpPayment = await hasAchievement(Number(userData.id), SBP_PAYMENT);
      const achievementMultiplier = hasYears ? getAchievementMultiplier(YEARS_OF_SERVICE) : 1.0;
      const discountPercent = hasYears ? Math.round((1 - achievementMultiplier) * 100) : 0;

      let regularPrice = Math.round(regularBasePrice * achievementMultiplier);
      let plusPrice = Math.round(plusBasePrice * achievementMultiplier);
      
      // Apply test user pricing (overrides all other discounts)
      regularPrice = applyTestUserPricing(Number(userData.id), regularPrice);
      plusPrice = applyTestUserPricing(Number(userData.id), plusPrice);

      const discountText = hasYears ? `\n\n🏅 <b>Скидка «За выслугу лет»:</b> −${discountPercent}%` : '';

      let paymentMessage = '💰 <b>Выбери доступ к архиву на месяц</b>\n\n';

      if (hasYears && discountPercent > 0) {
        paymentMessage +=
          `Обычный — ~~${regularBasePrice}⭐~~ <b>${regularPrice}⭐</b>\n` +
          `Расширенный — ~~${plusBasePrice}⭐~~ <b>${plusPrice}⭐</b>\n`;
      } else {
        paymentMessage +=
          `Обычный — <b>${regularPrice}⭐</b>\n` +
          `Расширенный — <b>${plusPrice}⭐</b>\n`;
      }

      paymentMessage +=
        `\n🕯 Главгоблин шепчет: хочешь сокровищ — плати звёздами; хочешь уважения — соблюдай Законы логова.` +
        discountText;

      const regularLabel = hasYears
        ? `Обычный (${regularPrice}⭐, -${discountPercent}%)`
        : `Обычный (${regularPrice}⭐)`;
      const plusLabel = hasYears
        ? `Расширенный (${plusPrice}⭐, -${discountPercent}%)`
        : `Расширенный (${plusPrice}⭐)`;

      const paymentKeyboard = [
        [
          Markup.button.callback(regularLabel, 'payRegularMonth'),
          Markup.button.callback(plusLabel, 'payPlusMonth')
        ]
      ];

      // Add SBP payment option if user has the achievement
      if (hasSbpPayment) {
        paymentKeyboard.push([Markup.button.callback('🏦 СБП', 'paySbpMonth')]);
      }

      paymentKeyboard.push([Markup.button.callback('⬅️ Назад', 'refreshUserStatus')]);

      await ctx.replyWithHTML(paymentMessage, {
        ...Markup.inlineKeyboard(paymentKeyboard)
      });

    } catch (error) {
      console.error('Error in payCurrentMonth redirect:', error);
      await ctx.replyWithHTML(
        '❌ <b>Платёжный дух споткнулся</b>\n\nПопробуй ещё раз позже или позови старейшину.'
      );
    }
    return;
  }
  // For other payment types, use the old scene (kickstarters, etc.)
  ctx.scene.enter('SEND_PAYMENT');
});