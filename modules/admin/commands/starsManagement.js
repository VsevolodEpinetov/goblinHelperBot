const { Composer, Markup } = require('telegraf');
const knex = require('../../db/knex');
const SETTINGS = require('../../../settings.json');

module.exports = Composer.command('stars', async (ctx) => {
  // Check if user is authorized (admin)
  const userId = ctx.from.id.toString();
  if (userId !== SETTINGS.CHATS.EPINETOV && userId !== SETTINGS.CHATS.GLAVGOBLIN) {
    console.log(`❌ stars command rejected: user ${userId} is not authorized`);
    return;
  }

  console.log(`✅ stars command from authorized user ${userId}`);

  try {
    // Get recent payments from database
    const recentPayments = await knex('paymentTracking')
      .where('type', 'subscription')
      .where('status', 'completed')
      .select('userId', 'subscriptionType', 'amount', 'currency', 'completedAt')
      .orderBy('completedAt', 'desc')
      .limit(10);

    // Calculate total earnings
    const totalEarnings = await knex('paymentTracking')
      .where('type', 'subscription')
      .where('status', 'completed')
      .where('currency', 'XTR')
      .sum('amount as total')
      .first();

    const totalStars = totalEarnings?.total || 0;

    // Get payment statistics
    const paymentStats = await knex('paymentTracking')
      .where('type', 'subscription')
      .where('status', 'completed')
      .where('currency', 'XTR')
      .select('subscriptionType')
      .count('* as count')
      .sum('amount as total')
      .groupBy('subscriptionType');

    let starsMessage = `💫 <b>Управление звёздами бота</b>\n\n`;
    
    // Bot balance info
    starsMessage += `💰 <b>Общая выручка:</b> ${totalStars} ⭐\n`;
    starsMessage += `📊 <b>Статистика платежей:</b>\n`;
    
    if (paymentStats.length > 0) {
      paymentStats.forEach(stat => {
        starsMessage += `  • ${stat.subscriptionType}: ${stat.count} платежей, ${stat.total}⭐\n`;
      });
    } else {
      starsMessage += `  • Платежей пока нет\n`;
    }
    
    starsMessage += `\n📝 <b>Последние платежи:</b>\n`;
    
    if (recentPayments.length > 0) {
      recentPayments.forEach((payment, index) => {
        const date = new Date(payment.completedAt).toLocaleString('ru-RU');
        starsMessage += `${index + 1}. ${payment.amount}⭐ (${payment.subscriptionType}) - ${date}\n`;
      });
    } else {
      starsMessage += `Нет завершённых платежей\n`;
    }
    
    starsMessage += `\n🔧 <b>Команды управления:</b>\n`;
    starsMessage += `• <code>/stars_balance</code> - детальный баланс\n`;
    starsMessage += `• <code>/stars_withdraw [сумма]</code> - запрос на вывод\n\n`;
    
    starsMessage += `💡 <b>Вывод звёзд:</b>\n`;
    starsMessage += `1. @BotFather → выбери бота → Bot Settings\n`;
    starsMessage += `2. Payments → Withdraw Stars\n`;
    starsMessage += `3. Укажи сумму и кошелёк\n`;
    starsMessage += `4. Минимум: 1000⭐, комиссия: ~3%`;

    const keyboard = [
      [
        Markup.button.callback('🔄 Обновить баланс', 'refreshStarsBalance'),
        Markup.button.callback('💸 Запросить вывод', 'requestStarsWithdrawal')
      ],
      [
        Markup.button.callback('📊 Подробная статистика', 'detailedStarsStats'),
        Markup.button.callback('🔙 Админ меню', 'adminMenu')
      ]
    ];

    await ctx.reply(starsMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });
    
  } catch (error) {
    console.error('❌ Error in stars management command:', error);
    
    const errorMessage = `❌ <b>Ошибка получения данных о звёздах</b>\n\n` +
      `Детали: ${error.message}\n\n` +
      `💡 <b>Альтернативные способы:</b>\n` +
      `1. Проверь через @BotFather → Bot Settings → Payments\n` +
      `2. Используй /stars_balance для детального баланса\n` +
      `3. Проверь права бота на получение платёжной информации`;
    
    await ctx.reply(errorMessage, { parse_mode: 'HTML' });
  }
});

// Action handlers for the buttons
const refreshAction = Composer.action('refreshStarsBalance', async (ctx) => {
  try { await ctx.answerCbQuery('🔄 Обновляем...'); } catch {}
  
  // Re-run the stars command logic
  await ctx.telegram.sendMessage(ctx.chat.id, '/stars');
});

const withdrawalAction = Composer.action('requestStarsWithdrawal', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  const withdrawalInfo = `💸 <b>Запрос на вывод звёзд</b>\n\n` +
    `Для вывода звёзд используйте:\n` +
    `<code>/stars_withdraw [количество]</code>\n\n` +
    `<b>Пример:</b>\n` +
    `<code>/stars_withdraw 5000</code>\n\n` +
    `💡 <b>Ограничения:</b>\n` +
    `• Минимум: 1000⭐\n` +
    `• Комиссия: ~3%\n` +
    `• Вывод через @BotFather`;
  
  await ctx.editMessageText(withdrawalInfo, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'adminMenu')]])
  });
});

const statsAction = Composer.action('detailedStarsStats', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    // Get detailed statistics from database
    const dailyStats = await knex('paymentTracking')
      .where('type', 'subscription')
      .where('status', 'completed')
      .where('currency', 'XTR')
      .whereRaw('DATE(completed_at) >= CURRENT_DATE - INTERVAL \'30 days\'')
      .select(knex.raw('DATE(completed_at) as date'))
      .count('* as payments')
      .sum('amount as total')
      .groupBy(knex.raw('DATE(completed_at)'))
      .orderBy('date', 'desc')
      .limit(7);

    let statsMessage = `📊 <b>Детальная статистика звёзд</b>\n\n`;
    statsMessage += `📈 <b>Последние 7 дней:</b>\n`;
    
    if (dailyStats.length > 0) {
      dailyStats.forEach(stat => {
        const date = new Date(stat.date).toLocaleDateString('ru-RU');
        statsMessage += `${date}: ${stat.payments} платежей, ${stat.total}⭐\n`;
      });
    } else {
      statsMessage += `Нет данных за последние дни\n`;
    }
    
    // Get user statistics
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

    statsMessage += `\n👑 <b>Топ плательщики:</b>\n`;
    if (topUsers.length > 0) {
      topUsers.forEach((user, index) => {
        const username = user.username || 'no_username';
        const name = user.firstName || 'Unknown';
        statsMessage += `${index + 1}. @${username} ${name}: ${user.total}⭐ (${user.payments} платежей)\n`;
      });
    } else {
      statsMessage += `Данных пока нет\n`;
    }

    await ctx.editMessageText(statsMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'adminMenu')]])
    });
    
  } catch (error) {
    console.error('❌ Error getting detailed stats:', error);
    await ctx.editMessageText('❌ Ошибка получения статистики', {
      ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'adminMenu')]])
    });
  }
});

module.exports = Composer.compose([
  module.exports,
  refreshAction,
  withdrawalAction,
  statsAction
]);
