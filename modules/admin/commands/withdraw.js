const { Composer } = require('telegraf');
const knex = require('../../db/knex');
const SETTINGS = require('../../../settings.json');
const { logDenied, logAdmin } = require('../../util/logger');

module.exports = Composer.command('withdraw', async (ctx) => {
  // Simple authorization check
  const userId = ctx.from.id.toString();
  if (userId !== SETTINGS.CHATS.EPINETOV && userId !== SETTINGS.CHATS.GLAVGOBLIN) {
    logDenied(ctx.from.id, ctx.from.username, '/withdraw', 'unauthorized');
    return;
  }

  try {
    const args = ctx.message.text.split(' ');
    const amount = parseInt(args[1]);
    
    // Get current balance first
    const result = await knex('paymentTracking')
      .where('type', 'subscription')
      .where('status', 'completed')
      .where('currency', 'XTR')
      .sum('amount as total')
      .first();

    const totalStars = parseInt(result?.total || 0);
    
    if (!amount || isNaN(amount)) {
      // Show help and current balance
      let helpMessage = `💸 <b>Вывод звёзд</b>\n\n`;
      helpMessage += `💰 <b>Доступно:</b> ${totalStars}⭐\n\n`;
      helpMessage += `<b>Использование:</b>\n`;
      helpMessage += `<code>/withdraw [сумма]</code>\n\n`;
      helpMessage += `<b>Примеры:</b>\n`;
      helpMessage += `<code>/withdraw 1000</code>\n`;
      helpMessage += `<code>/withdraw 5000</code>\n`;
      helpMessage += `<code>/withdraw ${totalStars}</code> (весь баланс)\n\n`;
      helpMessage += `💡 <b>Ограничения:</b>\n`;
      helpMessage += `• Минимум: 1000⭐\n`;
      helpMessage += `• Комиссия: ~3%\n`;
      helpMessage += `• Максимум: ${totalStars}⭐`;
      
      await ctx.replyWithHTML(helpMessage);
      return;
    }
    
    if (amount < 1000) {
      await ctx.replyWithHTML(`❌ <b>Минимальная сумма для вывода: 1000⭐</b>\n\n💰 Доступно: ${totalStars}⭐`);
      return;
    }
    
    if (amount > totalStars) {
      await ctx.replyWithHTML(`❌ <b>Недостаточно средств</b>\n\n💰 Доступно: ${totalStars}⭐\n📝 Запрошено: ${amount}⭐`);
      return;
    }

    // Calculate fees and final amount
    const fee = Math.round(amount * 0.03);
    const finalAmount = amount - fee;
    
    let withdrawMessage = `💸 <b>Инструкция по выводу ${amount}⭐</b>\n\n`;
    withdrawMessage += `💰 <b>Сумма к выводу:</b> ${amount}⭐\n`;
    withdrawMessage += `💳 <b>Комиссия (~3%):</b> ${fee}⭐\n`;
    withdrawMessage += `✅ <b>К получению:</b> ${finalAmount}⭐\n\n`;
    
    withdrawMessage += `🔧 <b>Инструкция по выводу:</b>\n`;
    withdrawMessage += `1. Открой @BotFather\n`;
    withdrawMessage += `2. Напиши: <code>/mybots</code>\n`;
    withdrawMessage += `3. Выбери этого бота из списка\n`;
    withdrawMessage += `4. Найди опцию "Withdraw Earned Stars" или "💰"\n`;
    withdrawMessage += `5. Введи сумму: <code>${amount}</code>\n`;
    withdrawMessage += `6. Подключи TON Wallet (если не подключён)\n`;
    withdrawMessage += `7. Подтверди вывод\n\n`;
    
    withdrawMessage += `💡 <b>Важно:</b>\n`;
    withdrawMessage += `• Операция обычно мгновенная\n`;
    withdrawMessage += `• Понадобится криптокошелёк\n`;
    withdrawMessage += `• Комиссию списывает Telegram\n\n`;
    
    withdrawMessage += `🔗 <b>Быстрая ссылка:</b>\n`;
    withdrawMessage += `https://t.me/BotFather`;

    await ctx.replyWithHTML(withdrawMessage);
    
    // Log the withdrawal request
    console.log(`💸 Withdrawal requested: ${amount}⭐ by user ${userId}`);
    
    // Send to logs chat
    try {
      await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, 
        `💸 Запрос на вывод: ${amount}⭐ от @${ctx.from.username || 'unknown'} (${userId})\nК получению: ${finalAmount}⭐`
      );
    } catch (logError) {
      console.error('Failed to send withdrawal log:', logError.message);
    }
    
    console.log(`✅ Withdrawal instructions sent to ${userId}`);

  } catch (error) {
    console.error('❌ Error in withdraw command:', error);
    await ctx.reply(`❌ Ошибка: ${error.message}`);
  }
});
