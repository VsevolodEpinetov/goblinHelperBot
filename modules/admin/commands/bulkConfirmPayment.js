const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const { getUser, getAllUsers, updateUser, addUserToGroup, incrementMonthCounter } = require('../../db/helpers');

module.exports = Composer.command(['bulkconfirm', 'bc'], async (ctx) => {
  // Check if user is admin
  const adminUser = await getUser(ctx.message.from.id);
  if (!adminUser || !adminUser.roles || !adminUser.roles.includes('admin')) {
    return;
  }

  const args = ctx.message.text.split(' ').slice(1); // Remove 'bulkconfirm' command
  
  if (args.length === 0) {
    await ctx.replyWithHTML('❌ <b>Использование:</b>\n<code>/bulkconfirm ID1 @username1 CODE1 ID2 @username2 CODE2 ...</code>\n\nПример:\n<code>/bulkconfirm 123 @john_doe ABC123 456 @jane_smith DEF456</code>');
    return;
  }

  if (args.length % 3 !== 0) {
    await ctx.replyWithHTML('❌ <b>Ошибка:</b> Количество аргументов должно быть кратно 3 (ID, username, код для каждого платежа)');
    return;
  }

  const results = [];
  const errors = [];
  const chatId = ctx.message.chat.id;

  // Process payments in groups of 3
  for (let i = 0; i < args.length; i += 3) {
    const id = args[i];
    const username = args[i + 1];
    const paymentCode = args[i + 2];

    // Validate input format
    if (!/^\d{1,3}$/.test(id)) {
      errors.push(`ID "${id}" должен быть числом меньше 1000`);
      continue;
    }

    if (!/^@[a-zA-Z0-9_]{5,32}$/.test(username)) {
      errors.push(`Username "${username}" должен начинаться с @ и содержать 5-32 символа`);
      continue;
    }

    if (!/^[A-Z0-9]{6}$/.test(paymentCode)) {
      errors.push(`Код платежа "${paymentCode}" должен быть ровно 6 символов (буквы и цифры)`);
      continue;
    }

    // Find user by username
    const allUsers = await getAllUsers();
    const userId = Object.keys(allUsers.list).find(uid => 
      allUsers.list[uid].username === username.substring(1)
    );

    if (!userId) {
      errors.push(`Пользователь ${username} не найден`);
      continue;
    }

    // Check if payment code exists in expected payments
    // Since there's no structured expected payments system yet, we'll create a basic structure
    if (!ctx.expectedPayments) {
      ctx.expectedPayments = {};
    }

    const paymentKey = `${userId}_${paymentCode}`;
    
    if (!ctx.expectedPayments[paymentKey]) {
      // Create a mock expected payment entry for demonstration
      // In a real implementation, this would come from a database
      ctx.expectedPayments[paymentKey] = {
        userId: userId,
        paymentCode: paymentCode,
        amount: 600, // Default amount
        type: 'group',
        status: 'pending',
        timestamp: Date.now()
      };
    }

    // Mark payment as confirmed
    if (ctx.expectedPayments[paymentKey].status === 'pending') {
      ctx.expectedPayments[paymentKey].status = 'confirmed';
      ctx.expectedPayments[paymentKey].confirmedBy = ctx.message.from.id;
      ctx.expectedPayments[paymentKey].confirmedAt = Date.now();

      // Mark user as paid in the current group
      const currentYear = ctx.globalSession.current.year;
      const currentMonth = ctx.globalSession.current.month;
      const currentPeriod = `${currentYear}_${currentMonth}`;

      // Add to user's purchases
      const user = await getUser(userId);
      if (user && !user.purchases.groups.regular.includes(currentPeriod)) {
        user.purchases.groups.regular.push(currentPeriod);
        await updateUser(userId, user);
        
        // Update group counter
        await incrementMonthCounter(currentYear, currentMonth, 'regular', 'paid');

        results.push(`✅ ${username} (ID: ${id}) - платеж подтвержден, доступ к ${currentYear}-${currentMonth} выдан`);
        
        // Send confirmation to user
        try {
          await ctx.telegram.sendMessage(userId, `✅ Ваш платеж подтвержден! Доступ к ${currentYear}-${currentMonth} активирован.`, {
            parse_mode: 'HTML'
          });
        } catch (e) {
          // User might have blocked the bot
          results.push(`⚠️ ${username} - платеж подтвержден, но не удалось отправить уведомление`);
        }

        // Log to admin channel
        await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, 
          `ℹ️ user ${userId} got ${currentYear}-${currentMonth} access via bulk confirmation by @${ctx.message.from.username || ctx.message.from.first_name} (${ctx.message.from.id})`
        );
      } else {
        results.push(`⚠️ ${username} (ID: ${id}) - уже имеет доступ к ${currentYear}-${currentMonth}`);
      }
    } else {
      errors.push(`Платеж для ${username} уже подтвержден или не найден`);
    }
  }

  // Send results
  let responseMessage = '';
  
  if (results.length > 0) {
    responseMessage += `📋 <b>Результаты обработки:</b>\n\n${results.join('\n')}\n\n`;
  }
  
  if (errors.length > 0) {
    responseMessage += `❌ <b>Ошибки:</b>\n\n${errors.join('\n')}`;
  }

  if (responseMessage) {
    await ctx.replyWithHTML(responseMessage);
  }
});
