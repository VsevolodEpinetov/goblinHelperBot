const knex = require('../db/knex');
const rpgConfig = require('../../configs/rpg');
const SETTINGS = require('../../settings.json');
const { t } = require('../i18n');

async function createOldMonthInvoice(ctx, period, userId, monthType = 'regular') {
  try {
    const priceBase = monthType === 'plus' ? (rpgConfig.prices.plusStars || process.env.PLUS_PRICE) : (rpgConfig.prices.regularStars || process.env.REGULAR_PRICE);
    const price = Number(priceBase) * 3;
    const priceInStars = parseInt(price);
    if (!priceInStars || priceInStars <= 0) throw new Error(`Invalid old month price: ${price}`);

    const userInfo = ctx.from;
    const userName = userInfo.username ? `@${userInfo.username}` : (userInfo.first_name ? `${userInfo.first_name} ${userInfo.last_name || ''}`.trim() : `User ${userInfo.id}`);
    const title = t('payments.invoices.oldMonth.title', { period, type: monthType });
    const description = t('payments.invoices.oldMonth.description', { period, type: monthType, userName, userId: userInfo.id, price: priceInStars });
    const payload = JSON.stringify({ type: 'old_month', period, monthType, userId: Number(userId), timestamp: Date.now() });
    const provider_token = '';
    const currency = 'XTR';
    const prices = [{ label: t('payments.invoices.oldMonth.label', { period }), amount: priceInStars }];

    const invoiceParams = { title, description, payload, provider_token, currency, prices };
    const chatId = ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id || ctx.from.id;
    console.log('🧾 Creating old month invoice', { chatId, period, priceInStars });
    let invoiceMessage;
    try {
      invoiceMessage = await ctx.telegram.sendInvoice(chatId, invoiceParams);
    } catch (e) {
      console.error('❌ sendInvoice failed', e);
      throw e;
    }

    await knex('paymentTracking').insert({
      userId: Number(userId),
      type: 'old_month',
      period,
      subscriptionType: monthType,
      amount: priceInStars,
      currency: 'XTR',
      status: 'pending',
      invoiceMessageId: invoiceMessage.message_id,
      createdAt: new Date()
    });

    return { success: true, invoiceMessageId: invoiceMessage.message_id, price: priceInStars };
  } catch (error) {
    console.error('Error creating old month invoice:', error);
    return { success: false, error: error.message };
  }
}

async function processOldMonthPayment(ctx, paymentData) {
  try {
    const payload = JSON.parse(paymentData.invoice_payload);
    if (payload.type !== 'old_month') throw new Error('Invalid payment type');

    const { period, monthType = 'regular', userId } = payload;
    console.log('🧾 processOldMonthPayment start', { userId, period, monthType, paid: paymentData.total_amount });
    const priceBase = monthType === 'plus' ? (rpgConfig.prices.plusStars || process.env.PLUS_PRICE) : (rpgConfig.prices.regularStars || process.env.REGULAR_PRICE);
    const expectedPrice = parseInt(priceBase) * 3;
    if (paymentData.total_amount < expectedPrice) throw new Error('Payment amount too low');

    // Grant access according to monthType
    await knex('userGroups')
      .insert({ userId: Number(userId), period, type: monthType })
      .onConflict(['userId','period','type']).ignore();
    const check = await knex('userGroups').where({ userId: Number(userId), period, type: monthType }).first();
    console.log('🧾 userGroups insert check:', !!check);

    // Update payment record
    await knex('paymentTracking')
      .where('userId', Number(userId))
      .where('type', 'old_month')
      .where('period', period)
      .where('status', 'pending')
      .update({ status: 'completed', completedAt: new Date(), telegramPaymentChargeId: paymentData.telegram_payment_charge_id });
    console.log('🧾 paymentTracking updated for old_month');

    // Increment month paid counter
    await knex('months').where('period', period).where('type', monthType).increment('counterPaid', 1);

    // Apply XP from spending 
    try {
      const { applyXpGain, getSubscriptionBaseUnits } = require('../loyalty/xpService');
      const baseUnits = getSubscriptionBaseUnits(monthType === 'plus' ? 'plus' : 'regular');
      const deltaUnits = baseUnits * 3;
      await applyXpGain(Number(userId), deltaUnits, 'spending_payment', { period, old_month: true, description: 'Old month purchase' });
    } catch (e) {
      console.error('⚠️ Loyalty XP apply error for old month:', e);
    }

    // Send join link using the same flow as regular subscription: reuse or create a group link
    try {
      const { getOrCreateGroupInvitationLink } = require('../archive/archiveService');
      const linkResult = await getOrCreateGroupInvitationLink(period, monthType);
      if (linkResult?.success && linkResult.link) {
        await ctx.replyWithHTML(t('payments.invoices.oldMonth.granted', { period, type: monthType, link: linkResult.link }));
      } else {
        console.error('⚠️ No group link available:', linkResult?.error);
      }
    } catch (linkErr) {
      console.error('⚠️ Failed to get group link for old month:', linkErr);
      // Inform the user and notify admin as requested
      try {
        const { requestLinkNotification } = require('../archive/archiveService');
        await requestLinkNotification(Number(userId), period, monthType);
      } catch {}
      try {
        await ctx.replyWithHTML(t('payments.invoices.oldMonth.noLinkUser', { period, type: monthType }));
      } catch {}
      try {
        await ctx.telegram.sendMessage(
          SETTINGS.CHATS.EPINETOV,
          t('payments.invoices.oldMonth.noLinkAdmin', { period, type: monthType, userId: ctx.from.id })
        );
      } catch {}
    }

    return { success: true, period, userId: Number(userId) };
  } catch (error) {
    console.error('Error processing old month payment:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { createOldMonthInvoice, processOldMonthPayment };


