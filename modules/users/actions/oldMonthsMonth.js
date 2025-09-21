const { Composer, Markup } = require('telegraf');
const { hasUserPurchasedMonth, getMonths } = require('../../db/helpers');

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

module.exports = Composer.action(/^oldMonths_month_(\d{4}_\d{2})$/, async (ctx) => {
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
  if (ownsPlus) {
    // User has plus subscription - show both buttons
    buttons.push(Markup.button.callback('🔗 Войти (Расширенный)', `oldMonths_join_${period}_plus`));
    buttons.push(Markup.button.callback('🔗 Войти (Обычный)', `oldMonths_join_${period}_regular`));
  } else if (ownsRegular) {
    // User has only regular subscription - show only regular button
    buttons.push(Markup.button.callback('🔗 Войти (Обычный)', `oldMonths_join_${period}_regular`));
  }
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
