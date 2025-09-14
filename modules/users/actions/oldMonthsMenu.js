const { Composer, Markup } = require('telegraf');
const { getUser, getMonths, hasUserPurchasedMonth, getMonthChatId } = require('../../db/helpers');
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

  let message = '📚 <b>Архивы прошлых лет</b>\n\nВыбери год:';
  const keyboard = years.slice(0, 8).map(y => Markup.button.callback(`${y}`, `oldMonths_year_${y}`));
  const rows = chunk(keyboard, 3).map(r => r);
  rows.push([Markup.button.callback('🔙 Назад', 'refreshUserStatus')]);

  await ctx.editMessageText(message, { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) });
});

mod.action(/^oldMonths_year_(\d{4})$/, async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  const year = ctx.match[1];
  const user = await getUser(ctx.from.id);
  const monthsShape = await getMonths();
  const monthsOfYear = monthsShape.list[year] || {};
  const allMonths = Object.keys(monthsOfYear).sort((a, b) => b.localeCompare(a));

  let message = `📚 <b>Архивы ${year}</b>\n\n🕯 Главгоблин ворчит: хочешь знаний — плати звёздами. Хочешь уважения — соблюдай законы.\n\n`;

  const rowButtons = [];
  for (const m of allMonths) {
    const period = `${year}_${m}`;
    const owned = user.purchases.groups.regular.includes(period) || user.purchases.groups.plus.includes(period);
    const label = `${m}${owned ? ' ✅' : ''}`;
    rowButtons.push(Markup.button.callback(label, `oldMonths_month_${period}`));
  }

  const rows = chunk(rowButtons, 4);
  rows.push([Markup.button.callback('⬅️ К годам', 'oldMonthsMenu'), Markup.button.callback('🔙 Назад', 'refreshUserStatus')]);

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
  const isEligible = !!lvl; // any existing level qualifies (Wood 1+)

  let message = `📚 <b>Архив ${period}</b>\n\n`;
  message += `${(ownsRegular || ownsPlus) ? '✅ Доступ уже открыт' : '❌ Доступ не куплен'}\n`;
  message += `🗝 <b>Требуется:</b> WOOD 1+\n`;
  message += `📈 <b>Ты сейчас:</b> ${userTier} ${userLevel} ${isEligible ? '— проходишь' : '— не дотягиваешь'}\n\n`;
  message += `🕯 Слова Главгоблина: знания — за звёзды, уважение — за послушание.`;

  const buttons = [];
  if (ownsRegular) buttons.push(Markup.button.callback('🔗 Войти (Обычный)', `oldMonths_join_${period}_regular`));
  if (ownsPlus) buttons.push(Markup.button.callback('🔗 Войти (Расширенный)', `oldMonths_join_${period}_plus`));
  if (!ownsRegular && !ownsPlus) {
    // Show choices for Regular / Plus if available
    const monthsShape = await getMonths();
    const hasRegular = !!(monthsShape.list[year] && monthsShape.list[year][month] && monthsShape.list[year][month].regular);
    const hasPlus = !!(monthsShape.list[year] && monthsShape.list[year][month] && monthsShape.list[year][month].plus);
    const rpg = require('../../../configs/rpg');
    const priceReg = (rpg.prices.regularStars || process.env.REGULAR_PRICE) * 3;
    const pricePlus = (rpg.prices.plusStars || process.env.PLUS_PRICE) * 3;
    if (isEligible) {
      if (hasRegular) buttons.push(Markup.button.callback(`🛒 Купить доступ (Обычный, ${priceReg}⭐)`, `oldMonths_buy_${period}_regular`));
      if (hasPlus) buttons.push(Markup.button.callback(`🛒 Купить доступ (Расширенный, ${pricePlus}⭐)`, `oldMonths_buy_${period}_plus`));
      if (!hasRegular && !hasPlus) buttons.push(Markup.button.callback('🔒 Недоступно', 'noop'));
    } else {
      buttons.push(Markup.button.callback('🔒 Доступ только с WOOD 1+', 'noop'));
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
    await ctx.answerCbQuery('🕯 Главгоблин ворчит: хочешь знаний — плати звёздами.');
    return;
  }
  const chatId = await getMonthChatId(year, month, type);
  if (!chatId) {
    await ctx.answerCbQuery('🕳 Архив не найден. Позови администратора — он знает тропы.');
    return;
  }
  try {
    const { getOrCreateGroupInvitationLink, requestLinkNotification } = require('../../archive/archiveService');
    const groupPeriod = `${year}_${month}`;
    const linkResult = await getOrCreateGroupInvitationLink(groupPeriod, type);
    if (linkResult?.success && linkResult.link) {
      await ctx.replyWithHTML(
        `📚 <b>Архив</b>\n\n` +
        `✅ <b>Доступ открыт</b>\n\n` +
        `📅 <b>Период:</b> ${groupPeriod}\n` +
        `🔹 <b>Тип:</b> ${type === 'plus' ? 'Расширенный' : 'Обычный'}\n\n` +
        `🎯 <b>Внутри:</b>\n` +
        `• Все материалы месяца\n` +
        `• Обновления и дополнения\n\n` +
        `🕯 <b>Печать доступа выдана</b>\n\n` +
        `Твоя ссылка: ${linkResult.link}`
      );
    } else {
      try { await requestLinkNotification(Number(userId), groupPeriod, type); } catch {}
      await ctx.replyWithHTML(
        `✅ <b>Оплата получена!</b>\n\n` +
        `Доступ будет предоставлен автоматически. Для <b>${groupPeriod}</b> (${type}) пока нет активной ссылки.\n` +
        `Мы уведомим тебя, как только старейшины её создадут.`
      );
      try {
        await ctx.telegram.sendMessage(
          SETTINGS.CHATS.EPINETOV,
          `⚠️ Нет ссылки для ${groupPeriod} (${type}). Пользователь ${ctx.from.id} внёс взнос. Создайте ссылку.`
        );
        await ctx.telegram.sendMessage(
          SETTINGS.CHATS.GLAVGOBLIN,
          `⚠️ Нет ссылки для ${groupPeriod} (${type}). Пользователь ${ctx.from.id} внёс взнос. Создайте ссылку.`
        );
      } catch {}
    }
  } catch (e) {
    await ctx.replyWithHTML(
      `✅ <b>Оплата получена!</b>\n\n` +
      `Доступ будет предоставлен автоматически. Для <b>${year}_${month}</b> (${type}) пока нет активной ссылки.\n` +
      `Мы уведомим тебя, как только старейшины её создадут.`
    );
    try {
      await ctx.telegram.sendMessage(
        SETTINGS.CHATS.EPINETOV,
        `⚠️ Нет ссылки для ${year}_${month} (${type}). Пользователь ${ctx.from.id} внёс взнос. Создайте ссылку.`
      );
      await ctx.telegram.sendMessage(
        SETTINGS.CHATS.GLAVGOBLIN,
        `⚠️ Нет ссылки для ${year}_${month} (${type}). Пользователь ${ctx.from.id} внёс взнос. Создайте ссылку.`
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

  const { createOldMonthInvoice } = require('../../payments/oldMonthPaymentService');
  console.log('🛒 oldMonths_buy: creating invoice', { userId, period, monthType });
  try { await ctx.replyWithHTML('⌛ Создаю счёт на оплату архива...'); } catch {}
  const res = await createOldMonthInvoice(ctx, period, userId, monthType);
  if (!res.success) {
    console.error('❌ oldMonths_buy: invoice creation failed', res.error);
    try { await ctx.answerCbQuery('❌ Не удалось создать счёт'); } catch {}
    await ctx.reply('❌ Не удалось создать счёт на оплату архива');
  } else {
    try { await ctx.answerCbQuery('✅ Счёт создан'); } catch {}
    try { await ctx.reply('✅ Счёт отправлен. Проверь окно с инвойсом выше.'); } catch {}
  }
});

// Backward-compat handler
mod.action(/^oldMonths_buy_(\d{4}_\d{2})$/, async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  const userId = ctx.from.id;
  const [, period] = ctx.match;
  const monthType = 'regular';
  console.log('🛒 oldMonths_buy (compat): creating invoice', { userId, period, monthType });
  try { await ctx.replyWithHTML('⌛ Создаю счёт на оплату архива...'); } catch {}
  const { createOldMonthInvoice } = require('../../payments/oldMonthPaymentService');
  const res = await createOldMonthInvoice(ctx, period, userId, monthType);
  if (!res.success) {
    console.error('❌ oldMonths_buy compat: invoice creation failed', res.error);
    try { await ctx.answerCbQuery('❌ Не удалось создать счёт'); } catch {}
    await ctx.reply('❌ Не удалось создать счёт на оплату архива');
  } else {
    try { await ctx.answerCbQuery('✅ Счёт создан'); } catch {}
    try { await ctx.reply('✅ Счёт отправлен. Проверь окно с инвойсом выше.'); } catch {}
  }
});

module.exports = mod;
