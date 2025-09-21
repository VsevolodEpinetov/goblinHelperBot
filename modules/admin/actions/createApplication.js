const { Composer } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { hasPermission } = require('../../rbac');
const knex = require('../../db/knex');

module.exports = Composer.action(/^create_application_\d+$/g, async (ctx) => {
  const userId = ctx.callbackQuery.data.split('_').pop();
  try { await ctx.answerCbQuery(); } catch {}
  
  // Check permissions
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData || !hasPermission(userData.roles, 'admin:applications:manage')) {
    await ctx.reply('❌ У вас нет прав для создания заявок');
    return;
  }
  
  try {
    // Check if application already exists
    const existingApp = await knex('applications')
      .where('userId', Number(userId))
      .first();

    if (existingApp) {
      await ctx.editMessageReplyMarkup({ 
        inline_keyboard: [[{ text: '❌ Заявка уже существует', callback_data: 'noop' }]] 
      });
      return;
    }

    // Get user info
    const user = await knex('users')
      .where('id', Number(userId))
      .first();

    if (!user) {
      await ctx.editMessageReplyMarkup({ 
        inline_keyboard: [[{ text: '❌ Пользователь не найден', callback_data: 'noop' }]] 
      });
      return;
    }

    // Create application
    await knex('applications').insert({
      userId: Number(userId),
      username: user.username || null,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Update admin message to show application created
    await ctx.editMessageReplyMarkup({ 
      inline_keyboard: [
        [
          { text: '✅ Заявка создана', callback_data: 'noop' },
          { text: '✅ Одобрить → Собеседование', callback_data: `apply_admin_accept_${userId}` },
          { text: '❌ Отклонить', callback_data: `apply_admin_deny_${userId}` }
        ]
      ]
    });

    // Log the application creation
    await ctx.telegram.sendMessage(process.env.REQUESTS_GROUP_ID, 
      `📋 Заявка создана для пользователя ${user.firstName || 'Unknown'} (ID: ${userId})`, 
      { parse_mode: 'HTML' }
    );

  } catch (error) {
    console.error('Error creating application:', error);
    await ctx.editMessageReplyMarkup({ 
      inline_keyboard: [[{ text: '❌ Ошибка создания заявки', callback_data: 'noop' }]] 
    });
  }
});
