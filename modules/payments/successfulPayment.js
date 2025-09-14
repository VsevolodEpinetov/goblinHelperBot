const { processSubscriptionPayment } = require('./subscriptionPaymentService');
const { processOldMonthPayment } = require('./oldMonthPaymentService');
const { getUser } = require('../db/helpers');
const { getUserMenu } = require('../users/menuSystem');
const { Markup } = require('telegraf');

/**
 * Successful payment handler for Telegram Stars payments
 * Processes completed payments and activates subscriptions or grants access
 */
const handleSuccessfulPayment = async (ctx) => {
  try {
    console.log('💰 Payment received:', ctx.message.successful_payment);
    
    const paymentData = ctx.message.successful_payment;
    const payload = JSON.parse(paymentData.invoice_payload);
    console.log('💰 Payment payload type:', payload.type);
    
    if (payload.type === 'subscription') {
      const result = await processSubscriptionPayment(ctx, paymentData);
      if (!result.success) {
        console.error('❌ Payment processing failed:', result.error);
        await ctx.reply('❌ <b>Ошибка обработки платежа</b>\n\nПлатеж получен, но произошла ошибка при активации подписки.\nОбратись к администрации для решения проблемы.', { parse_mode: 'HTML' });
        return;
      }
      const userData = await getUser(ctx.from.id);
      if (!userData) {
        await ctx.reply('❌ <b>Ошибка обновления данных</b>\n\nПлатеж обработан, но не удалось обновить твой профиль.\nПопробуй обновить меню.', { parse_mode: 'HTML' });
        return;
      }
      const subscriptionType = result.subscriptionType === 'plus' ? '➕ Расширенная' : 'Обычная';
      const isTestMode = process.env.PAYMENT_TEST_MODE === 'true';
      const testModeText = isTestMode ? '\n\n🧪 <b>ТЕСТОВЫЙ РЕЖИМ</b> - Платеж был симулирован\n💡 <b>В тестовом режиме</b> - реальные деньги не списываются' : '';
      const successMessage = `🎉 <b>ПЛАТЕЖ УСПЕШНО ОБРАБОТАН!</b>\n\n✅ <b>Подписка активирована</b>\n🔹 <b>Тип:</b> ${subscriptionType}\n📅 <b>Период:</b> ${result.period}\n💰 <b>Сумма:</b> ${paymentData.total_amount} звёзд${testModeText}`;
      const menu = await getUserMenu(ctx, userData);
      await ctx.reply(successMessage, { parse_mode: 'HTML', ...Markup.inlineKeyboard(menu.keyboard) });
      return;
    }
    if (payload.type === 'old_month') {
      const result = await processOldMonthPayment(ctx, paymentData);
      if (!result.success) {
        console.error('❌ Old month payment failed:', result.error);
        await ctx.reply('❌ Ошибка обработки покупки старого месяца');
      } else {
        await ctx.reply(`✅ Доступ к месяцу ${result.period} выдан`);
      }
      return;
    }
    
    
  } catch (error) {
    console.error('❌ Error processing payment success:', error);
    await ctx.reply(
      '❌ <b>Произошла ошибка</b>\n\n' +
      'Платеж получен, но произошла ошибка при обработке.\n' +
      'Обратись к администрации.',
      { parse_mode: 'HTML' }
    );
  }
};

module.exports = { handleSuccessfulPayment };
