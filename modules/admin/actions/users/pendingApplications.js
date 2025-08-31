const { Composer, Markup } = require("telegraf");
const { t } = require('../../../../modules/i18n');
const knex = require('../../../../modules/db/knex');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action('adminPendingApplications', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    // Get all applications with 'interview' status
    const pendingApplications = await knex('applications')
      .where({ status: 'interview' })
      .orderBy('createdAt', 'desc');

    if (pendingApplications.length === 0) {
      await ctx.editMessageText(
        '📋 <b>Заявки на собеседование</b>\n\n' +
        'Нет заявок, ожидающих собеседования.',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Назад', 'adminMenu')]
          ])
        }
      );
      return;
    }

    let message = '📋 <b>Заявки на собеседование</b>\n\n';
    const keyboard = [];

    for (const app of pendingApplications) {
      const user = await knex('users').where({ id: app.userId }).first();
      const username = user?.username || 'no-username';
      const firstName = user?.firstName || app.firstName || 'Unknown';
      const lastName = user?.lastName || app.lastName || '';
      
      message += `👤 <b>${firstName} ${lastName}</b>\n`;
      message += `🆔 ID: <code>${app.userId}</code>\n`;
      message += `👤 @${username}\n`;
      message += `📅 ${new Date(app.createdAt).toLocaleDateString('ru-RU')}\n\n`;
      
      keyboard.push([
        Markup.button.callback(
          `📞 Вызвать ${firstName}`,
          `admin_call_interview_${app.userId}`
        )
      ]);
    }

    keyboard.push([Markup.button.callback('🔙 Назад', 'adminMenu')]);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });

  } catch (error) {
    console.error('Error fetching pending applications:', error);
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

// Handle calling a user for interview
module.exports = Composer.action(/^admin_call_interview_\d+$/g, async (ctx) => {
  const userId = ctx.callbackQuery.data.split('_').pop();
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    const user = await knex('users').where({ id: Number(userId) }).first();
    const application = await knex('applications').where({ userId: Number(userId) }).first();
    
    if (!user || !application) {
      await ctx.replyWithHTML('❌ Пользователь или заявка не найдены');
      return;
    }

    const username = user.username || 'no-username';
    const firstName = user.firstName || application.firstName || 'Unknown';
    const lastName = user.lastName || application.lastName || '';

    const interviewMessage = `📞 <b>Собеседование с кандидатом</b>\n\n` +
      `👤 <b>Кандидат:</b> ${firstName} ${lastName}\n` +
      `🆔 <b>ID:</b> <code>${userId}</code>\n` +
      `👤 <b>Username:</b> @${username}\n` +
      `📅 <b>Дата заявки:</b> ${new Date(application.createdAt).toLocaleDateString('ru-RU')}\n\n` +
      `💬 <b>Проведите собеседование и выберите решение:</b>`;

    await ctx.editMessageText(interviewMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Принять', `admin_final_approve_${userId}`),
          Markup.button.callback('❌ Отклонить', `admin_final_deny_${userId}`)
        ],
        [Markup.button.callback('🔙 Назад к списку', 'adminPendingApplications')]
      ])
    });

  } catch (error) {
    console.error('Error calling user for interview:', error);
    await ctx.replyWithHTML('❌ Ошибка при вызове пользователя');
  }
});
