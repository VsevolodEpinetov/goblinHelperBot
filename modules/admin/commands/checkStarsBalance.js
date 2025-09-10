const { Composer } = require('telegraf');
const { getUser } = require('../../db/helpers');

module.exports = Composer.command('stars_balance', async (ctx) => {
  // Check if user is super admin
  const adminUser = await getUser(ctx.from.id);
  if (!adminUser || !adminUser.roles || !adminUser.roles.includes('super')) {
    console.log(`❌ stars_balance rejected: user ${ctx.from.id} is not super admin`);
    return;
  }

  const userId = ctx.from.id;
  // Stars balance command from super admin

  try {
    // Get bot's star balance using Telegram API
    const starTransactions = await ctx.telegram.getStarTransactions();
    
    // Star transactions retrieved
    
    let balanceMessage = `💫 <b>Bot Star Balance</b>\n\n`;
    
    if (starTransactions && starTransactions.transactions) {
      const transactions = starTransactions.transactions;
      
      // Calculate current balance from transactions
      let totalEarned = 0;
      let totalSpent = 0;
      let recentTransactions = [];
      
      transactions.forEach(tx => {
        if (tx.amount > 0) {
          totalEarned += tx.amount;
        } else {
          totalSpent += Math.abs(tx.amount);
        }
        
        // Keep last 5 transactions for display
        if (recentTransactions.length < 5) {
          recentTransactions.push({
            amount: tx.amount,
            date: new Date(tx.date * 1000).toLocaleString('ru-RU'),
            source: tx.source || 'unknown'
          });
        }
      });
      
      const currentBalance = totalEarned - totalSpent;
      
      balanceMessage += `💰 <b>Текущий баланс:</b> ${currentBalance} ⭐\n\n`;
      balanceMessage += `📈 <b>Всего получено:</b> ${totalEarned} ⭐\n`;
      balanceMessage += `📉 <b>Всего потрачено:</b> ${totalSpent} ⭐\n`;
      balanceMessage += `📊 <b>Всего транзакций:</b> ${transactions.length}\n\n`;
      
      if (recentTransactions.length > 0) {
        balanceMessage += `📝 <b>Последние транзакции:</b>\n`;
        recentTransactions.forEach((tx, index) => {
          const sign = tx.amount > 0 ? '+' : '';
          const type = tx.amount > 0 ? '💰' : '💸';
          balanceMessage += `${index + 1}. ${type} ${sign}${tx.amount}⭐ (${tx.date})\n`;
        });
      }
      
      // Add withdrawal information
      balanceMessage += `\n💡 <b>Как вывести звёзды:</b>\n`;
      balanceMessage += `1. Используй команду /stars_withdraw <amount>\n`;
      balanceMessage += `2. Или переведи через @BotFather → Bot Settings → Payments → Withdraw Stars\n`;
      balanceMessage += `3. Минимальная сумма вывода: 1000⭐\n`;
      balanceMessage += `4. Комиссия Telegram: ~3%\n\n`;
      balanceMessage += `💳 <b>Звёзды можно вывести на:</b>\n`;
      balanceMessage += `• TON Wallet\n`;
      balanceMessage += `• Другие поддерживаемые кошельки`;
      
    } else {
      balanceMessage += `❌ Не удалось получить информацию о балансе\n`;
      balanceMessage += `💡 Попробуйте позже или проверьте права бота`;
    }

    await ctx.reply(balanceMessage, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('❌ Error getting star balance:', error);
    
    let errorMessage = `❌ <b>Ошибка получения баланса</b>\n\n`;
    errorMessage += `Детали: ${error.message}\n\n`;
    errorMessage += `💡 <b>Возможные причины:</b>\n`;
    errorMessage += `• Бот не имеет прав на получение финансовой информации\n`;
    errorMessage += `• Временная проблема с Telegram API\n`;
    errorMessage += `• Функция недоступна для этого типа бота\n\n`;
    errorMessage += `🔧 <b>Альтернативные способы:</b>\n`;
    errorMessage += `1. Проверь через @BotFather → Bot Settings → Payments\n`;
    errorMessage += `2. Используй Telegram Business аккаунт для статистики`;
    
    await ctx.reply(errorMessage, { parse_mode: 'HTML' });
  }
});
