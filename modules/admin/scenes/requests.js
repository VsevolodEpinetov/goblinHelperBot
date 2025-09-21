const { Scenes, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { hasPermission } = require('../../rbac');
const knex = require('../../db/knex');

const requestsScene = new Scenes.BaseScene('REQUESTS_SCENE');

requestsScene.enter(async (ctx) => {
  await ctx.replyWithHTML(
    '📋 <b>Управление заявками</b>\n\n' +
    'Введите код заявки в формате <code>гоблин-XXXX</code> для поиска и управления заявкой.\n\n' +
    'Пример: <code>гоблин-1234</code>\n\n' +
    '⏰ <i>Режим поиска активен. Введите код или нажмите "Отмена" для выхода.</i>',
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'adminMenu')]
      ])
    }
  ).then(nctx => {
    ctx.session.toRemove = nctx.message_id;
    ctx.session.chatID = nctx.chat.id;
    // Set a timeout to automatically exit the scene after 5 minutes of inactivity
    ctx.session.requestsTimeout = setTimeout(() => {
      ctx.scene.leave();
    }, 5 * 60 * 1000); // 5 minutes
  });
});

requestsScene.on('text', async (ctx) => {
  const input = ctx.message.text.trim();
  
  // Check if input matches the expected format (гоблин-XXXX)
  const codeMatch = input.match(/^гоблин-(\d+)$/);
  if (!codeMatch) {
    // Only respond if the input starts with "гоблин-" (case insensitive)
    if (input.toLowerCase().startsWith('гоблин-')) {
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
    }
    // Silently ignore all other text
    return;
  }

  const userId = codeMatch[1];
  
  try {
    // Look up application by user ID ending with the last 4 digits
    const applications = await knex('applications')
      .whereRaw('CAST("userId" AS TEXT) LIKE ?', [`%${userId}`])
      .orderBy('createdAt', 'desc');
    
    const application = applications[0]; // Get the most recent one

    if (!application) {
      await ctx.replyWithHTML(
        '❌ <b>Заявка не найдена</b>\n\n' +
        'Проверьте правильность введенного кода. Поиск работает только по заявкам.',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Назад', 'adminMenu')]
          ])
        }
      );
      return;
    }

    // Get user info using the actual userId from the application
    const actualUserId = application.userId;
    const user = await knex('users')
      .where('id', actualUserId)
      .first();

    // Get user roles
    const userRoles = await knex('userRoles')
      .where('userId', actualUserId)
      .select('role');

    const roles = userRoles.map(r => r.role);

    // Format user info
    const firstName = user.firstName || 'Не указано';
    const lastName = user.lastName || '';
    const username = user.username ? `@${user.username}` : 'Нет username';
    const fullName = `${firstName} ${lastName}`.trim();
    
    let statusText = 'Новый пользователь';
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

    // Check if user has any roles
    if (roles.length > 0) {
      statusText += `\nРоли: ${roles.join(', ')}`;
    }

    const message = `👤 <b>Информация о заявке</b>\n\n` +
      `🆔 <b>ID:</b> ${user.id}\n` +
      `👤 <b>Имя:</b> ${fullName}\n` +
      `📱 <b>Username:</b> ${username}\n` +
      `📅 <b>Дата регистрации:</b> ${new Date(user.createdAt || Date.now()).toLocaleDateString('ru-RU')}\n` +
      `📊 <b>Статус заявки:</b> ${statusText}\n` +
      `🔑 <b>Код:</b> <code>гоблин-${actualUserId.toString().slice(-4)}</code>`;

    // Create action buttons based on current status
    const keyboard = [];
    
    if (application.status === 'pending') {
      keyboard.push([
        Markup.button.callback('✅ Одобрить → Собеседование', `apply_admin_accept_${actualUserId}`),
        Markup.button.callback('❌ Отклонить', `apply_admin_deny_${actualUserId}`)
      ]);
    } else if (application.status === 'interview') {
      keyboard.push([
        Markup.button.callback('🔥 Финальное одобрение', `admin_final_approve_${actualUserId}`),
        Markup.button.callback('💀 Финальное отклонение', `admin_final_deny_${actualUserId}`)
      ]);
    } else if (application.status === 'approved') {
      keyboard.push([
        Markup.button.callback('✅ Заявка уже одобрена', 'noop')
      ]);
    } else if (application.status === 'rejected') {
      keyboard.push([
        Markup.button.callback('❌ Заявка уже отклонена', 'noop')
      ]);
    } else {
      keyboard.push([
        Markup.button.callback('📋 Неизвестный статус заявки', 'noop')
      ]);
    }

    await ctx.replyWithHTML(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });

    // Clear timeout and exit scene after successful lookup
    if (ctx.session.requestsTimeout) {
      clearTimeout(ctx.session.requestsTimeout);
      delete ctx.session.requestsTimeout;
    }
    await ctx.scene.leave();

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

// Clean up timeout when scene leaves
requestsScene.leave(async (ctx) => {
  if (ctx.session.requestsTimeout) {
    clearTimeout(ctx.session.requestsTimeout);
    delete ctx.session.requestsTimeout;
  }
});

module.exports = requestsScene;
