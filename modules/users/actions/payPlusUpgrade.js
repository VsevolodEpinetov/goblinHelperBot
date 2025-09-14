const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { getUserSubscriptionStatus, getCurrentMonthPeriod } = require('../subscriptionHelpers');
const { createUpgradeInvoice } = require('../../payments/subscriptionPaymentService');

module.exports = Composer.action('payPlusUpgrade', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  console.log(`[INFO] @${ctx.from.username || ctx.from.id} (${ctx.from.id}) payPlusUpgrade action - DM`);
  
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
        errorMessage = `✅ <b>У тебя уже есть расширенный сундук!</b>\n\nТы уже оплатил ${currentPeriod} с расширенной версией.`;
      } else {
        errorMessage = `❌ <b>Сначала оплати обычный сундук</b>\n\nОбновление доступно только тем, кто уже оплатил обычную версию за ${currentPeriod}.`;
      }
      
      await ctx.editMessageText(errorMessage, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'refreshUserStatus')]])
      });
      return;
    }

    // Create invoice for plus subscription upgrade
    const invoiceResult = await createUpgradeInvoice(ctx, 'plus', userData.id);
    
    if (!invoiceResult.success) {
      await ctx.editMessageText('❌ <b>Не удалось создать счёт</b>\n\nПопробуй ещё раз позже.', {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'upgradeToPlus')]])
      });
      return;
    }

    // Show confirmation message
    const successMessage = `✅ <b>Счёт на обновление создан</b>\n\nПроверь окно сверху для оплаты доплаты за расширенную версию.`;

    await ctx.editMessageText(successMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'upgradeToPlus')]
      ])
    });
    
  } catch (error) {
    console.error('Error in payPlusUpgrade:', error);
    await ctx.editMessageText('❌ <b>Произошла ошибка</b>\n\nПопробуй ещё раз позже.', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'upgradeToPlus')]])
    });
  }
});
