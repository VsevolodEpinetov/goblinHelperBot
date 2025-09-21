const { Scenes, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { hasPermission } = require('../../rbac');
const knex = require('../../db/knex');

const requestsScene = new Scenes.BaseScene('REQUESTS_SCENE');

requestsScene.enter(async (ctx) => {
  await ctx.replyWithHTML(
    '📋 <b>Управление заявками</b>\n\n' +
    'Введите код заявки в формате <code>гоблин-XXXX</code> для поиска и управления заявкой.\n\n' +
    'Пример: <code>гоблин-1234</code>',
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'adminMenu')]
      ])
    }
  ).then(nctx => {
    ctx.session.toRemove = nctx.message_id;
    ctx.session.chatID = nctx.chat.id;
  });
});

requestsScene.on('text', async (ctx) => {
  const input = ctx.message.text.trim();
  
  // Check if input matches the expected format (гоблин-XXXX)
  const codeMatch = input.match(/^гоблин-(\d+)$/);
  if (!codeMatch) {
    await ctx.replyWithHTML(
      '❌ <b>Неверный формат кода</b>\n\n' +
      'Пожалуйста, введите код в формате <code>гоблин-XXXX</code>\n' +
      'Пример: <code>гоблин-1234</code>',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('❌ Отмена', 'adminMenu')]
        ])
      }
    );
    return;
  }

  const userId = codeMatch[1];
  
  try {
    // Look up user by ID
    const user = await knex('users')
      .where('id', Number(userId))
      .first();

    if (!user) {
      await ctx.replyWithHTML(
        '❌ <b>Пользователь не найден</b>\n\n' +
        'Проверьте правильность введенного кода.',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Назад', 'adminMenu')]
          ])
        }
      );
      return;
    }

    // Get user roles
    const userRoles = await knex('userRoles')
      .where('userId', Number(userId))
      .select('role');

    const roles = userRoles.map(r => r.role);

    // Get application status if exists
    const application = await knex('applications')
      .where('userId', Number(userId))
      .first();

    // Format user info
    const firstName = user.firstName || 'Не указано';
    const lastName = user.lastName || '';
    const username = user.username ? `@${user.username}` : 'Нет username';
    const fullName = `${firstName} ${lastName}`.trim();
    
    let statusText = 'Новый пользователь';
    if (application) {
      switch (application.status) {
        case 'pending':
          statusText = '⏳ Ожидает рассмотрения';
          break;
        case 'interview':
          statusText = '⚖️ Проходит собеседование';
          break;
        case 'approved':
          statusText = '✅ Одобрено';
          break;
        case 'rejected':
          statusText = '❌ Отклонено';
          break;
        default:
          statusText = `📋 ${application.status}`;
      }
    }

    // Check if user has any roles
    if (roles.length > 0) {
      statusText += `\nРоли: ${roles.join(', ')}`;
    }

    const message = `👤 <b>Информация о пользователе</b>\n\n` +
      `🆔 <b>ID:</b> ${user.id}\n` +
      `👤 <b>Имя:</b> ${fullName}\n` +
      `📱 <b>Username:</b> ${username}\n` +
      `📅 <b>Дата регистрации:</b> ${new Date(user.createdAt || Date.now()).toLocaleDateString('ru-RU')}\n` +
      `📊 <b>Статус:</b> ${statusText}`;

    // Create action buttons based on current status
    const keyboard = [];
    
    if (application && application.status === 'pending') {
      keyboard.push([
        Markup.button.callback('✅ Одобрить → Собеседование', `apply_admin_accept_${userId}`),
        Markup.button.callback('❌ Отклонить', `apply_admin_deny_${userId}`)
      ]);
    } else if (application && application.status === 'interview') {
      keyboard.push([
        Markup.button.callback('🔥 Финальное одобрение', `admin_final_approve_${userId}`),
        Markup.button.callback('💀 Финальное отклонение', `admin_final_deny_${userId}`)
      ]);
    } else if (application && application.status === 'approved') {
      keyboard.push([
        Markup.button.callback('✅ Заявка уже одобрена', 'noop')
      ]);
    } else if (application && application.status === 'rejected') {
      keyboard.push([
        Markup.button.callback('❌ Заявка уже отклонена', 'noop')
      ]);
    } else {
      keyboard.push([
        Markup.button.callback('📋 Создать заявку', `create_application_${userId}`)
      ]);
    }

    keyboard.push([
      Markup.button.callback('🔙 Назад', 'adminMenu')
    ]);

    await ctx.replyWithHTML(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });

  } catch (error) {
    console.error('Error in requests scene:', error);
    await ctx.replyWithHTML(
      '❌ <b>Ошибка при поиске пользователя</b>\n\n' +
      'Произошла техническая ошибка. Попробуйте позже.',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'adminMenu')]
        ])
      }
    );
  }
});

// Handle noop action (for disabled buttons)
requestsScene.action('noop', async (ctx) => {
  await ctx.answerCbQuery('Эта кнопка неактивна');
});

module.exports = requestsScene;
