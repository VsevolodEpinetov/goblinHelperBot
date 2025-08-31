const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json');

module.exports = Composer.command('mycodes', async (ctx) => {
  const userId = ctx.message.from.id;
  
  if (!ctx.paymentCodes || ctx.paymentCodes.size === 0) {
    await ctx.reply('📭 У вас нет активных кодов платежей');
    return;
  }

  // Find payment codes for this user
  const userCodes = [];
  for (const [code, details] of ctx.paymentCodes) {
    if (details.userId === userId) {
      userCodes.push({ code, ...details });
    }
  }

  if (userCodes.length === 0) {
    await ctx.reply('📭 У вас нет активных кодов платежей');
    return;
  }

  // Sort by creation date (newest first)
  userCodes.sort((a, b) => b.createdAt - a.createdAt);

  let message = `🔑 <b>Ваши коды платежей (${userCodes.length}):</b>\\n\\n`;

  userCodes.forEach(payment => {
    const date = payment.createdAt.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    message += `🔑 <code>${payment.code}</code>\\n`;
    message += `💰 ${payment.amount}\\n`;
    message += `🏷️ ${payment.type}\\n`;
    message += `📅 ${date}\\n`;
    message += `📊 ${payment.status === 'pending' ? '⏳ Ожидает обработки' : '✅ Обработан'}\\n`;
    
    if (payment.description) {
      message += `📝 ${payment.description}\\n`;
    }

    if (payment.status === 'processed' && payment.processedAt) {
      const processedDate = payment.processedAt.toLocaleDateString('ru-RU');
      message += `✅ Обработан: ${processedDate}\\n`;
    }

    message += `\\n`;
  });

  message += `💡 <b>Инструкция:</b>\\n`;
  message += `1. Скопируйте код платежа\\n`;
  message += `2. При оплате через PayPal укажите код в заметке\\n`;
  message += `3. Администратор обработает платеж\\n`;
  message += `4. Статус обновится автоматически`;

  await ctx.replyWithHTML(message);
});
