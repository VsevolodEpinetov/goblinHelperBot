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

    // Get prices from environment
    const regularPrice = process.env.REGULAR_PRICE || '100';
    const plusPrice = process.env.PLUS_PRICE || '150';
    const isTestMode = process.env.PAYMENT_TEST_MODE === 'true';
    
    // Show payment options with direct payment buttons
    const testModeText = isTestMode ? '\n\n🧪 <b>ТЕСТОВЫЙ РЕЖИМ</b> - Платежи будут симулированы' : '';
    const paymentMessage = t('payments.subscription.choose') + `\n\n` +
      t('payments.subscription.regular') + ` — ${regularPrice}⭐` + `\n` +
      t('payments.subscription.plus') + ` — ${plusPrice}⭐` + `\n\n` +
      t('messages.explain') + testModeText;

    const paymentKeyboard = [
      [
        Markup.button.callback(`${t('payments.subscription.regularLabel')} (${regularPrice}⭐)`, 'payRegularMonth'),
        Markup.button.callback(`${t('payments.subscription.plusLabel')} (${plusPrice}⭐)`, 'payPlusMonth')
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
