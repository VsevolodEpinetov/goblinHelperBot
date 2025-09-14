const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { getUserSubscriptionStatus, getCurrentMonthPeriod } = require('../subscriptionHelpers');
const { createSubscriptionInvoice } = require('../../payments/subscriptionPaymentService');

module.exports = Composer.action('payCurrentMonth', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}

  try {
    const userData = await getUser(ctx.from.id);
    if (!userData) {
      await ctx.editMessageText(
        '❌ <b>Лицо не найдено в хрониках</b>\n\n' +
        'Твои следы растворились в тумане логова. Попробуй позже или позови старейшину.',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'refreshUserStatus')]])
        }
      );
      return;
    }

    // Check current subscription status
    const subscriptionStatus = await getUserSubscriptionStatus(userData.id);
    const currentPeriod = getCurrentMonthPeriod();

    if (subscriptionStatus.status !== 'unpaid') {
      // User already has a subscription
      await ctx.editMessageText(
        `✅ <b>Архив уже оплачен</b>\n\n` +
        `Ты внёс взнос за <b>${currentPeriod}</b>. Казна довольна, ворчать повода нет.\n\n` +
        `Если это ошибка — жми «Обновить» в главном меню.`,      
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'refreshUserStatus')]])
        }
      );
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
      discountText + testModeText;

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
      ],
      [Markup.button.callback('⬅️ Назад', 'refreshUserStatus')]
    ];

    await ctx.editMessageText(paymentMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(paymentKeyboard)
    });

  } catch (error) {
    console.error('Error in payCurrentMonth:', error);
    await ctx.editMessageText(
      '❌ <b>Платёжный дух споткнулся</b>\n\nПопробуй ещё раз позже или позови старейшину.',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Назад', 'refreshUserStatus')]])
      }
    );
  }
});
