const { Composer, Markup } = require("telegraf");
const { t } = require('../../../../modules/i18n');
const knex = require('../../../../modules/db/knex');
const { ensureRoles } = require('../../../rbac');
const SETTINGS = require('../../../../settings.json');

const APPLICATIONS_ROLES = ['protector', 'admin', 'adminPlus', 'super'];

module.exports = Composer.action('adminPendingApplications', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}

  const check = await ensureRoles(ctx, APPLICATIONS_ROLES, { errorMessage: '❌ У вас нет прав для просмотра заявок' });
  if (!check.allowed) return;
  
  try {
    // Get users without any roles (pending applications)
    const pendingUsers = await knex('users')
      .leftJoin('userRoles', 'users.id', 'userRoles.userId')
      .whereNull('userRoles.role')
      .orWhere('userRoles.role', '')
      .select('users.*')
      .orderBy('users.id', 'desc')
      .limit(5);

    if (pendingUsers.length === 0) {
      await ctx.editMessageText(
        '📋 <b>Новые заявки</b>\n\n' +
        'Нет новых заявок, ожидающих рассмотрения.',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Назад', 'userMenu')]
          ])
        }
      );
      return;
    }

    let message = '📋 <b>Новые заявки</b>\n\n';
    message += `Найдено: <b>${pendingUsers.length}</b> новых заявок\n\n`;

    const keyboard = [];

    for (const user of pendingUsers) {
      const firstName = user.firstName || 'Unknown';
      const lastName = user.lastName || '';
      const username = user.username ? `@${user.username}` : 'No username';
      
      message += `⏳ <b>${firstName} ${lastName}</b> (${username})\n`;
      message += `   ID: ${user.id}\n\n`;

      // Add action buttons for each user
      keyboard.push([
        Markup.button.callback(
          `✅ Принять ${firstName}`,
          `apply_protector_allow_${user.id}`
        ),
        Markup.button.callback(
          `❌ Отклонить ${firstName}`,
          `apply_protector_deny_${user.id}`
        )
      ]);
    }

    // Add navigation buttons
    keyboard.push([Markup.button.callback('🔄 Обновить', 'adminPendingApplications')]);
    keyboard.push([Markup.button.callback('🔙 Назад', 'adminParticipants')]);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });

  } catch (error) {
    console.error('Error fetching pending applications:', error);
    
    let errorMessage = '❌ <b>Ошибка при загрузке заявок</b>\n\n';
    errorMessage += `Техническая ошибка: ${error.message}`;
    
    await ctx.editMessageText(errorMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'adminParticipants')]
      ])
    });
  }
});