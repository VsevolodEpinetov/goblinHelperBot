const knex = require('../db/knex');
const { t } = require('../i18n');
const { getSubscriptionBaseUnits, applyXpGain } = require('../loyalty/xpService');
const { hasYearsOfService, getAchievementMultiplier, YEARS_OF_SERVICE } = require('../loyalty/achievementsService');
const rpgConfig = require('../../configs/rpg');
const { getCurrentMonthPeriod } = require('../users/subscriptionHelpers');

/**
 * Create a Telegram invoice for subscription payment
 * @param {Object} ctx - Telegraf context
 * @param {string} subscriptionType - 'regular' or 'plus'
 * @param {number} userId - User ID
 * @returns {Object} - { success: boolean, invoiceLink?: string, error?: string }
 */
async function createSubscriptionInvoice(ctx, subscriptionType, userId) {
  try {
    console.log('🚀 createSubscriptionInvoice called with:', { subscriptionType, userId, chatId: ctx.chat?.id });
    
    const currentPeriod = getCurrentMonthPeriod();
    const price = subscriptionType === 'plus' ? (rpgConfig.prices.plusStars || process.env.PLUS_PRICE) : (rpgConfig.prices.regularStars || process.env.REGULAR_PRICE);
    const priceInStars = parseInt(price);
    
    console.log('🔍 Environment check:', { 
      currentPeriod, 
      price, 
      priceInStars, 
      REGULAR_PRICE: process.env.REGULAR_PRICE, 
      PLUS_PRICE: process.env.PLUS_PRICE,
      PAYMENT_TEST_MODE: process.env.PAYMENT_TEST_MODE
    });
    
    if (!priceInStars || priceInStars <= 0) {
      throw new Error(`Invalid price configuration: ${price}`);
    }

    // Get user info for description
    const userInfo = ctx.from;
    const userName = userInfo.username ? `@${userInfo.username}` : 
                    (userInfo.first_name ? `${userInfo.first_name} ${userInfo.last_name || ''}`.trim() : `User ${userInfo.id}`);
    
    // Create invoice payload
    const labelShort = subscriptionType === 'plus' ? t('payments.subscription.plusLabel') : t('payments.subscription.regularLabel');
    const subscriptionLabel = subscriptionType === 'plus' ? '➕ Расширенная версия' : 'Обычная версия';
    const title = t('payments.invoices.subscription.title', { label: labelShort, period: currentPeriod });
    const description = t('payments.invoices.subscription.description', { period: currentPeriod, userName, userId: userInfo.id, subscriptionLabel, price: priceInStars });
    const payload = JSON.stringify({
      type: 'subscription',
      subscriptionType,
      userId: Number(userId),
      period: currentPeriod,
      timestamp: Date.now()
    });
    const provider_token = ''; // Empty for Telegram Stars
    const currency = 'XTR'; // Telegram Stars currency code
    const isTestMode = process.env.PAYMENT_TEST_MODE === 'true';
    // Apply achievements and level discounts later at payment processing time; invoice shows base price
    const prices = [
      {
        label: t('payments.invoices.subscription.label', { labelShort }),
        amount: priceInStars
      }
    ];

    console.log('🔍 Invoice parameters:', {
      chatId: ctx.chat.id,
      userId: userInfo.id,
      userName: userName,
      title: `"${title}"`,
      titleLength: title ? title.length : 'undefined',
      description: `"${description}"`,
      payload: `"${payload}"`,
      provider_token: `"${provider_token}"`,
      currency: `"${currency}"`,
      prices: prices
    });
    
    // Validate required parameters
    if (!title || title.trim() === '') {
      throw new Error('Title is required and cannot be empty');
    }
    if (!description || description.trim() === '') {
      throw new Error('Description is required and cannot be empty');
    }
    if (!payload || payload.trim() === '') {
      throw new Error('Payload is required and cannot be empty');
    }
    if (!currency || currency.trim() === '') {
      throw new Error('Currency is required and cannot be empty');
    }
    if (!prices || !Array.isArray(prices) || prices.length === 0) {
      throw new Error('Prices array is required and cannot be empty');
    }

    // Send invoice using correct Telegraf method
    let invoiceMessage;
    try {
      // Prepare invoice parameters
      const invoiceParams = {
        title: title,
        description: description,
        payload: payload,
        provider_token: provider_token,
        currency: currency,
        prices: prices
      };
      
      // Add test mode parameters if enabled
      if (isTestMode) {
        invoiceParams.start_parameter = `test_${subscriptionType}_${currentPeriod}`;
        console.log('🧪 Test mode enabled for payment');
        console.log('🧪 Test mode parameters:', {
          userId: userInfo.id,
          userName: userName,
          start_parameter: invoiceParams.start_parameter,
          isTestMode: isTestMode,
          PAYMENT_TEST_MODE: process.env.PAYMENT_TEST_MODE
        });
      } else {
        console.log('💰 Production mode - real payment will be processed');
        console.log('💰 Payment for user:', { userId: userInfo.id, userName: userName });
      }
      
      // Use the correct Telegraf v4 method with object parameters
      invoiceMessage = await ctx.telegram.sendInvoice(ctx.chat.id, invoiceParams);
      
      console.log('✅ Invoice sent successfully:', invoiceMessage.message_id);
      if (isTestMode) {
        console.log('🧪 Test invoice created - payment will be simulated');
      }
    } catch (invoiceError) {
      console.error('❌ Invoice creation failed:', invoiceError);
      console.error('❌ Invoice error details:', {
        message: invoiceError.message,
        response: invoiceError.response,
        parameters: {
          chatId: ctx.chat.id,
          title,
          description,
          payload,
          provider_token,
          currency,
          prices,
          isTestMode
        }
      });
      throw invoiceError;
    }

    // Store payment record for tracking
    await knex('paymentTracking').insert({
      userId: Number(userId),
      type: 'subscription',
      subscriptionType,
      period: currentPeriod,
      amount: priceInStars,
      currency: 'XTR',
      status: 'pending',
      invoiceMessageId: invoiceMessage.message_id,
      createdAt: new Date()
    });

    return {
      success: true,
      invoiceMessageId: invoiceMessage.message_id,
      price: priceInStars
    };

  } catch (error) {
    console.error('Error creating subscription invoice:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Process successful subscription payment
 * @param {Object} ctx - Telegraf context
 * @param {Object} paymentData - Payment data from Telegram
 * @returns {Object} - { success: boolean, error?: string }
 */
async function processSubscriptionPayment(ctx, paymentData) {
  try {
    const payload = JSON.parse(paymentData.invoice_payload);
    
    if (payload.type !== 'subscription') {
      throw new Error('Invalid payment type');
    }

    const { subscriptionType, userId, period } = payload;

    // Verify payment amount
    const expectedPrice = subscriptionType === 'plus' ? 
      parseInt(rpgConfig.prices.plusStars || process.env.PLUS_PRICE) : parseInt(rpgConfig.prices.regularStars || process.env.REGULAR_PRICE);
    
    // For Telegram Stars (XTR), amount is already in stars, not smallest currency unit
    if (paymentData.total_amount < expectedPrice) {
      console.error('Payment amount too low:', {
        expected: expectedPrice,
        received: paymentData.total_amount,
        subscriptionType,
        currency: paymentData.currency
      });
      throw new Error('Payment amount too low');
    }

    // Add user to the subscription group
    await knex('userGroups').insert({
      userId: Number(userId),
      period: period,
      type: subscriptionType
    }).onConflict(['userId', 'period', 'type']).ignore();

    // Update payment record
    await knex('paymentTracking')
      .where('userId', Number(userId))
      .where('type', 'subscription')
      .where('subscriptionType', subscriptionType)
      .where('period', period)
      .where('status', 'pending')
      .update({
        status: 'completed',
        completedAt: new Date(),
        telegramPaymentChargeId: paymentData.telegram_payment_charge_id
      });
    
    console.log('💳 Payment charge ID stored in database:', paymentData.telegram_payment_charge_id);

    // Update month counter
    await knex('months')
      .where('period', period)
      .where('type', subscriptionType)
      .increment('counterPaid', 1);

    // Loyalty: compute ΔS units with achievement discount applied first, then level discount placeholder (future)
    try {
      const baseUnits = getSubscriptionBaseUnits(subscriptionType);
      const hasY = await hasYearsOfService(Number(userId));
      const mult = hasY ? getAchievementMultiplier(YEARS_OF_SERVICE) : 1.0; // 0.5 means 50% of price
      const discountedUnits = baseUnits * mult;
      // Level-based discounts could be applied here after fetching current level; omitted for now
      const deltaUnits = discountedUnits;
      await applyXpGain(Number(userId), deltaUnits, 'spending_payment', { subscriptionType, period, description: 'Subscription payment' });
    } catch (xpErr) {
      console.error('⚠️ Loyalty XP apply error (non-fatal):', xpErr);
    }

    return {
      success: true,
      subscriptionType,
      period,
      userId: Number(userId)
    };

  } catch (error) {
    console.error('Error processing subscription payment:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get user's payment history
 * @param {number} userId - User ID
 * @returns {Array} - Array of payment records
 */
async function getUserPaymentHistory(userId) {
  try {
    const payments = await knex('paymentTracking')
      .where('userId', Number(userId))
      .where('type', 'subscription')
      .orderBy('createdAt', 'desc')
      .select('*');

    return payments;
  } catch (error) {
    console.error('Error getting user payment history:', error);
    return [];
  }
}

module.exports = {
  createSubscriptionInvoice,
  processSubscriptionPayment,
  getUserPaymentHistory
};
