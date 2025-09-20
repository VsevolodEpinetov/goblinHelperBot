const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const { getUser } = require('../../../db/helpers');
const { t } = require('../../../i18n');

module.exports = Composer.action('userMonths', async (ctx) => {
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData) return;

  const currentPeriodInfo = util.getCurrentPeriod(ctx);
  const currentPeriod = currentPeriodInfo.period;
  const hasCurrentMonth = userData.purchases.groups.regular.indexOf(currentPeriod) > -1;
  const hasCurrentPlus = userData.purchases.groups.plus.indexOf(currentPeriod) > -1;
  
  // Calculate subscription statistics
  const totalMonths = userData.purchases.groups.regular.length;
  const totalPlus = userData.purchases.groups.plus.length;
  const upcomingMonths = 3; // Show next 3 months
  
  const intro = t('messages.months.title');
  const status = t('messages.months.status', {
    year: currentPeriodInfo.year,
    month: currentPeriodInfo.month,
    regular: hasCurrentMonth ? '✅ Активна' : '❌ Нет',
    plus: hasCurrentPlus ? '✅ Активна' : '❌ Нет'
  });
  const stats = t('messages.months.stats', {
    total: totalMonths,
    plus: totalPlus,
    ratio: totalMonths > 0 ? Math.round((totalPlus / totalMonths) * 100) : 0
  });
  const rec = !hasCurrentMonth ? t('messages.months.payNow') : !hasCurrentPlus ? t('messages.months.addPlus') : 'Планировать будущие месяцы';
  const plan = t('messages.months.plan', { upcoming: upcomingMonths, recommendation: rec });
  const monthsMessage = `${intro}\n\n${status}\n\n${stats}\n\n${plan}`;

  const monthsKeyboard = [];
  
  // Primary actions based on current status
  if (!hasCurrentMonth) monthsKeyboard.push([Markup.button.callback(t('messages.months.payNow'), 'sendPayment_currentMonth')]);
  else if (!hasCurrentPlus) monthsKeyboard.push([Markup.button.callback(t('messages.months.addPlus'), 'addPlusToCurrentMonth')]);
  
  // Standard actions
  monthsKeyboard.push([Markup.button.callback(t('messages.months.history'), 'subscriptionHistory'), Markup.button.callback(t('messages.months.planning'), 'subscriptionPlanning')]);
  
  monthsKeyboard.push([Markup.button.callback(t('messages.months.statsBtn'), 'userStats')]);
  
  // Navigation
  monthsKeyboard.push([Markup.button.callback(t('messages.months.back'), 'userMenu'), Markup.button.callback(t('messages.months.home'), 'userMenu')]);

  await ctx.editMessageText(monthsMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(monthsKeyboard)
  });
});