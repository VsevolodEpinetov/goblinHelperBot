const { Composer, Markup } = require('telegraf');
const { getUser, getMonths, hasUserPurchasedMonth, getMonthChatId } = require('../../db/helpers');
const SETTINGS = require('../../../settings.json');
const knex = require('../../db/knex');

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

module.exports = Composer.action('oldMonthsMenu', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  const monthsShape = await getMonths();
  const years = Object.keys(monthsShape.list).sort((a, b) => b.localeCompare(a));

  let message = '📚 <b>Архивы прошлых лет</b>\n\nВыбери год:';
  const keyboard = years.slice(0, 8).map(y => Markup.button.callback(`${y}`, `oldMonths_year_${y}`));
  const rows = chunk(keyboard, 3).map(r => r);
  rows.push([Markup.button.callback('🔙 Назад', 'refreshUserStatus')]);

  await ctx.editMessageText(message, { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) });
});
