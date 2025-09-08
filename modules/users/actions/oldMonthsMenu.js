const { Composer, Markup } = require('telegraf');
const { getUser, getMonths, hasUserPurchasedMonth, getMonthChatId } = require('../../db/helpers');
const { t } = require('../../i18n');
const SETTINGS = require('../../../settings.json');
const knex = require('../../db/knex');

const mod = new Composer();

// Debug log for all oldMonths* callbacks
mod.use(async (ctx, next) => {
  if (ctx.callbackQuery && typeof ctx.callbackQuery.data === 'string' && ctx.callbackQuery.data.startsWith('oldMonths_')) {
    console.log('🧭 oldMonths handler received:', ctx.callbackQuery.data);
  }
  return next();
});

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

mod.action('oldMonthsMenu', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  const monthsShape = await getMonths();
  const years = Object.keys(monthsShape.list).sort((a, b) => b.localeCompare(a));

  let message = t('messages.oldMonths.title');
  const keyboard = years.slice(0, 8).map(y => Markup.button.callback(`${y}`, `oldMonths_year_${y}`));
  const rows = chunk(keyboard, 3).map(r => r);
  rows.push([Markup.button.callback(t('messages.back'), 'refreshUserStatus')]);

  await ctx.editMessageText(message, { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) });
});

mod.action(/^oldMonths_year_(\d{4})$/, async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  const year = ctx.match[1];
  const user = await getUser(ctx.from.id);
  const monthsShape = await getMonths();
  const monthsOfYear = monthsShape.list[year] || {};
  const allMonths = Object.keys(monthsOfYear).sort((a, b) => b.localeCompare(a));

  let message = `📦 <b>Месяцы ${year}</b>\n\n` + t('messages.explain') + '\n\n';

  const rowButtons = [];
  for (const m of allMonths) {
    const period = `${year}_${m}`;
    const owned = user.purchases.groups.regular.includes(period) || user.purchases.groups.plus.includes(period);
    const label = `${m}${owned ? ' ✅' : ''}`;
    rowButtons.push(Markup.button.callback(label, `oldMonths_month_${period}`));
  }

  const rows = chunk(rowButtons, 4);
  rows.push([Markup.button.callback('⬅️ К годам', 'oldMonthsMenu'), Markup.button.callback(t('messages.back'), 'refreshUserStatus')]);

  await ctx.editMessageText(message, { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) });
});

mod.action(/^oldMonths_month_(\d{4}_\d{2})$/, async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  const period = ctx.match[1];
  const [year, month] = period.split('_');
  const userId = ctx.from.id;

  // Re-check ownership fresh from DB each time
  const ownsRegular = await hasUserPurchasedMonth(userId, year, month, 'regular');
  const ownsPlus = await hasUserPurchasedMonth(userId, year, month, 'plus');
  // Ensure level row exists
  const { ensureUserLevelRow } = require('../../loyalty/xpService');
  const lvl = await ensureUserLevelRow(userId);
  const userTier = lvl ? String(lvl.current_tier || '').toUpperCase() : 'N/A';
  const userLevel = lvl ? lvl.current_level : '-';
  // TEMP: relax requirement to WOOD 1+ for testing payments
  const isEligible = !!lvl; // any existing level qualifies (Wood 1+)

  let message = t('messages.oldMonths.monthHeader', { period }) + '\n\n';
  message += (ownsRegular || ownsPlus ? t('messages.oldMonths.owned') : t('messages.oldMonths.notOwned')) + '\n';
  message += t('messages.explain') + '\n';
  message += t('messages.oldMonths.requirement', { required: 'WOOD 1+' }) + '\n';
  message += t('messages.oldMonths.yourLevel', { tier: userTier, level: userLevel, ok: isEligible ? '✅ Подходит' : '❌ Слабоват' }) + '\n';
  message += t('messages.oldMonths.limit') + '\n\n';

  const buttons = [];
  if (ownsRegular) buttons.push(Markup.button.callback(t('messages.oldMonths.joinRegular'), `oldMonths_join_${period}_regular`));
  if (ownsPlus) buttons.push(Markup.button.callback(t('messages.oldMonths.joinPlus'), `oldMonths_join_${period}_plus`));
  if (!ownsRegular && !ownsPlus) {
    // Show choices for Regular / Plus if available
    const monthsShape = await getMonths();
    const hasRegular = !!(monthsShape.list[year] && monthsShape.list[year][month] && monthsShape.list[year][month].regular);
    const hasPlus = !!(monthsShape.list[year] && monthsShape.list[year][month] && monthsShape.list[year][month].plus);
    const rpg = require('../../../configs/rpg');
    const priceReg = (rpg.prices.regularStars || process.env.REGULAR_PRICE) * 3;
    const pricePlus = (rpg.prices.plusStars || process.env.PLUS_PRICE) * 3;
    if (isEligible) {
      if (hasRegular) buttons.push(Markup.button.callback(t('messages.oldMonths.buyRegular', { price: priceReg }), `oldMonths_buy_${period}_regular`));
      if (hasPlus) buttons.push(Markup.button.callback(t('messages.oldMonths.buyPlus', { price: pricePlus }), `oldMonths_buy_${period}_plus`));
      if (!hasRegular && !hasPlus) buttons.push(Markup.button.callback('🔒 Недоступно', 'noop'));
    } else {
      buttons.push(Markup.button.callback('🔒 Купить доступ (Wood 1+)', 'noop'));
    }
  }

  const rows = chunk(buttons, 1);
  rows.push([Markup.button.callback('⬅️ К месяцам', `oldMonths_year_${year}`)]);

  await ctx.editMessageText(message, { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) });
});

mod.action(/^oldMonths_join_(\d{4}_\d{2})_(regular|plus)$/, async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  const userId = ctx.from.id;
  const [, period, type] = ctx.match;
  const [year, month] = period.split('_');

  const owns = await hasUserPurchasedMonth(userId, year, month, type);
  if (!owns) {
    await ctx.answerCbQuery(t('messages.explain'));
    return;
  }
  const chatId = await getMonthChatId(year, month, type);
  if (!chatId) {
    await ctx.answerCbQuery(t('start.groupNotFound'));
    return;
  }
  // Reuse the same flow as regular subscription: get or create a group link
  try {
    const { getOrCreateGroupInvitationLink, requestLinkNotification } = require('../../archive/archiveService');
    const groupPeriod = `${year}_${month}`;
    const linkResult = await getOrCreateGroupInvitationLink(groupPeriod, type);
    if (linkResult?.success && linkResult.link) {
      await ctx.replyWithHTML(t('archive.access', { period: groupPeriod, typeText: type === 'plus' ? '➕ Плюс' : 'Обычная' }) + `\n\n` + t('payments.subscription.inviteLink', { link: linkResult.link }));
    } else {
      try { await requestLinkNotification(Number(userId), groupPeriod, type); } catch {}
      await ctx.replyWithHTML(t('payments.invoices.oldMonth.noLinkUser', { period: groupPeriod, type }));
      try {
        await ctx.telegram.sendMessage(
          SETTINGS.CHATS.EPINETOV,
          t('payments.invoices.oldMonth.noLinkAdmin', { period: groupPeriod, type, userId: ctx.from.id })
        );
      } catch {}
    }
  } catch (e) {
    await ctx.replyWithHTML(t('payments.invoices.oldMonth.noLinkUser', { period: `${year}_${month}`, type }));
    try {
      await ctx.telegram.sendMessage(
        SETTINGS.CHATS.EPINETOV,
        t('payments.invoices.oldMonth.noLinkAdmin', { period: `${year}_${month}`, type, userId: ctx.from.id })
      );
    } catch {}
  }
});

mod.action(/^oldMonths_buy_(\d{4}_\d{2})_(regular|plus)$/, async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  const userId = ctx.from.id;
  const [, period, monthType] = ctx.match;
  const [year, month] = period.split('_');

  const { ensureUserLevelRow: ensureRow } = require('../../loyalty/xpService');
  const lvl = await ensureRow(ctx.from.id);
  // TEMP: allow all users (Wood 1+) for testing payments
  // TEMP: skip 1-per-month limit during testing
  // Create invoice using existing payment flow (XTR)
  const { createOldMonthInvoice } = require('../../payments/oldMonthPaymentService');
  console.log('🛒 oldMonths_buy: creating invoice', { userId, period, monthType });
  try { await ctx.replyWithHTML('⌛ Создаю счет на оплату старого месяца...'); } catch {}
  const res = await createOldMonthInvoice(ctx, period, userId, monthType);
  if (!res.success) {
    console.error('❌ oldMonths_buy: invoice creation failed', res.error);
    try { await ctx.answerCbQuery('❌ Не удалось создать счет'); } catch {}
    await ctx.reply('❌ Не удалось создать счет на оплату старого месяца');
  } else {
    try { await ctx.answerCbQuery('✅ Счет создан'); } catch {}
    try { await ctx.reply('✅ Счет отправлен. Проверь окно с инвойсом выше.'); } catch {}
  }
});

// Backward-compat handler: old buttons without type suffix → default to regular
mod.action(/^oldMonths_buy_(\d{4}_\d{2})$/, async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  const userId = ctx.from.id;
  const [, period] = ctx.match;
  const monthType = 'regular';
  console.log('🛒 oldMonths_buy (compat): creating invoice', { userId, period, monthType });
  try { await ctx.replyWithHTML('⌛ Создаю счет на оплату старого месяца...'); } catch {}
  const { createOldMonthInvoice } = require('../../payments/oldMonthPaymentService');
  const res = await createOldMonthInvoice(ctx, period, userId, monthType);
  if (!res.success) {
    console.error('❌ oldMonths_buy compat: invoice creation failed', res.error);
    try { await ctx.answerCbQuery('❌ Не удалось создать счет'); } catch {}
    await ctx.reply('❌ Не удалось создать счет на оплату старого месяца');
  } else {
    try { await ctx.answerCbQuery('✅ Счет создан'); } catch {}
    try { await ctx.reply('✅ Счет отправлен. Проверь окно с инвойсом выше.'); } catch {}
  }
});

module.exports = mod;


