const { Composer, Markup } = require('telegraf');
const { getUser, getMonths } = require('../../db/helpers');

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

module.exports = Composer.action(/^oldMonths_year_(\d{4})$/, async (ctx) => {
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
