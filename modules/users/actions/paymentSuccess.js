const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { processSubscriptionPayment } = require('../../payments/subscriptionPaymentService');
const { processKickstarterPayment } = require('../../payments/kickstarterPaymentService');
const { getUserMenu } = require('../menuSystem');
const { t } = require('../../../modules/i18n');

module.exports = Composer.on('successful_payment', async (ctx) => {
  try {
    console.log('💰 Payment received:', ctx.message.successful_payment);
    
    const paymentData = ctx.message.successful_payment;
    const payload = JSON.parse(paymentData.invoice_payload);
    
    // Route payment based on type
    // Check payload.t first (for 'sub' and 'ks'), then fall back to payload.type for backward compatibility
    const paymentType = payload.t || payload.type;
    
    if (paymentType === 'ks') {
      // Process kickstarter payment
      const result = await processKickstarterPayment(ctx, paymentData);
      
      if (!result.success) {
        console.error('❌ Kickstarter payment processing failed:', result.error);
        await ctx.reply('❌ <b>Ошибка обработки платежа</b>\n\nПлатеж получен, но произошла ошибка при активации доступа.\nОбратись к администрации для решения проблемы.', { parse_mode: 'HTML' });
        return;
      }
      // Kickstarter payment success is handled by processKickstarterPayment (sends confirmation message)
      return;
    }
    
    if (paymentType === 'sub' || paymentType === 'subscription') {
      // Process subscription payment
      const result = await processSubscriptionPayment(ctx, paymentData);
      
      if (!result.success) {
        console.error('❌ Payment processing failed:', result.error);
        await ctx.reply(t('messages.try_again_later'), { parse_mode: 'HTML' });
        return;
      }

      // Get updated user data
      const userData = await getUser(ctx.from.id);
      if (!userData) {
        await ctx.reply(t('messages.user_not_found'), { parse_mode: 'HTML' });
        return;
      }

      // Show success message
      const typeText = result.subscriptionType === 'plus' ? t('payments.subscription.plusLabel') : t('payments.subscription.regularLabel');
      const successMessage = t('payments.subscription.received') + `\n\n` +
        `${t('payments.subscription.inviteLink', { link: '' })}`;

      // Get updated menu
      const menu = await getUserMenu(ctx, userData);
      
      await ctx.reply(successMessage, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(menu.keyboard)
      });
      return;
    }
    
    // Unknown payment type
    console.error('❌ Unknown payment type:', paymentType);
    await ctx.reply(
      '❌ <b>Неизвестный тип платежа</b>\n\n' +
      'Платеж получен, но тип платежа не распознан.\n' +
      'Обратись к администрации.',
      { parse_mode: 'HTML' }
    );
    
  } catch (error) {
    console.error('❌ Error processing payment success:', error);
    await ctx.reply(
      '❌ <b>Произошла ошибка</b>\n\n' +
      'Платеж получен, но произошла ошибка при обработке.\n' +
      'Обратись к администрации.',
      { parse_mode: 'HTML' }
    );
  }
});
