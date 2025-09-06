const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const { getUser } = require('../../db/helpers');

module.exports = Composer.command('checkcodes', async (ctx) => {
  // Check if user is admin
  const adminUser = await getUser(ctx.message.from.id);
  if (!adminUser || !adminUser.roles || !adminUser.roles.includes('admin')) {
    return;
  }

  const args = ctx.message.text.split(' ').slice(1); // Remove 'checkcodes' command
  
  if (!ctx.paymentCodes || ctx.paymentCodes.size === 0) {
    await ctx.reply('📭 Нет активных кодов платежей');
    return;
  }

  if (args.length === 0) {
    // Show summary of all payment codes
    const pending = [];
    const processed = [];
    
    for (const [code, details] of ctx.paymentCodes) {
      if (details.status === 'pending') {
        pending.push({ code, ...details });
      } else if (details.status === 'processed') {
        processed.push({ code, ...details });
      }
    }

    let message = `📊 <b>Статистика кодов платежей</b>\\n\\n`;
    message += `🔑 <b>Всего кодов:</b> ${ctx.paymentCodes.size}\\n`;
    message += `⏳ <b>Ожидают:</b> ${pending.length}\\n`;
    message += `✅ <b>Обработаны:</b> ${processed.length}\\n\\n`;

    if (pending.length > 0) {
      message += `⏳ <b>Ожидающие платежи:</b>\\n`;
      pending.slice(0, 5).forEach(payment => {
        const date = payment.createdAt.toLocaleDateString('ru-RU');
        message += `• <code>${payment.code}</code> - ${payment.username} (${payment.amount}) - ${date}\\n`;
      });
      if (pending.length > 5) {
        message += `... и еще ${pending.length - 5}\\n`;
      }
    }

    if (processed.length > 0) {
      message += `\\n✅ <b>Обработанные платежи:</b>\\n`;
      processed.slice(0, 3).forEach(payment => {
        const date = payment.processedAt ? payment.processedAt.toLocaleDateString('ru-RU') : 'N/A';
        message += `• <code>${payment.code}</code> - ${payment.username} (${payment.amount}) - ${date}\\n`;
      });
      if (processed.length > 3) {
        message += `... и еще ${processed.length - 3}\\n`;
      }
    }

    message += `\\n💡 <b>Команды:</b>\\n`;
    message += `• <code>/checkcodes pending</code> - показать ожидающие\\n`;
    message += `• <code>/checkcodes processed</code> - показать обработанные\\n`;
    message += `• <code>/checkcodes CODE</code> - детали по коду`;

    await ctx.replyWithHTML(message);
    return;
  }

  const filter = args[0].toLowerCase();

  if (filter === 'pending') {
    const pending = [];
    for (const [code, details] of ctx.paymentCodes) {
      if (details.status === 'pending') {
        pending.push({ code, ...details });
      }
    }

    if (pending.length === 0) {
      await ctx.reply('⏳ Нет ожидающих платежей');
      return;
    }

    let message = `⏳ <b>Ожидающие платежи (${pending.length}):</b>\\n\\n`;
    pending.forEach(payment => {
      const date = payment.createdAt.toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      message += `🔑 <code>${payment.code}</code>\\n`;
      message += `👤 ${payment.username}\\n`;
      message += `💰 ${payment.amount}\\n`;
      message += `🏷️ ${payment.type}\\n`;
      message += `📅 ${date}\\n`;
      if (payment.description) {
        message += `📝 ${payment.description}\\n`;
      }
      message += `\\n`;
    });

    await ctx.replyWithHTML(message);
    return;
  }

  if (filter === 'processed') {
    const processed = [];
    for (const [code, details] of ctx.paymentCodes) {
      if (details.status === 'processed') {
        processed.push({ code, ...details });
      }
    }

    if (processed.length === 0) {
      await ctx.reply('✅ Нет обработанных платежей');
      return;
    }

    let message = `✅ <b>Обработанные платежи (${processed.length}):</b>\\n\\n`;
    processed.forEach(payment => {
      const createdDate = payment.createdAt.toLocaleDateString('ru-RU');
      const processedDate = payment.processedAt ? payment.processedAt.toLocaleDateString('ru-RU') : 'N/A';
      message += `🔑 <code>${payment.code}</code>\\n`;
      message += `👤 ${payment.username}\\n`;
      message += `💰 ${payment.amount}\\n`;
      message += `🏷️ ${payment.type}\\n`;
      message += `📅 Создан: ${createdDate}\\n`;
      message += `✅ Обработан: ${processedDate}\\n`;
      if (payment.description) {
        message += `📝 ${payment.description}\\n`;
      }
      message += `\\n`;
    });

    await ctx.replyWithHTML(message);
    return;
  }

  // Check specific payment code
  const code = args[0].toUpperCase();
  if (!ctx.paymentCodes.has(code)) {
    await ctx.reply(`❌ Код <code>${code}</code> не найден`, { parse_mode: 'HTML' });
    return;
  }

  const payment = ctx.paymentCodes.get(code);
  const createdDate = payment.createdAt.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  let message = `🔑 <b>Детали кода платежа</b>\\n\\n`;
  message += `🔑 <b>Код:</b> <code>${code}</code>\\n`;
  message += `👤 <b>Пользователь:</b> ${payment.username}\\n`;
  message += `💰 <b>Сумма:</b> ${payment.amount}\\n`;
  message += `🏷️ <b>Тип:</b> ${payment.type}\\n`;
  message += `📅 <b>Создан:</b> ${createdDate}\\n`;
  message += `📊 <b>Статус:</b> ${payment.status === 'pending' ? '⏳ Ожидает' : '✅ Обработан'}\\n`;

  if (payment.description) {
    message += `📝 <b>Описание:</b> ${payment.description}\\n`;
  }

  if (payment.status === 'processed' && payment.processedAt) {
    const processedDate = payment.processedAt.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    message += `✅ <b>Обработан:</b> ${processedDate}\\n`;
  }

  if (payment.noteText) {
    message += `📋 <b>Заметка PayPal:</b> ${payment.noteText}\\n`;
  }

  await ctx.replyWithHTML(message);
});
