const { Composer, Markup } = require("telegraf");
const { t } = require('../../../../modules/i18n');
const knex = require('../../../../modules/db/knex');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action('adminAllApplications', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    // Get all applications ordered by creation date
    const allApplications = await knex('applications')
      .orderBy('createdAt', 'desc')
      .limit(50); // Limit to prevent message overflow

    if (allApplications.length === 0) {
      await ctx.editMessageText(
        '📊 <b>Все заявки</b>\n\n' +
        'Нет заявок в системе.',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Назад', 'adminMenu')]
          ])
        }
      );
      return;
    }

    // Group applications by status
    const statusGroups = {
      pending: [],
      interview: [],
      approved: [],
      rejected: []
    };

    allApplications.forEach(app => {
      if (statusGroups[app.status]) {
        statusGroups[app.status].push(app);
      }
    });

    let message = '📊 <b>Все заявки</b>\n\n';
    let totalCount = 0;

    // Add status counts
    message += `📈 <b>Статистика:</b>\n`;
    message += `⏳ Ожидают рассмотрения: <b>${statusGroups.pending.length}</b>\n`;
    message += `📞 На собеседовании: <b>${statusGroups.interview.length}</b>\n`;
    message += `✅ Одобрены: <b>${statusGroups.approved.length}</b>\n`;
    message += `❌ Отклонены: <b>${statusGroups.rejected.length}</b>\n\n`;

    totalCount = allApplications.length;
    message += `📋 <b>Последние заявки (${totalCount}):</b>\n\n`;

    const keyboard = [];

    // Show recent applications (last 10)
    const recentApps = allApplications.slice(0, 10);
    for (const app of recentApps) {
      const user = await knex('users').where({ id: app.userId }).first();
      const username = user?.username || 'no-username';
      const firstName = user?.firstName || app.firstName || 'Unknown';
      const lastName = user?.lastName || app.lastName || '';
      
      const statusEmoji = {
        pending: '⏳',
        interview: '📞',
        approved: '✅',
        rejected: '❌'
      }[app.status] || '❓';
      
      const statusText = {
        pending: 'Ожидает',
        interview: 'Собеседование',
        approved: 'Одобрена',
        rejected: 'Отклонена'
      }[app.status] || 'Неизвестно';
      
      message += `${statusEmoji} <b>${firstName} ${lastName}</b>\n`;
      message += `🆔 ID: <code>${app.userId}</code>\n`;
      message += `👤 @${username}\n`;
      message += `📅 ${new Date(app.createdAt).toLocaleDateString('ru-RU')}\n`;
      message += `📊 Статус: <b>${statusText}</b>\n\n`;
    }

    // Add filter buttons
    keyboard.push([
      Markup.button.callback('⏳ Ожидают', 'admin_filter_pending'),
      Markup.button.callback('📞 Собеседование', 'admin_filter_interview')
    ]);
    keyboard.push([
      Markup.button.callback('✅ Одобрены', 'admin_filter_approved'),
      Markup.button.callback('❌ Отклонены', 'admin_filter_rejected')
    ]);
    keyboard.push([Markup.button.callback('🔙 Назад', 'adminMenu')]);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });

  } catch (error) {
    console.error('Error fetching all applications:', error);
    await ctx.editMessageText(
      '❌ <b>Ошибка при загрузке заявок</b>',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'adminMenu')]
        ])
      }
    );
  }
});

// Handle status filters
module.exports = Composer.action(/^admin_filter_(pending|interview|approved|rejected)$/g, async (ctx) => {
  const status = ctx.callbackQuery.data.split('_')[2];
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    const statusText = {
      pending: 'Ожидают рассмотрения',
      interview: 'На собеседовании',
      approved: 'Одобрены',
      rejected: 'Отклонены'
    }[status];

    const statusEmoji = {
      pending: '⏳',
      interview: '📞',
      approved: '✅',
      rejected: '❌'
    }[status];

    // Get applications with specific status
    const filteredApplications = await knex('applications')
      .where({ status })
      .orderBy('createdAt', 'desc')
      .limit(20);

    if (filteredApplications.length === 0) {
      await ctx.editMessageText(
        `${statusEmoji} <b>${statusText}</b>\n\n` +
        `Нет заявок со статусом "${statusText}".`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Назад к списку', 'adminAllApplications')]
          ])
        }
      );
      return;
    }

    let message = `${statusEmoji} <b>${statusText}</b>\n\n`;
    message += `📊 Найдено: <b>${filteredApplications.length}</b> заявок\n\n`;

    const keyboard = [];

    for (const app of filteredApplications) {
      const user = await knex('users').where({ id: app.userId }).first();
      const username = user?.username || 'no-username';
      const firstName = user?.firstName || app.firstName || 'Unknown';
      const lastName = user?.lastName || app.lastName || '';
      
      message += `👤 <b>${firstName} ${lastName}</b>\n`;
      message += `🆔 ID: <code>${app.userId}</code>\n`;
      message += `👤 @${username}\n`;
      message += `📅 ${new Date(app.createdAt).toLocaleDateString('ru-RU')}\n`;
      if (app.updatedAt) {
        message += `🔄 Обновлено: ${new Date(app.updatedAt).toLocaleDateString('ru-RU')}\n`;
      }
      message += `\n`;
      
      // Add action buttons based on status
      if (status === 'pending') {
        keyboard.push([
          Markup.button.callback(
            `✅ Принять ${firstName}`,
            `apply_admin_accept_${app.userId}`
          ),
          Markup.button.callback(
            `❌ Отклонить ${firstName}`,
            `apply_admin_deny_${app.userId}`
          )
        ]);
      } else if (status === 'interview') {
        keyboard.push([
          Markup.button.callback(
            `📞 Вызвать ${firstName}`,
            `admin_call_interview_${app.userId}`
          )
        ]);
      }
    }

    keyboard.push([Markup.button.callback('🔙 Назад к списку', 'adminAllApplications')]);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });

  } catch (error) {
    console.error('Error filtering applications:', error);
    await ctx.editMessageText(
      '❌ <b>Ошибка при фильтрации заявок</b>',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'adminAllApplications')]
        ])
      }
    );
  }
});
