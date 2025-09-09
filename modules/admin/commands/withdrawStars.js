const { Composer } = require('telegraf');
const SETTINGS = require('../../../settings.json');

module.exports = Composer.command('stars_withdraw', async (ctx) => {
  // Check if user is authorized (admin)
  const userId = ctx.from.id.toString();
  if (userId !== SETTINGS.CHATS.EPINETOV && userId !== SETTINGS.CHATS.GLAVGOBLIN) {
    console.log(`❌ stars_withdraw command rejected: user ${userId} is not authorized`);
    return;
  }

  console.log(`✅ stars_withdraw command from authorized user ${userId}`);

  try {
    const args = ctx.message.text.split(' ');
    const amount = parseInt(args[1]);
    
    if (!amount || amount < 1) {
      const helpMessage = `💫 <b>Вывод звёзд</b>\n\n` +
        `<b>Использование:</b>\n` +
        `<code>/stars_withdraw [количество]</code>\n\n` +
        `<b>Примеры:</b>\n` +
        `<code>/stars_withdraw 1000</code>\n` +
        `<code>/stars_withdraw 5000</code>\n\n` +
        `💡 <b>Минимальная сумма:</b> 1000⭐\n` +
        `⚠️ <b>Комиссия Telegram:</b> ~3%\n\n` +
        `🔧 <b>Альтернативный способ:</b>\n` +
        `@BotFather → Bot Settings → Payments → Withdraw Stars`;
      
      await ctx.reply(helpMessage, { parse_mode: 'HTML' });
      return;
    }
    
    if (amount < 1000) {
      await ctx.reply('❌ Минимальная сумма для вывода: 1000⭐', { parse_mode: 'HTML' });
      return;
    }

    // Try to create withdrawal request
    try {
      // Note: Telegram doesn't have a direct API for star withdrawal from bots
      // This would typically be done through @BotFather interface
      
      const withdrawalMessage = `💫 <b>Запрос на вывод звёзд</b>\n\n` +
        `💰 <b>Сумма:</b> ${amount}⭐\n` +
        `👤 <b>Запросил:</b> @${ctx.from.username || 'unknown'} (${userId})\n` +
        `📅 <b>Время:</b> ${new Date().toLocaleString('ru-RU')}\n\n` +
        `⚠️ <b>Внимание:</b>\n` +
        `Автоматический вывод через API недоступен.\n` +
        `Необходимо выполнить вывод вручную через @BotFather:\n\n` +
        `🔧 <b>Инструкция:</b>\n` +
        `1. Открой @BotFather\n` +
        `2. Выбери этого бота\n` +
        `3. Bot Settings → Payments → Withdraw Stars\n` +
        `4. Укажи сумму: ${amount}⭐\n` +
        `5. Выбери кошелёк для получения\n\n` +
        `💳 <b>Поддерживаемые кошельки:</b>\n` +
        `• TON Wallet\n` +
        `• Другие криптокошельки\n\n` +
        `📊 <b>После вывода:</b>\n` +
        `Комиссия: ~${Math.round(amount * 0.03)}⭐ (3%)\n` +
        `К получению: ~${amount - Math.round(amount * 0.03)}⭐`;

      await ctx.reply(withdrawalMessage, { parse_mode: 'HTML' });
      
      // Log the withdrawal request
      console.log(`💰 Star withdrawal requested: ${amount}⭐ by user ${userId} (@${ctx.from.username})`);
      
      // Send notification to logs chat
      try {
        await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, 
          `💫 Запрос на вывод звёзд: ${amount}⭐ от @${ctx.from.username || 'unknown'} (${userId})`
        );
      } catch (logError) {
        console.error('Failed to send withdrawal log:', logError.message);
      }
      
    } catch (withdrawalError) {
      console.error('❌ Withdrawal request error:', withdrawalError);
      await ctx.reply('❌ Ошибка создания запроса на вывод. Попробуйте позже.', { parse_mode: 'HTML' });
    }
    
  } catch (error) {
    console.error('❌ Error in stars_withdraw command:', error);
    await ctx.reply('❌ Ошибка выполнения команды. Проверьте формат: /stars_withdraw [количество]', { parse_mode: 'HTML' });
  }
});
