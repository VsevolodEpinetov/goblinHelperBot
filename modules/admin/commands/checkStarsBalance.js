const { Composer } = require('telegraf');
const { getUser } = require('../../db/helpers');
const knex = require('../../db/knex');
const axios = require('axios');

// Helper function to make direct HTTP requests to Telegram Bot API
async function getTelegramApiData() {
  let apiMessage = '';
  const botToken = process.env.TOKEN;
  const baseUrl = `https://api.telegram.org/bot${botToken}`;
  
  try {
    // Try to get star balance via direct API call
    try {
      const response = await axios.get(`${baseUrl}/getMyStarBalance`);
      if (response.data.ok) {
        const starCount = response.data.result?.star_count || 0;
        apiMessage += `💰 <b>API Баланс:</b> ${starCount} ⭐\n`;
      } else {
        apiMessage += `❌ <b>getMyStarBalance:</b> ${response.data.description || 'Unknown error'}\n`;
      }
    } catch (error) {
      if (error.response?.data?.error_code === 400) {
        apiMessage += `❌ <b>getMyStarBalance:</b> Метод недоступен (${error.response.data.description})\n`;
      } else {
        apiMessage += `❌ <b>getMyStarBalance:</b> ${error.message}\n`;
      }
    }
  } catch (error) {
    apiMessage += `❌ <b>getMyStarBalance:</b> ${error.message}\n`;
  }
  
  try {
    // Try to get star transactions via direct API call
    try {
      const response = await axios.get(`${baseUrl}/getStarTransactions`);
      if (response.data.ok) {
        const transactions = response.data.result?.transactions || [];
        apiMessage += `📊 <b>API Транзакции:</b> ${transactions.length}\n`;
        
        if (transactions.length > 0) {
          let totalEarned = 0;
          let totalSpent = 0;
          transactions.forEach(tx => {
            if (tx.amount > 0) {
              totalEarned += tx.amount;
            } else {
              totalSpent += Math.abs(tx.amount);
            }
          });
          apiMessage += `📈 <b>API Получено:</b> ${totalEarned} ⭐\n`;
          apiMessage += `📉 <b>API Потрачено:</b> ${totalSpent} ⭐\n`;
          apiMessage += `💵 <b>API Текущий баланс:</b> ${totalEarned - totalSpent} ⭐\n`;
        }
      } else {
        apiMessage += `❌ <b>getStarTransactions:</b> ${response.data.description || 'Unknown error'}\n`;
      }
    } catch (error) {
      if (error.response?.data?.error_code === 400) {
        apiMessage += `❌ <b>getStarTransactions:</b> Метод недоступен (${error.response.data.description})\n`;
      } else {
        apiMessage += `❌ <b>getStarTransactions:</b> ${error.message}\n`;
      }
    }
  } catch (error) {
    apiMessage += `❌ <b>getStarTransactions:</b> ${error.message}\n`;
  }
  
  // Try to get bot info to verify API access
  try {
    const response = await axios.get(`${baseUrl}/getMe`);
    if (response.data.ok) {
      const botInfo = response.data.result;
      apiMessage += `🤖 <b>Bot Info:</b> @${botInfo.username} (${botInfo.first_name})\n`;
    } else {
      apiMessage += `❌ <b>Bot Info:</b> ${response.data.description || 'Unknown error'}\n`;
    }
  } catch (error) {
    apiMessage += `❌ <b>Bot Info:</b> ${error.message}\n`;
  }
  
  return apiMessage;
}

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
    let balanceMessage = `💫 <b>Bot Star Balance</b>\n\n`;
    
    // === DATABASE DATA ===
    balanceMessage += `🗄️ <b>ДАННЫЕ ИЗ БАЗЫ ДАННЫХ:</b>\n`;
    
    const completedPayments = await knex('paymentTracking')
      .where('status', 'completed')
      .select('amount', 'createdAt', 'subscriptionType', 'userId');
    
    const totalEarned = completedPayments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const recentTransactions = completedPayments
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
    
    if (completedPayments.length > 0) {
      balanceMessage += `💰 <b>Общая выручка:</b> ${totalEarned} ⭐\n`;
      balanceMessage += `📊 <b>Всего платежей:</b> ${completedPayments.length}\n\n`;
      
      if (recentTransactions.length > 0) {
        balanceMessage += `📝 <b>Последние транзакции:</b>\n`;
        recentTransactions.forEach((payment, index) => {
          const date = new Date(payment.createdAt).toLocaleString('ru-RU');
          const amount = payment.amount || 0;
          const type = payment.subscriptionType === 'plus' ? 'Плюс' : 'Обычная';
          balanceMessage += `${index + 1}. 💰 +${amount}⭐ (${type}) - ${date}\n`;
        });
      }
    } else {
      balanceMessage += `❌ Нет данных о платежах в БД\n`;
    }
    
    balanceMessage += `\n`;
    
    // === TELEGRAM API DATA ===
    balanceMessage += `🌐 <b>ДАННЫЕ ИЗ TELEGRAM API:</b>\n`;
    
    try {
      // Try to get data from Telegram API via direct HTTP requests
      const apiData = await getTelegramApiData();
      balanceMessage += apiData;
    } catch (apiError) {
      balanceMessage += `❌ <b>API недоступно:</b> ${apiError.message}\n`;
      balanceMessage += `💡 Это нормально - API методы могут быть недоступны\n`;
    }
    
    balanceMessage += `\n`;
    
    // === WITHDRAWAL INFO ===
    balanceMessage += `💡 <b>Как вывести звёзды:</b>\n`;
    balanceMessage += `1. Используй команду /stars_withdraw &lt;amount&gt;\n`;
    balanceMessage += `2. Или переведи через @BotFather → Bot Settings → Payments → Withdraw Stars\n`;
    balanceMessage += `3. Минимальная сумма вывода: 1000⭐\n`;
    balanceMessage += `4. Комиссия Telegram: ~3%\n\n`;
    balanceMessage += `💳 <b>Звёзды можно вывести на:</b>\n`;
    balanceMessage += `• TON Wallet\n`;
    balanceMessage += `• Другие поддерживаемые кошельки`;

    await ctx.reply(balanceMessage, { parse_mode: 'HTML' });
    
  } catch (error) {
    console.error('❌ Error getting star balance:', error);
    
    let errorMessage = `❌ <b>Ошибка получения баланса</b>\n\n`;
    errorMessage += `Детали: ${error.message}\n\n`;
    errorMessage += `💡 <b>Возможные причины:</b>\n`;
    errorMessage += `• Проблема с подключением к базе данных\n`;
    errorMessage += `• Ошибка в запросе к таблице paymentTracking\n`;
    errorMessage += `• Временная недоступность сервиса\n\n`;
    errorMessage += `🔧 <b>Что делать:</b>\n`;
    errorMessage += `1. Попробуйте позже\n`;
    errorMessage += `2. Проверьте логи сервера\n`;
    errorMessage += `3. Обратитесь к администратору`;
    
    await ctx.reply(errorMessage, { parse_mode: 'HTML' });
  }
});
