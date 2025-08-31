const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json');

module.exports = Composer.command('processnote', async (ctx) => {
  // Check if user is admin
  if (!ctx.users.list[ctx.message.from.id] || 
      !ctx.users.list[ctx.message.from.id].roles || 
      !ctx.users.list[ctx.message.from.id].roles.includes('admin')) {
    return;
  }

  const args = ctx.message.text.split(' ').slice(1); // Remove 'processnote' command
  
  if (args.length < 2) {
    await ctx.replyWithHTML('❌ <b>Использование:</b>\\n<code>/processnote CODE "note text" [amount]</code>\\n\\nПримеры:\\n<code>/processnote ABC123 "Payment for premium"</code>\\n<code>/processnote XYZ789 "Monthly subscription" 500</code>');
    return;
  }

  const paymentCode = args[0].toUpperCase();
  const noteText = args.slice(1).join(' ');

  // Check if payment code exists
  if (!ctx.paymentCodes || !ctx.paymentCodes.has(paymentCode)) {
    await ctx.reply(`❌ Код платежа <code>${paymentCode}</code> не найден`, { parse_mode: 'HTML' });
    return;
  }

  const paymentDetails = ctx.paymentCodes.get(paymentCode);
  
  if (paymentDetails.status === 'processed') {
    await ctx.reply(`⚠️ Платеж с кодом <code>${paymentCode}</code> уже обработан`, { parse_mode: 'HTML' });
    return;
  }

  try {
    // Process the payment note
    const result = await ctx.paymentNoteProcessor.processPaymentNote(paymentCode, noteText);
    
    if (result.success) {
      // Update payment status
      paymentDetails.status = 'processed';
      paymentDetails.processedAt = new Date();
      paymentDetails.noteText = noteText;
      paymentDetails.processedBy = ctx.message.from.id;
      
      // Update user balance or apply benefits
      const userId = paymentDetails.userId;
      const user = ctx.users.list[userId];
      
      if (user) {
        if (paymentDetails.type === 'balance') {
          user.balance = (user.balance || 0) + paymentDetails.amount;
          await ctx.reply(`✅ Платеж обработан!\\n\\n💰 Баланс пользователя ${paymentDetails.username} пополнен на ${paymentDetails.amount}`);
        } else if (paymentDetails.type === 'premium') {
          // Apply premium benefits
          const premiumDays = Math.floor(paymentDetails.amount / 100); // 100 = 1 day premium
          user.premium = user.premium || {};
          user.premium.expiresAt = user.premium.expiresAt ? 
            new Date(Math.max(new Date(user.premium.expiresAt), new Date()).getTime() + premiumDays * 24 * 60 * 60 * 1000) :
            new Date(Date.now() + premiumDays * 24 * 60 * 60 * 1000);
          
          await ctx.reply(`✅ Платеж обработан!\\n\\n👑 Пользователю ${paymentDetails.username} добавлено ${premiumDays} дней премиум подписки`);
        } else {
          await ctx.reply(`✅ Платеж обработан!\\n\\n📋 Тип: ${paymentDetails.type}\\n💰 Сумма: ${paymentDetails.amount}`);
        }
      } else {
        await ctx.reply(`⚠️ Платеж обработан, но пользователь не найден в системе`);
      }
      
      // Log the processed payment
      console.log(`[PAYMENT] Processed payment code ${paymentCode} for user ${paymentDetails.username}, amount: ${paymentDetails.amount}`);
      
    } else {
      await ctx.reply(`❌ Ошибка обработки платежа: ${result.error}`);
    }
    
  } catch (error) {
    console.error('[PAYMENT] Error processing payment note:', error);
    await ctx.reply(`❌ Ошибка при обработке платежа: ${error.message}`);
  }
});
