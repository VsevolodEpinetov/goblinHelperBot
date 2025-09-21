const { Composer } = require('telegraf');

module.exports = Composer.action(/^oldMonths_buy_(\d{4}_\d{2})_(regular|plus)$/, async (ctx) => {
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
