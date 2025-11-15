const knex = require('../db/knex');
const { getKickstarter, getUser, hasUserPurchasedKickstarter, addUserKickstarter } = require('../db/helpers');
const { hasYearsOfService, getAchievementMultiplier, YEARS_OF_SERVICE } = require('../loyalty/achievementsService');
const SETTINGS = require('../../settings.json');

/**
 * Create a Telegram invoice for kickstarter payment
 * @param {Object} ctx - Telegraf context
 * @param {number} kickstarterId - Kickstarter ID
 * @param {number} userId - User ID
 * @returns {Object} - { success: boolean, error?: string }
 */
async function createKickstarterInvoice(ctx, kickstarterId, userId) {
  try {
    const kickstarterData = await getKickstarter(kickstarterId);
    if (!kickstarterData) {
      return {
        success: false,
        error: 'Kickstarter not found'
      };
    }

    // Check if user already has this kickstarter
    const alreadyHas = await hasUserPurchasedKickstarter(userId, kickstarterId);
    if (alreadyHas) {
      return {
        success: false,
        error: 'User already has access to this kickstarter'
      };
    }

    // Get user info
    const userInfo = ctx.from;
    const userName = userInfo.username ? `@${userInfo.username}` : 
                    (userInfo.first_name ? `${userInfo.first_name} ${userInfo.last_name || ''}`.trim() : `User ${userInfo.id}`);

    // Apply achievement discounts
    const hasYears = await hasYearsOfService(Number(userId));
    const achievementMultiplier = hasYears ? getAchievementMultiplier(YEARS_OF_SERVICE) : 1.0;
    const basePrice = kickstarterData.cost;
    const discountedPrice = Math.round(basePrice * achievementMultiplier);
    const discountPercent = hasYears ? Math.round((1 - achievementMultiplier) * 100) : 0;

    // Create invoice
    const title = `Ритуал: ${kickstarterData.name}`;
    let description = `${kickstarterData.name}\n\n`;
    description += `Источник: ${kickstarterData.creator}\n`;
    if (kickstarterData.pledgeName) {
      description += `Пледж: ${kickstarterData.pledgeName}\n`;
    }
    description += `\n👤 Пользователь: ${userName} (${userId})\n`;
    
    if (hasYears && discountPercent > 0) {
      description += `💰 Цена: ~~${basePrice}⭐~~ <b>${discountedPrice}⭐</b>\n`;
      description += `🏅 Скидка «За выслугу лет»: −${discountPercent}%`;
    } else {
      description += `💰 Цена: ${discountedPrice}⭐`;
    }

    const payload = JSON.stringify({
      type: 'kickstarter',
      ksId: kickstarterId,
      userId: Number(userId),
      ts: Date.now(),
      basePrice: basePrice,
      discountedPrice: discountedPrice,
      hasDiscount: hasYears
    });

    const provider_token = ''; // Empty for Telegram Stars
    const currency = 'XTR'; // Telegram Stars currency code
    const isTestMode = process.env.PAYMENT_TEST_MODE === 'true';

    const prices = [
      {
        label: 'Кикстартер',
        amount: discountedPrice
      }
    ];

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

    // Send invoice
    try {
      const invoiceParams = {
        title: title,
        description: description,
        payload: payload,
        provider_token: provider_token,
        currency: currency,
        prices: prices
      };

      if (isTestMode) {
        invoiceParams.start_parameter = `test_ks_${kickstarterId}_${Date.now()}`;
        console.log(`🧪 Test Payment: Kickstarter ${kickstarterId} for user ${userId} (${discountedPrice} stars${hasYears ? `, ${discountPercent}% discount` : ''})`);
      } else {
        console.log(`💰 Payment Invoice: Kickstarter ${kickstarterId} (${discountedPrice} stars${hasYears ? `, ${discountPercent}% discount` : ''}) for user ${userId}`);
      }

      await ctx.telegram.sendInvoice(ctx.chat.id, invoiceParams);

      return {
        success: true
      };
    } catch (invoiceError) {
      console.error('❌ Invoice creation failed:', invoiceError);
      throw invoiceError;
    }
  } catch (error) {
    console.error('❌ Error creating kickstarter invoice:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Process successful kickstarter payment
 * @param {Object} ctx - Telegraf context
 * @param {Object} paymentData - Payment data from Telegram
 * @returns {Object} - { success: boolean, error?: string }
 */
async function processKickstarterPayment(ctx, paymentData) {
  try {
    const payload = JSON.parse(paymentData.invoice_payload);
    
    if (payload.type !== 'kickstarter') {
      throw new Error('Invalid payment type');
    }

    const { ksId, userId, basePrice, discountedPrice, hasDiscount } = payload;

    // Verify payment amount
    const kickstarterData = await getKickstarter(ksId);
    if (!kickstarterData) {
      throw new Error('Kickstarter not found');
    }

    // Calculate expected price (use discounted price from payload if available, otherwise recalculate)
    let expectedPrice;
    if (discountedPrice !== undefined) {
      expectedPrice = discountedPrice;
    } else {
      // Fallback: recalculate discount if payload doesn't have it
      const hasYears = await hasYearsOfService(Number(userId));
      const achievementMultiplier = hasYears ? getAchievementMultiplier(YEARS_OF_SERVICE) : 1.0;
      const basePriceToUse = basePrice || kickstarterData.cost;
      expectedPrice = Math.round(basePriceToUse * achievementMultiplier);
    }

    if (paymentData.total_amount < expectedPrice) {
      console.error('Payment amount mismatch:', {
        expected: expectedPrice,
        received: paymentData.total_amount,
        basePrice: basePrice || kickstarterData.cost,
        hasDiscount: hasDiscount || false
      });
      throw new Error('Payment amount mismatch');
    }

    // Check if user already has this kickstarter
    const alreadyHas = await hasUserPurchasedKickstarter(userId, ksId);
    if (alreadyHas) {
      console.log(`User ${userId} already has kickstarter ${ksId}, skipping`);
      return {
        success: true,
        message: 'User already has access'
      };
    }

    // Grant kickstarter access
    await addUserKickstarter(userId, ksId);

    // Send files to user
    if (kickstarterData.files && kickstarterData.files.length > 0) {
      for (const fileId of kickstarterData.files) {
        try {
          await ctx.telegram.sendDocument(userId, fileId);
        } catch (error) {
          console.error(`Error sending file ${fileId} to user ${userId}:`, error);
        }
      }
    }

    // Send confirmation message
    let message = `✅ <b>Покупка успешна!</b>\n\n`;
    message += `Ты получил доступ к кикстартеру:\n`;
    message += `<b>${kickstarterData.name}</b>\n`;
    message += `Автор: <b>${kickstarterData.creator}</b>\n\n`;
    
    if (kickstarterData.files && kickstarterData.files.length > 0) {
      message += `📁 Файлы отправлены выше`;
    } else {
      message += `📁 Файлы отсутствуют`;
    }

    await ctx.telegram.sendMessage(userId, message, {
      parse_mode: 'HTML'
    });

    // Log to admin
    await ctx.telegram.sendMessage(
      SETTINGS.CHATS.LOGS,
      `💰 Пользователь ${userId} купил кикстартер ${ksId} (${kickstarterData.name}) за ${paymentData.total_amount}⭐`
    );

    return {
      success: true
    };
  } catch (error) {
    console.error('❌ Error processing kickstarter payment:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  createKickstarterInvoice,
  processKickstarterPayment
};
