const { Composer } = require("telegraf");
const { ensureRoles } = require('../../rbac');
const knex = require('../../db/knex');

const APPLICATIONS_ROLES = ['protector', 'admin', 'adminPlus', 'super'];

module.exports = Composer.action(/^create_application_\d+$/g, async (ctx) => {
  const userId = ctx.callbackQuery.data.split('_').pop();
  try { await ctx.answerCbQuery(); } catch {}

  const check = await ensureRoles(ctx, APPLICATIONS_ROLES, { errorMessage: '❌ У вас нет прав для создания заявок' });
  if (!check.allowed) return;
  
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

    // Create application with invitation code
    const invitationCode = `гоблин-${userId.toString().slice(-4)}`;
    await knex('applications').insert({
      userId: Number(userId),
      username: user.username || null,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      status: 'pending',
      invitationCode: invitationCode,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Update admin message to show application created
    await ctx.editMessageReplyMarkup({ 
      inline_keyboard: [
        [
          { text: '✅ Заявка создана', callback_data: 'noop' },
          { text: '✅ Одобрить', callback_data: `apply_protector_allow_${userId}` },
          { text: '❌ Отклонить', callback_data: `apply_protector_deny_${userId}` }
        ]
      ]
    });

    // Log the application creation
    await ctx.telegram.sendMessage(process.env.REQUESTS_GROUP_ID, 
      `📋 Заявка создана для пользователя ${user.firstName || 'Unknown'} (ID: ${userId})\n` +
      `🔑 Код: <code>${invitationCode}</code>`, 
      { parse_mode: 'HTML' }
    );

  } catch (error) {
    console.error('Error creating application:', error);
    await ctx.editMessageReplyMarkup({ 
      inline_keyboard: [[{ text: '❌ Ошибка создания заявки', callback_data: 'noop' }]] 
    });
  }
});
