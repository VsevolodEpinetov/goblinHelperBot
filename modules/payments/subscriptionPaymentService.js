const knex = require('../db/knex');
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
    const currentPeriod = getCurrentMonthPeriod();
    const basePrice = subscriptionType === 'plus' ? (rpgConfig.prices.plusStars || process.env.PLUS_PRICE) : (rpgConfig.prices.regularStars || process.env.REGULAR_PRICE);
    const basePriceInStars = parseInt(basePrice);
    
    // Apply achievement discounts to the invoice price (not just XP calculation)
    const hasYears = await hasYearsOfService(Number(userId));
    const achievementMultiplier = hasYears ? getAchievementMultiplier(YEARS_OF_SERVICE) : 1.0;
    const discountedPrice = Math.round(basePriceInStars * achievementMultiplier);
    const discountPercent = hasYears ? Math.round((1 - achievementMultiplier) * 100) : 0;
    
    const priceInStars = discountedPrice;
    
    if (!priceInStars || priceInStars <= 0) {
      throw new Error(`Invalid price configuration: base ${basePrice}, discounted ${priceInStars}`);
    }

    // Get user info for description
    const userInfo = ctx.from;
    const userName = userInfo.username ? `@${userInfo.username}` : 
                    (userInfo.first_name ? `${userInfo.first_name} ${userInfo.last_name || ''}`.trim() : `User ${userInfo.id}`);
    
    // Create invoice payload
    const labelShort = subscriptionType === 'plus' ? 'Плюс' : 'Обычная';
    const subscriptionLabel = subscriptionType === 'plus' ? '➕ Расширенная версия' : 'Обычная версия';
    const title = `Сундук ${labelShort} ${currentPeriod}`;
    
    // Create description with discount information
    let description = `${subscriptionLabel} за ${currentPeriod}\n\n`;
    description += `👤 Пользователь: ${userName} (${userInfo.id})\n`;
    
    if (hasYears && discountPercent > 0) {
      description += `💰 Цена: ${basePriceInStars}⭐ → ${priceInStars}⭐\n`;
      description += `🏆 Скидка "За выслугу лет": ${discountPercent}%`;
    } else {
      description += `💰 Цена: ${priceInStars}⭐`;
    }
    const payload = JSON.stringify({
      t: 'sub',
      st: subscriptionType,
      u: Number(userId),
      p: currentPeriod,
      ts: Date.now()
    });
    const provider_token = ''; // Empty for Telegram Stars
    const currency = 'XTR'; // Telegram Stars currency code
    const isTestMode = process.env.PAYMENT_TEST_MODE === 'true';
    
    // Create price label with discount info
    const priceLabel = hasYears && discountPercent > 0 ? 
      `${labelShort} (${discountPercent}% скидка)` : 
      labelShort;
    
    const prices = [
      {
        label: priceLabel,
        amount: priceInStars
      }
    ];
    
    // Log the discount application
    if (hasYears && discountPercent > 0) {
      console.log(`💰 Discount Applied: User ${userId} - ${subscriptionType} ${basePriceInStars}⭐ → ${priceInStars}⭐ (${discountPercent}% off)`);
    } else {
      console.log(`💰 Full Price: User ${userId} - ${subscriptionType} ${priceInStars}⭐ (no discounts)`);
    }

    
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
        console.log(`🧪 Test Payment: ${subscriptionType} subscription for user ${userInfo.id} (@${userInfo.username})`);
      } else {
        console.log(`💰 Payment Invoice: ${subscriptionType} subscription (${priceInStars} stars) for user ${userInfo.id} (@${userInfo.username})`);
      }
      
      // Use the correct Telegraf v4 method with object parameters
      invoiceMessage = await ctx.telegram.sendInvoice(ctx.chat.id, invoiceParams);
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
    
    if (payload.t !== 'sub') {
      throw new Error('Invalid payment type');
    }

    const { st: subscriptionType, u: userId, p: period, iu: isUpgrade } = payload;

    // Calculate expected price based on whether this is an upgrade or full payment
    const hasYears = await hasYearsOfService(Number(userId));
    const achievementMultiplier = hasYears ? getAchievementMultiplier(YEARS_OF_SERVICE) : 1.0;
    
    let expectedPrice;
    if (isUpgrade) {
      // For upgrades, calculate the difference between plus and regular
      const regularBasePrice = parseInt(rpgConfig.prices.regularStars || process.env.REGULAR_PRICE);
      const plusBasePrice = parseInt(rpgConfig.prices.plusStars || process.env.PLUS_PRICE);
      const regularPrice = Math.round(regularBasePrice * achievementMultiplier);
      const plusPrice = Math.round(plusBasePrice * achievementMultiplier);
      expectedPrice = plusPrice - regularPrice;
    } else {
      // For full payments, use the full subscription price
      const basePrice = subscriptionType === 'plus' ? 
        parseInt(rpgConfig.prices.plusStars || process.env.PLUS_PRICE) : parseInt(rpgConfig.prices.regularStars || process.env.REGULAR_PRICE);
      expectedPrice = Math.round(basePrice * achievementMultiplier);
    }
    
    // For Telegram Stars (XTR), amount is already in stars, not smallest currency unit
    if (paymentData.total_amount < expectedPrice) {
      console.error('Payment amount mismatch:', {
        expected: expectedPrice,
        received: paymentData.total_amount,
        subscriptionType,
        isUpgrade,
        currency: paymentData.currency
      });
      throw new Error('Payment amount mismatch');
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

    // Apply loyalty XP gain based on subscription type (discounts only affect price, not XP)
    try {
      let deltaUnits;
      let description;
      
      if (isUpgrade) {
        // For upgrades, calculate XP based on the upgrade amount only (actual stars difference)
        const regularBasePrice = parseInt(rpgConfig.prices.regularStars || process.env.REGULAR_PRICE);
        const plusBasePrice = parseInt(rpgConfig.prices.plusStars || process.env.PLUS_PRICE);
        const upgradeBasePrice = plusBasePrice - regularBasePrice;
        // XP is calculated from base stars, not discounted price (1.3 XP per star)
        deltaUnits = upgradeBasePrice;
        description = 'Subscription upgrade payment';
      } else {
        // For full payments, use the actual base stars price (not discounted)
        // XP is calculated as baseStars * 1.3
        const regularBasePrice = parseInt(rpgConfig.prices.regularStars || process.env.REGULAR_PRICE);
        const plusBasePrice = parseInt(rpgConfig.prices.plusStars || process.env.PLUS_PRICE);
        deltaUnits = subscriptionType === 'plus' ? plusBasePrice : regularBasePrice;
        description = 'Subscription payment';
      }
      
      await applyXpGain(Number(userId), deltaUnits, 'spending_payment', { 
        subscriptionType, 
        period, 
        description,
        actualPaid: paymentData.total_amount,
        isUpgrade,
        discountApplied: hasYears
      });
      
      // Log meaningful payment completion
      const discount = hasYears ? ((1 - (hasYears ? getAchievementMultiplier(YEARS_OF_SERVICE) : 1.0)) * 100) : 0;
      // Payment completed successfully
      
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

/**
 * Create a Telegram invoice for subscription upgrade payment
 * @param {Object} ctx - Telegraf context
 * @param {string} subscriptionType - 'plus' (for upgrade)
 * @param {number} userId - User ID
 * @returns {Object} - { success: boolean, invoiceLink?: string, error?: string }
 */
async function createUpgradeInvoice(ctx, subscriptionType, userId) {
  try {
    const currentPeriod = getCurrentMonthPeriod();
    const regularBasePrice = parseInt(rpgConfig.prices.regularStars || process.env.REGULAR_PRICE);
    const plusBasePrice = parseInt(rpgConfig.prices.plusStars || process.env.PLUS_PRICE);
    
    // Apply achievement discounts
    const hasYears = await hasYearsOfService(Number(userId));
    const achievementMultiplier = hasYears ? getAchievementMultiplier(YEARS_OF_SERVICE) : 1.0;
    const discountPercent = hasYears ? Math.round((1 - achievementMultiplier) * 100) : 0;
    
    const regularPrice = Math.round(regularBasePrice * achievementMultiplier);
    const plusPrice = Math.round(plusBasePrice * achievementMultiplier);
    
    // Calculate upgrade price (difference between plus and regular)
    const upgradePrice = plusPrice - regularPrice;
    
    if (!upgradePrice || upgradePrice <= 0) {
      throw new Error(`Invalid upgrade price: regular ${regularPrice}, plus ${plusPrice}, upgrade ${upgradePrice}`);
    }

    // Get user info for description
    const userInfo = ctx.from;
    const userName = userInfo.username ? `@${userInfo.username}` : 
                    (userInfo.first_name ? `${userInfo.first_name} ${userInfo.last_name || ''}`.trim() : `User ${userInfo.id}`);
    
    // Create invoice payload
    const title = `Обновление до Плюс ${currentPeriod}`;
    
    // Create description with upgrade information
    let description = `⬆️ Обновление до расширенной версии за ${currentPeriod}\n\n`;
    description += `👤 Пользователь: ${userName} (${userInfo.id})\n`;
    description += `💰 Обычная: ${regularPrice}⭐ (уже оплачено)\n`;
    description += `💰 Плюс: ${plusPrice}⭐\n`;
    description += `💎 Доплата: ${upgradePrice}⭐`;
    
    if (hasYears && discountPercent > 0) {
      description += `\n🏆 Скидка "За выслугу лет": ${discountPercent}%`;
    }
    
    const payload = JSON.stringify({
      t: 'sub',
      st: subscriptionType,
      u: Number(userId),
      p: currentPeriod,
      iu: true,
      ts: Date.now()
    });
    const provider_token = ''; // Empty for Telegram Stars
    const currency = 'XTR'; // Telegram Stars currency code
    const isTestMode = process.env.PAYMENT_TEST_MODE === 'true';
    
    // Create price label with upgrade info
    const priceLabel = hasYears && discountPercent > 0 ? 
      `Обновление (${discountPercent}% скидка)` : 
      'Обновление';
    
    const prices = [
      {
        label: priceLabel,
        amount: upgradePrice
      }
    ];
    
    // Log the upgrade invoice creation
    if (hasYears && discountPercent > 0) {
      console.log(`💰 Upgrade Invoice: User ${userId} - ${subscriptionType} upgrade ${upgradePrice} stars (${discountPercent}% off)`);
    } else {
      console.log(`💰 Upgrade Invoice: User ${userId} - ${subscriptionType} upgrade ${upgradePrice} stars (no discounts)`);
    }

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
        invoiceParams.start_parameter = `test_upgrade_${subscriptionType}_${currentPeriod}`;
        console.log(`🧪 Test Upgrade Payment: ${subscriptionType} upgrade for user ${userInfo.id} (@${userInfo.username})`);
      } else {
        console.log(`💰 Upgrade Payment Invoice: ${subscriptionType} upgrade (${upgradePrice} stars) for user ${userInfo.id} (@${userInfo.username})`);
      }
      
      // Use the correct Telegraf v4 method with object parameters
      invoiceMessage = await ctx.telegram.sendInvoice(ctx.chat.id, invoiceParams);
    } catch (invoiceError) {
      console.error('❌ Upgrade invoice creation failed:', invoiceError);
      console.error('❌ Upgrade invoice error details:', {
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
      amount: upgradePrice,
      currency: 'XTR',
      status: 'pending',
      invoiceMessageId: invoiceMessage.message_id,
      isUpgrade: true,
      createdAt: new Date()
    });

    return {
      success: true,
      invoiceMessageId: invoiceMessage.message_id,
      price: upgradePrice
    };

  } catch (error) {
    console.error('Error creating upgrade invoice:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  createSubscriptionInvoice,
  createUpgradeInvoice,
  processSubscriptionPayment,
  getUserPaymentHistory
};
