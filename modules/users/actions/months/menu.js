const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const { getUser } = require('../../../db/helpers');

module.exports = Composer.action('userMonths', async (ctx) => {
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData) return;

  const currentPeriod = `${ctx.globalSession.current.year}_${ctx.globalSession.current.month}`;
  const hasCurrentMonth = userData.purchases.groups.regular.indexOf(currentPeriod) > -1;
  const hasCurrentPlus = userData.purchases.groups.plus.indexOf(currentPeriod) > -1;
  
  // Calculate subscription statistics
  const totalMonths = userData.purchases.groups.regular.length;
  const totalPlus = userData.purchases.groups.plus.length;
  const upcomingMonths = 3; // Show next 3 months
  
  const monthsMessage = `📅 <b>УПРАВЛЕНИЕ ПОДПИСКАМИ</b>\n\n` +
    `🎯 <b>Текущий статус:</b>\n` +
    `• <b>Месяц:</b> ${ctx.globalSession.current.year}-${ctx.globalSession.current.month}\n` +
    `• <b>Обычная подписка:</b> ${hasCurrentMonth ? '✅ Активна' : '❌ Не активна'}\n` +
    `• <b>➕ Подписка:</b> ${hasCurrentPlus ? '✅ Активна' : '❌ Не активна'}\n\n` +
    `📊 <b>Статистика подписок:</b>\n` +
    `• <b>Всего месяцев:</b> ${totalMonths}\n` +
    `• <b>➕ месяцев:</b> ${totalPlus}\n` +
    `• <b>Процент ➕:</b> ${totalMonths > 0 ? Math.round((totalPlus / totalMonths) * 100) : 0}%\n\n` +
    `🔮 <b>Планирование:</b>\n` +
    `• <b>Следующие месяцы:</b> ${upcomingMonths} доступно для покупки\n` +
    `• <b>Рекомендуется:</b> ${!hasCurrentMonth ? 'Оплатить текущий месяц' : !hasCurrentPlus ? 'Добавить ➕ к текущему месяцу' : 'Планировать будущие месяцы'}`;

  const monthsKeyboard = [];
  
  // Primary actions based on current status
  if (!hasCurrentMonth) {
    monthsKeyboard.push([Markup.button.callback('💳 Оплатить текущий месяц', 'sendPayment_currentMonth')]);
  } else if (!hasCurrentPlus) {
    monthsKeyboard.push([Markup.button.callback('⭐ Добавить ➕ к месяцу', 'addPlusToCurrentMonth')]);
  }
  
  // Standard actions
  monthsKeyboard.push([
    Markup.button.callback('📋 История подписок', 'subscriptionHistory'),
    Markup.button.callback('🔮 Планирование', 'subscriptionPlanning')
  ]);
  
  monthsKeyboard.push([
    Markup.button.callback('💰 Управление балансом', 'userBalanceTickets'),
    Markup.button.callback('📊 Статистика', 'userStats')
  ]);
  
  // Navigation
  monthsKeyboard.push([
    Markup.button.callback('🔙 Назад в меню', 'userMenu'),
    Markup.button.callback('🏠 В главное меню', 'userMenu')
  ]);

  await ctx.editMessageText(monthsMessage, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(monthsKeyboard)
  });
});