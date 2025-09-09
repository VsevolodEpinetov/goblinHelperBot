const { Composer, Markup } = require('telegraf');
const knex = require('../db/knex');
const SETTINGS = require('../../settings.json');
const { getUser, updateUser, addUserToGroup, getMonthChatId, hasUserPurchasedMonth } = require('../db/helpers');

const composer = new Composer();

function getCurrentPeriod () {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}_${m}`;
}

composer.command('buy', async (ctx) => {
  if (ctx.message.chat.id < 0) return;
  
  // Get user data to check for discounts
  const { getUser } = require('../db/helpers');
  const { hasYearsOfService, getAchievementMultiplier, YEARS_OF_SERVICE } = require('../loyalty/achievementsService');
  
  const userData = await getUser(ctx.from.id);
  if (!userData) {
    await ctx.reply('❌ Пользователь не найден. Используйте /start');
    return;
  }
  
  // Get base prices
  const regularBasePrice = parseInt(process.env.REGULAR_PRICE || '350');
  const plusBasePrice = parseInt(process.env.PLUS_PRICE || '1000');
  
  // Apply achievement discounts
  const hasYears = await hasYearsOfService(Number(ctx.from.id));
  const achievementMultiplier = hasYears ? getAchievementMultiplier(YEARS_OF_SERVICE) : 1.0;
  const discountPercent = hasYears ? Math.round((1 - achievementMultiplier) * 100) : 0;
  
  const regularPrice = Math.round(regularBasePrice * achievementMultiplier);
  const plusPrice = Math.round(plusBasePrice * achievementMultiplier);
  
  // Create buttons with discounted prices
  const regularLabel = hasYears ? `Обычная — ~~${regularBasePrice}⭐~~ ${regularPrice}⭐` : `Обычная — ${regularPrice}⭐`;
  const plusLabel = hasYears ? `Плюс — ~~${plusBasePrice}⭐~~ ${plusPrice}⭐` : `Плюс — ${plusPrice}⭐`;
  
  const discountText = hasYears ? `\n\n🏆 Применена скидка "За выслугу лет": ${discountPercent}%` : '';
  
  await ctx.replyWithHTML(`Выбери подписку на месяц:${discountText}`, {
    ...Markup.inlineKeyboard([
      [Markup.button.callback(regularLabel, 'stars_buy_regular')],
      [Markup.button.callback(plusLabel, 'stars_buy_plus')]
    ])
  })
});

composer.action('stars_buy_regular', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  // Use the new subscription payment service with discounts
  const { createSubscriptionInvoice } = require('./subscriptionPaymentService');
  const invoiceResult = await createSubscriptionInvoice(ctx, 'regular', ctx.from.id);
  
  if (!invoiceResult.success) {
    await ctx.reply('❌ Ошибка создания счета. Попробуйте позже.');
    console.error('Invoice creation failed for regular subscription:', invoiceResult.error);
  }
});

composer.action('stars_buy_plus', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  // Use the new subscription payment service with discounts
  const { createSubscriptionInvoice } = require('./subscriptionPaymentService');
  const invoiceResult = await createSubscriptionInvoice(ctx, 'plus', ctx.from.id);
  
  if (!invoiceResult.success) {
    await ctx.reply('❌ Ошибка создания счета. Попробуйте позже.');
    console.error('Invoice creation failed for plus subscription:', invoiceResult.error);
  }
});

composer.on('pre_checkout_query', async (ctx) => {
  await ctx.answerPreCheckoutQuery(true);
});

composer.on('message', async (ctx, next) => {
  const m = ctx.message;
  if (!m || !m.successful_payment) return next();
  const sp = m.successful_payment;
  const payload = sp.invoice_payload || '';
  const userId = ctx.from && ctx.from.id;
  if (!userId) return;

  // NEW: Route JSON payloads (new payment flows) to dedicated processors
  try {
    if (payload && typeof payload === 'string' && payload.trim().startsWith('{')) {
      const parsed = JSON.parse(payload);
      if (parsed && parsed.type === 'subscription') {
        const { processSubscriptionPayment } = require('./subscriptionPaymentService');
        await processSubscriptionPayment(ctx, sp);
        return; // prevent legacy handler
      }
      if (parsed && parsed.type === 'old_month') {
        const { processOldMonthPayment } = require('./oldMonthPaymentService');
        await processOldMonthPayment(ctx, sp);
        return; // prevent legacy handler
      }
    }
  } catch (e) {
    console.log('stars.js: JSON payload parse/routing error, falling back to legacy flow', e.message);
  }

  let tier = 'regular';
  if (payload.includes('plus')) tier = 'plus';
  const periodMatch = payload.match(/_(\d{4}_\d{2})$/);
  const period = periodMatch ? periodMatch[1] : getCurrentPeriod();

  try {
    await knex('subscriptions').insert({ userId, tier, period, status: 'active' });
  } catch (e) {
    console.error('❌ Subscription insert failed:', e.message);
  }

  try {
    await knex('userGroups')
      .insert({ userId, period, type: tier === 'plus' ? 'plus' : 'regular' })
      .onConflict(['userId','period','type']).ignore();
  } catch (e) {
    console.error('❌ UserGroups upsert failed:', e.message);
  }

  try {
    await knex('months')
      .where({ period, type: tier === 'plus' ? 'plus' : 'regular' })
      .update({ counterPaid: knex.raw('COALESCE("counterPaid", 0) + 1') });
  } catch (e) {
    console.error('❌ Month counter update failed:', e.message);
  }

  // Update user data in database
  try {
    const [year, month] = period.split('_');
    const type = tier === 'plus' ? 'plus' : 'regular';
    
    // Add user to group if not already purchased
    const alreadyPurchased = await hasUserPurchasedMonth(userId, year, month, type);
    if (!alreadyPurchased) {
      await addUserToGroup(userId, year, month, type);
    }
    
    // Ensure user has goblin role
    await knex('userRoles')
      .insert({ userId: Number(userId), role: 'goblin' })
      .onConflict(['userId','role']).ignore();
  } catch {}

  // Create single-use invite link and persist issuance
  try {
    const [year, month] = period.split('_');
    const type = tier === 'plus' ? 'plus' : 'regular';
    const chatId = await getMonthChatId(year, month, type);
    if (chatId) {
      const invite = await ctx.createChatInviteLink({
        chat_id: chatId,
        name: `Single-use for ${userId} ${period} ${type}`,
        creates_join_request: true,
        member_limit: 1
      });
      await knex('invitationLinks').insert({ userId, groupPeriod: period, groupType: type, createdAt: knex.fn.now() });
      await ctx.replyWithHTML(`Твоя ссылка для вступления: ${invite.invite_link}`);
    } else {
      await ctx.reply('Чат для текущего периода не настроен. Напиши администратору.');
    }
  } catch (e) {
    console.error('❌ Invite link creation failed:', e.message);
  }

  await ctx.replyWithHTML('Оплата получена! Доступ будет предоставлен автоматически. Используй /start.');
  try {
    await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `⭐️ ${userId} оплатил подписку ${tier} за период ${period}`)
  } catch {}
});

module.exports = composer;


