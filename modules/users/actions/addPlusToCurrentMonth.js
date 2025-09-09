const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const { getUser } = require('../../db/helpers');

module.exports = Composer.action('addPlusToCurrentMonth', async (ctx) => {
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData) return;

  // Get current period safely  
  const { getCurrentPeriod } = require('../menuSystem');
  const currentPeriodInfo = getCurrentPeriod(ctx);
  const hasRegular = userData.purchases.groups.regular.indexOf(currentPeriodInfo.period) > -1;
  const hasPlus = userData.purchases.groups.plus.indexOf(currentPeriodInfo.period) > -1;
  
  if (!hasRegular) {
    await ctx.answerCbQuery('❌ Сначала нужно оплатить обычную подписку на текущий месяц!');
    return;
  }
  
  if (hasPlus) {
    await ctx.answerCbQuery('✅ У вас уже есть ➕ подписка на текущий месяц!');
    return;
  }
  
  // Get discounted price
  const { hasYearsOfService, getAchievementMultiplier, YEARS_OF_SERVICE } = require('../../loyalty/achievementsService');
  const hasYears = await hasYearsOfService(Number(ctx.callbackQuery.from.id));
  const achievementMultiplier = hasYears ? getAchievementMultiplier(YEARS_OF_SERVICE) : 1.0;
  const discountPercent = hasYears ? Math.round((1 - achievementMultiplier) * 100) : 0;
  
  const basePlusPrice = parseInt(process.env.PLUS_PRICE || '1000');
  const discountedPrice = Math.round(basePlusPrice * achievementMultiplier);
  
  const priceText = hasYears ? 
    `💰 <b>Стоимость:</b> ~~${basePlusPrice}⭐~~ ${discountedPrice}⭐ (скидка ${discountPercent}%)\n\n` :
    `💰 <b>Стоимость:</b> ${discountedPrice}⭐\n\n`;

  const plusMessage = `⭐ <b>ДОБАВЛЕНИЕ ➕ К ТЕКУЩЕМУ МЕСЯЦУ</b>\n\n` +
    `📅 <b>Период:</b> ${currentPeriodInfo.display}\n` +
    priceText +
    `🎁 <b>Что дает ➕ подписка:</b>\n` +
    `• Ранний доступ к релизам\n` +
    `• Эксклюзивные материалы\n` +
    `• 2 билетика за каждые 3 месяца ➕\n` +
    `• Приоритетная поддержка\n\n` +
    `💡 Оплата через встроенные платежи.\n`;

  const plusKeyboard = [
    [Markup.button.callback('⭐ Купить ➕ подписку', 'confirmPlusPurchase')]
  ];
  
  plusKeyboard.push([Markup.button.callback(require('../../../modules/i18n').t('messages.back'), 'userMenu')]);

  await ctx.editMessageText(plusMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(plusKeyboard)
  });
});
