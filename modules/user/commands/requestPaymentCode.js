const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json');

module.exports = Composer.command('requestcode', async (ctx) => {
  const userId = ctx.message.from.id;
  const args = ctx.message.text.split(' ').slice(1); // Remove 'requestcode' command
  
  if (args.length < 2) {
    await ctx.replyWithHTML('❌ <b>Использование:</b>\\n<code>/requestcode amount type [description]</code>\\n\\nПримеры:\\n<code>/requestcode 1000 balance</code>\\n<code>/requestcode 500 premium "Monthly subscription"</code>\\n\\n<b>Доступные типы:</b>\\n• <code>balance</code> - пополнение баланса\\n• <code>premium</code> - премиум подписка');
    return;
  }

  const amount = parseInt(args[0]);
  const type = args[1].toLowerCase();
  const description = args.slice(2).join(' ');

  // Validate amount
  if (isNaN(amount) || amount <= 0) {
    await ctx.reply('❌ Некорректная сумма. Укажите положительное число.');
    return;
  }

  // Validate type
  if (!['balance', 'premium'].includes(type)) {
    await ctx.reply('❌ Некорректный тип платежа. Доступные типы: balance, premium');
    return;
  }

  // Check if user already has pending payment codes
  if (ctx.paymentCodes) {
    const pendingCodes = [];
    for (const [code, details] of ctx.paymentCodes) {
      if (details.userId === userId && details.status === 'pending') {
        pendingCodes.push(details);
      }
    }

    if (pendingCodes.length >= 3) {
      await ctx.reply('⚠️ У вас уже есть 3 ожидающих кода платежей. Дождитесь обработки существующих.');
      return;
    }
  }

  try {
    // Generate a unique 6-character payment code
    const paymentCode = generatePaymentCode();
    
    // Create payment details
    const paymentDetails = {
      userId: userId,
      username: ctx.message.from.username || ctx.message.from.first_name,
      amount: amount,
      type: type,
      description: description || null,
      status: 'pending',
      createdAt: new Date(),
      requestedAt: new Date()
    };

    // Store payment code (this would typically be stored in a database)
    if (!ctx.paymentCodes) {
      ctx.paymentCodes = new Map();
    }
    ctx.paymentCodes.set(paymentCode, paymentDetails);

    // Notify admins about the new payment code request
    await notifyAdmins(ctx, paymentCode, paymentDetails);

    // Send confirmation to user
    let message = `✅ <b>Код платежа создан!</b>\\n\\n`;
    message += `🔑 <b>Код:</b> <code>${paymentCode}</code>\\n`;
    message += `💰 <b>Сумма:</b> ${amount}\\n`;
    message += `🏷️ <b>Тип:</b> ${type}\\n`;
    
    if (description) {
      message += `📝 <b>Описание:</b> ${description}\\n`;
    }
    
    message += `\\n💡 <b>Инструкция:</b>\\n`;
    message += `1. Скопируйте код <code>${paymentCode}</code>\\n`;
    message += `2. При оплате через PayPal укажите код в заметке\\n`;
    message += `3. Администратор обработает платеж\\n`;
    message += `4. Используйте <code>/mycodes</code> для проверки статуса`;

    await ctx.replyWithHTML(message);

    // Log the payment code request
    console.log(`[PAYMENT] User ${paymentDetails.username} requested payment code ${paymentCode} for ${amount} (${type})`);

  } catch (error) {
    console.error('[PAYMENT] Error creating payment code:', error);
    await ctx.reply('❌ Ошибка при создании кода платежа. Попробуйте позже.');
  }
});

/**
 * Generate a unique 6-character payment code
 * @returns {string} 6-character alphanumeric code
 */
function generatePaymentCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Notify all admins about a new payment code request
 * @param {Object} ctx - Bot context
 * @param {string} paymentCode - Generated payment code
 * @param {Object} paymentDetails - Payment details
 */
async function notifyAdmins(ctx, paymentCode, paymentDetails) {
  try {
    const adminIds = [];
    
    // Find all admin users
    for (const [userId, user] of Object.entries(ctx.users.list)) {
      if (user.roles && user.roles.includes('admin')) {
        adminIds.push(userId);
      }
    }

    if (adminIds.length === 0) {
      console.warn('[PAYMENT] No admin users found to notify');
      return;
    }

    const message = `🔔 <b>Новый запрос кода платежа</b>\\n\\n`;
    message += `🔑 <b>Код:</b> <code>${paymentCode}</code>\\n`;
    message += `👤 <b>Пользователь:</b> ${paymentDetails.username}\\n`;
    message += `💰 <b>Сумма:</b> ${paymentDetails.amount}\\n`;
    message += `🏷️ <b>Тип:</b> ${paymentDetails.type}\\n`;
    message += `📅 <b>Запрошен:</b> ${paymentDetails.requestedAt.toLocaleDateString('ru-RU')}\\n`;
    
    if (paymentDetails.description) {
      message += `📝 <b>Описание:</b> ${paymentDetails.description}\\n`;
    }
    
    message += `\\n💡 <b>Команды:</b>\\n`;
    message += `• <code>/processnote ${paymentCode} "note text"</code> - обработать платеж\\n`;
    message += `• <code>/checkcodes ${paymentCode}</code> - детали кода`;

    // Send notification to all admins
    for (const adminId of adminIds) {
      try {
        await ctx.telegram.sendMessage(adminId, message, { parse_mode: 'HTML' });
      } catch (error) {
        console.error(`[PAYMENT] Failed to notify admin ${adminId}:`, error);
      }
    }

  } catch (error) {
    console.error('[PAYMENT] Error notifying admins:', error);
  }
}
