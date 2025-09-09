const { Composer, Markup } = require('telegraf');
const { getUser } = require('../../db/helpers');
const knex = require('../../db/knex');

module.exports = Composer.action('adminStarsWithdraw', async (ctx) => {
  console.log('💸 adminStarsWithdraw action started');
  
  try { 
    await ctx.answerCbQuery(); 
  } catch (cbError) {
    console.error('❌ answerCbQuery failed:', cbError.message);
  }
  
  try {
    // Check if user is super admin
    const adminUser = await getUser(ctx.from.id);
    console.log('💸 Admin user check:', adminUser ? { roles: adminUser.roles } : 'null');
    
    if (!adminUser || !adminUser.roles || !adminUser.roles.includes('super')) {
      console.log('❌ adminStarsWithdraw rejected: insufficient permissions');
      await ctx.editMessageText('❌ Недостаточно прав для вывода звёзд', {
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'adminMenu')]])
      });
      return;
    }

    console.log('✅ Permission check passed for withdrawal');

    // Get current balance
    const totalEarnings = await knex('paymentTracking')
      .where('type', 'subscription')
      .where('status', 'completed')
      .where('currency', 'XTR')
      .sum('amount as total')
      .first();

    const totalStars = parseInt(totalEarnings?.total || 0);
    console.log('💸 Current balance:', totalStars);
    
    const withdrawalMessage = `💸 <b>Вывод звёзд</b>\n\n` +
      `💰 <b>Доступно:</b> ${totalStars}⭐\n\n` +
      `🔧 <b>Как вывести:</b>\n` +
      `1. Открой @BotFather\n` +
      `2. Выбери этого бота\n` +
      `3. Bot Settings → Payments → Withdraw Stars\n` +
      `4. Укажи сумму (мин. 1000⭐)\n` +
      `5. Выбери TON Wallet\n` +
      `6. Подтверди\n\n` +
      `💳 <b>Условия:</b>\n` +
      `• Минимум: 1000⭐\n` +
      `• Комиссия: ~3%\n` +
      `• Обработка: мгновенно\n\n` +
      `💡 <b>Рекомендуемые суммы:</b>\n`;

    if (totalStars >= 10000) {
      withdrawalMessage += `• 10000⭐ (комиссия ~300⭐)\n`;
    }
    if (totalStars >= 5000) {
      withdrawalMessage += `• 5000⭐ (комиссия ~150⭐)\n`;
    }
    if (totalStars >= 1000) {
      withdrawalMessage += `• 1000⭐ (комиссия ~30⭐)\n`;
    }
    
    withdrawalMessage += `• Весь баланс: ${totalStars}⭐`;

    console.log('💸 Sending withdrawal info...');

    await ctx.editMessageText(withdrawalMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('💰 Баланс', 'adminStarsBalance'),
          Markup.button.callback('🔄 Обновить', 'adminStarsWithdraw')
        ],
        [
          Markup.button.callback('🔙 Назад', 'adminMenu')
        ]
      ])
    });
    
    console.log('✅ adminStarsWithdraw response sent');
    
  } catch (error) {
    console.error('❌ Error in adminStarsWithdraw:', error);
    console.error('Full error:', error);
    
    try {
      await ctx.editMessageText(`❌ Ошибка получения информации о выводе: ${error.message}`, {
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'adminMenu')]])
      });
    } catch (fallbackError) {
      console.error('❌ Withdrawal fallback failed:', fallbackError.message);
    }
  }
});
