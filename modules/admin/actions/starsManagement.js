const { Composer, Markup } = require('telegraf');
const { getUser } = require('../../db/helpers');
const knex = require('../../db/knex');
const SETTINGS = require('../../../settings.json');

// Star Balance Action
const starsBalanceAction = Composer.action('adminStarsBalance', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  // Check if user is super admin
  const adminUser = await getUser(ctx.from.id);
  if (!adminUser || !adminUser.roles || !adminUser.roles.includes('super')) {
    await ctx.answerCbQuery('❌ Недостаточно прав');
    return;
  }

  console.log(`✅ adminStarsBalance from super admin ${ctx.from.id}`);

  try {
    // Get recent payments from database
    const recentPayments = await knex('paymentTracking')
      .where('type', 'subscription')
      .where('status', 'completed')
      .select('userId', 'subscriptionType', 'amount', 'currency', 'completedAt')
      .orderBy('completedAt', 'desc')
      .limit(5);

    // Calculate total earnings
    const totalEarnings = await knex('paymentTracking')
      .where('type', 'subscription')
      .where('status', 'completed')
      .where('currency', 'XTR')
      .sum('amount as total')
      .first();

    const totalStars = parseInt(totalEarnings?.total || 0);

    // Get payment statistics
    const paymentStats = await knex('paymentTracking')
      .where('type', 'subscription')
      .where('status', 'completed')
      .where('currency', 'XTR')
      .select('subscriptionType')
      .count('* as count')
      .sum('amount as total')
      .groupBy('subscriptionType');

    let starsMessage = `💫 <b>Баланс звёзд бота</b>\n\n`;
    
    // Bot balance info
    starsMessage += `💰 <b>Общая выручка:</b> ${totalStars}⭐\n`;
    starsMessage += `📊 <b>Статистика платежей:</b>\n`;
    
    if (paymentStats.length > 0) {
      paymentStats.forEach(stat => {
        const type = stat.subscriptionType === 'regular' ? 'Обычные' : 'Плюс';
        starsMessage += `  • ${type}: ${stat.count} платежей, ${stat.total}⭐\n`;
      });
    } else {
      starsMessage += `  • Платежей пока нет\n`;
    }
    
    if (recentPayments.length > 0) {
      starsMessage += `\n📝 <b>Последние платежи:</b>\n`;
      recentPayments.forEach((payment, index) => {
        const date = new Date(payment.completedAt).toLocaleDateString('ru-RU');
        const type = payment.subscriptionType === 'regular' ? 'Об' : 'Пл';
        starsMessage += `${index + 1}. ${payment.amount}⭐ (${type}) - ${date}\n`;
      });
    }
    
    starsMessage += `\n💡 <b>Вывод через @BotFather:</b>\n`;
    starsMessage += `Bot Settings → Payments → Withdraw Stars`;

    const keyboard = [
      [
        Markup.button.callback('🔄 Обновить', 'adminStarsBalance'),
        Markup.button.callback('💸 Запросить вывод', 'adminStarsWithdraw')
      ],
      [
        Markup.button.callback('📊 Детали', 'adminStarsDetails'),
        Markup.button.callback('🔙 Назад', 'adminMenu')
      ]
    ];

    await ctx.editMessageText(starsMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });
    
  } catch (error) {
    console.error('❌ Error in adminStarsBalance:', error);
    await ctx.editMessageText('❌ Ошибка получения баланса звёзд', {
      ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'adminMenu')]])
    });
  }
});

// Star Withdrawal Action
const starsWithdrawAction = Composer.action('adminStarsWithdraw', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  // Check if user is super admin
  const adminUser = await getUser(ctx.from.id);
  if (!adminUser || !adminUser.roles || !adminUser.roles.includes('super')) {
    await ctx.answerCbQuery('❌ Недостаточно прав');
    return;
  }

  console.log(`✅ adminStarsWithdraw from super admin ${ctx.from.id}`);

  try {
    // Get current balance
    const totalEarnings = await knex('paymentTracking')
      .where('type', 'subscription')
      .where('status', 'completed')
      .where('currency', 'XTR')
      .sum('amount as total')
      .first();

    const totalStars = parseInt(totalEarnings?.total || 0);
    
    const withdrawalMessage = `💸 <b>Вывод звёзд</b>\n\n` +
      `💰 <b>Доступно для вывода:</b> ${totalStars}⭐\n\n` +
      `🔧 <b>Инструкция по выводу:</b>\n` +
      `1. Открой @BotFather\n` +
      `2. Выбери этого бота\n` +
      `3. Bot Settings → Payments → Withdraw Stars\n` +
      `4. Укажи сумму (минимум 1000⭐)\n` +
      `5. Выбери TON Wallet или другой кошелёк\n` +
      `6. Подтверди вывод\n\n` +
      `💳 <b>Условия:</b>\n` +
      `• Минимум: 1000⭐\n` +
      `• Комиссия: ~3% (Telegram)\n` +
      `• Время: обычно мгновенно\n\n` +
      `💡 <b>Рекомендуемые суммы:</b>\n` +
      `• 5000⭐ (комиссия ~150⭐)\n` +
      `• 10000⭐ (комиссия ~300⭐)\n` +
      `• Весь баланс: ${totalStars}⭐`;

    const keyboard = [
      [
        Markup.button.callback('💰 Проверить баланс', 'adminStarsBalance'),
        Markup.button.callback('📊 Статистика', 'adminStarsDetails')
      ],
      [
        Markup.button.callback('🔙 Назад', 'adminMenu')
      ]
    ];

    await ctx.editMessageText(withdrawalMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });
    
  } catch (error) {
    console.error('❌ Error in adminStarsWithdraw:', error);
    await ctx.editMessageText('❌ Ошибка получения информации о выводе', {
      ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'adminMenu')]])
    });
  }
});

// Star Details Action
const starsDetailsAction = Composer.action('adminStarsDetails', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  // Check if user is super admin
  const adminUser = await getUser(ctx.from.id);
  if (!adminUser || !adminUser.roles || !adminUser.roles.includes('super')) {
    await ctx.answerCbQuery('❌ Недостаточно прав');
    return;
  }

  try {
    // Get detailed statistics
    const dailyStats = await knex('paymentTracking')
      .where('type', 'subscription')
      .where('status', 'completed')
      .where('currency', 'XTR')
      .whereRaw('DATE("completedAt") >= CURRENT_DATE - INTERVAL \'7 days\'')
      .select(knex.raw('DATE("completedAt") as date'))
      .count('* as payments')
      .sum('amount as total')
      .groupBy(knex.raw('DATE("completedAt")'))
      .orderBy('date', 'desc')
      .limit(7);

    // Get top users
    const topUsers = await knex('paymentTracking')
      .join('users', 'paymentTracking.userId', 'users.id')
      .where('paymentTracking.type', 'subscription')
      .where('paymentTracking.status', 'completed')
      .where('paymentTracking.currency', 'XTR')
      .select('users.username', 'users.firstName')
      .count('* as payments')
      .sum('paymentTracking.amount as total')
      .groupBy(['users.id', 'users.username', 'users.firstName'])
      .orderBy('total', 'desc')
      .limit(5);

    let detailsMessage = `📊 <b>Детальная статистика звёзд</b>\n\n`;
    
    if (dailyStats.length > 0) {
      detailsMessage += `📈 <b>Последние 7 дней:</b>\n`;
      dailyStats.forEach(stat => {
        const date = new Date(stat.date).toLocaleDateString('ru-RU');
        detailsMessage += `${date}: ${stat.payments} платежей, ${stat.total}⭐\n`;
      });
    } else {
      detailsMessage += `📈 <b>Последние 7 дней:</b>\nНет данных\n`;
    }
    
    if (topUsers.length > 0) {
      detailsMessage += `\n👑 <b>Топ плательщики:</b>\n`;
      topUsers.forEach((user, index) => {
        const username = user.username || 'no_username';
        const name = user.firstName || 'Unknown';
        detailsMessage += `${index + 1}. @${username}: ${user.total}⭐\n`;
      });
    }

    await ctx.editMessageText(detailsMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('💰 Баланс', 'adminStarsBalance'),
          Markup.button.callback('💸 Вывод', 'adminStarsWithdraw')
        ],
        [
          Markup.button.callback('🔙 Назад', 'adminMenu')
        ]
      ])
    });
    
  } catch (error) {
    console.error('❌ Error in adminStarsDetails:', error);
    await ctx.editMessageText('❌ Ошибка получения детальной статистики', {
      ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'adminMenu')]])
    });
  }
});

module.exports = Composer.compose([
  starsBalanceAction,
  starsWithdrawAction,
  starsDetailsAction
]);
