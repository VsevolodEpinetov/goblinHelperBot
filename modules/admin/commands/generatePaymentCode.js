const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const { getUser, getAllUsers } = require('../../db/helpers');

module.exports = Composer.command('generatecode', async (ctx) => {
  // Check if user is admin
  const adminUser = await getUser(ctx.message.from.id);
  if (!adminUser || !adminUser.roles || !adminUser.roles.includes('admin')) {
    return;
  }

  const args = ctx.message.text.split(' ').slice(1); // Remove 'generatecode' command
  
  if (args.length < 2) {
    await ctx.replyWithHTML('❌ <b>Использование:</b>\\n<code>/generatecode @username amount [type] [description]</code>\\n\\nПримеры:\\n<code>/generatecode @john_doe 1000</code>\\n<code>/generatecode @jane_smith 500 premium "Premium subscription"</code>');
    return;
  }

  const username = args[0];
  const amount = parseFloat(args[1]);
  const type = args[2] || 'standard';
  const description = args.slice(3).join(' ') || 'Payment';

  // Validate username format
  if (!username.startsWith('@')) {
    await ctx.reply('❌ Username должен начинаться с @');
    return;
  }

  // Validate amount
  if (isNaN(amount) || amount <= 0) {
    await ctx.reply('❌ Некорректная сумма');
    return;
  }

  // Find user by username
  const allUsers = await getAllUsers();
  const userId = Object.keys(allUsers.list).find(id => 
    allUsers.list[id].username === username.substring(1)
  );

  if (!userId) {
    await ctx.reply(`❌ Пользователь ${username} не найден`);
    return;
  }

  const user = allUsers.list[userId];

  // Generate unique 6-character payment code
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let paymentCode;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    paymentCode = '';
    for (let i = 0; i < 6; i++) {
      paymentCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    attempts++;
  } while (attempts < maxAttempts && ctx.paymentCodes && ctx.paymentCodes.has(paymentCode));

  if (attempts >= maxAttempts) {
    await ctx.reply('❌ Не удалось сгенерировать уникальный код. Попробуйте еще раз.');
    return;
  }

  // Store payment code in context (you might want to persist this to a database)
  if (!ctx.paymentCodes) {
    ctx.paymentCodes = new Map();
  }

  ctx.paymentCodes.set(paymentCode, {
    userId: userId,
    username: username,
    amount: amount,
    type: type,
    description: description,
    createdAt: new Date(),
    status: 'pending'
  });

  // Send confirmation to admin
  await ctx.replyWithHTML(`✅ <b>Код платежа сгенерирован</b>\\n\\n👤 <b>Пользователь:</b> ${username}\\n💰 <b>Сумма:</b> ${amount}\\n🏷️ <b>Тип:</b> ${type}\\n📝 <b>Описание:</b> ${description}\\n🔑 <b>Код:</b> <code>${paymentCode}</code>\\n\\n📋 <b>Инструкции для пользователя:</b>\\nВключите код <code>${paymentCode}</code> в заметку к платежу PayPal.`);

  // Send notification to user
  try {
    await ctx.telegram.sendMessage(userId, 
      `🔑 <b>Код платежа сгенерирован</b>\\n\\n💰 <b>Сумма:</b> ${amount}\\n🏷️ <b>Тип:</b> ${type}\\n📝 <b>Описание:</b> ${description}\\n🔑 <b>Код:</b> <code>${paymentCode}</code>\\n\\n📋 <b>Важно:</b> Включите этот код в заметку к платежу PayPal для автоматического подтверждения.`, 
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    await ctx.reply(`⚠️ Код сгенерирован, но не удалось отправить уведомление пользователю ${username}`);
  }
});
