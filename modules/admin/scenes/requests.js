const { Scenes, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
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
        [Markup.button.callback('❌ Отмена', 'userMenu')]
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
            [Markup.button.callback('❌ Отмена', 'userMenu')]
          ])
        }
      );
    }
    // Silently ignore all other text
    return;
  }

  const userId = codeMatch[1];
  
  try {
    // First try to look up application by user ID ending with the last 4 digits
    let applications = await knex('applications')
      .whereRaw('CAST("userId" AS TEXT) LIKE ?', [`%${userId}`])
      .orderBy('createdAt', 'desc');
    
    let application = applications[0]; // Get the most recent one
    let actualUserId = null;

    if (application) {
      // Found in applications table
      actualUserId = application.userId;
    } else {
      // Not found in applications table, try to find user directly by ID ending
      const users = await knex('users')
        .whereRaw('CAST("id" AS TEXT) LIKE ?', [`%${userId}`])
        .orderBy('id', 'desc');
      
      const foundUser = users[0]; // Get the most recent one
      
      if (!foundUser) {
        await ctx.replyWithHTML(
          '❌ <b>Заявка не найдена</b>\n\n' +
          'Проверьте правильность введенного кода. Поиск работает только по заявкам.',
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔙 Назад', 'userMenu')]
            ])
          }
        );
        return;
      }
      
      actualUserId = foundUser.id;
    }

    // Get user info using the actual userId
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
    
    // Determine status based on user roles (not application.status)
    let statusText = 'Новый пользователь';
    let statusEmoji = '❓';
    
    if (!roles || roles.length === 0) {
      statusEmoji = '⏳';
      statusText = 'Ожидает рассмотрения';
    } else if (roles.includes('prereg')) {
      statusEmoji = '📝';
      statusText = 'Предварительная регистрация';
    } else if (roles.includes('pending')) {
      statusEmoji = '⏳';
      statusText = 'Ожидает рассмотрения';
    } else if (roles.includes('preapproved')) {
      statusEmoji = '✅';
      statusText = 'Принят к собеседованию';
    } else if (roles.includes('rejected')) {
      statusEmoji = '❌';
      statusText = 'Отклонено';
    } else if (roles.some(role => ['goblin', 'admin', 'adminPlus', 'super'].includes(role))) {
      statusEmoji = '🎉';
      statusText = 'Полностью одобрен';
    } else {
      statusEmoji = '🔍';
      statusText = roles.join(', ');
    }

    // Add roles information
    if (roles.length > 0) {
      statusText += `\nРоли: ${roles.join(', ')}`;
    }

    const message = `👤 <b>Информация о заявке</b>\n\n` +
      `🆔 <b>ID:</b> ${user.id}\n` +
      `👤 <b>Имя:</b> ${fullName}\n` +
      `📱 <b>Username:</b> ${username}\n` +
      `📅 <b>Дата регистрации:</b> ${new Date(user.createdAt || Date.now()).toLocaleDateString('ru-RU')}\n` +
      `📊 <b>Статус заявки:</b> ${statusEmoji} ${statusText}\n` +
      `🔑 <b>Код:</b> <code>гоблин-${actualUserId.toString().slice(-4)}</code>`;

    // Create action buttons based on user roles (not application.status)
    const keyboard = [];
    
    if (!roles || roles.length === 0 || roles.includes('pending')) {
      keyboard.push([
        Markup.button.callback('✅ Одобрить', `apply_protector_allow_${actualUserId}`),
        Markup.button.callback('❌ Отклонить', `apply_protector_deny_${actualUserId}`)
      ]);
    } else if (roles.includes('preapproved')) {
      keyboard.push([
        Markup.button.callback('🔥 Финальное одобрение', `admin_final_approve_${actualUserId}`),
        Markup.button.callback('💀 Финальное отклонение', `admin_final_deny_${actualUserId}`)
      ]);
    } else if (roles.some(role => ['goblin', 'admin', 'adminPlus', 'super'].includes(role))) {
      keyboard.push([
        Markup.button.callback('✅ Заявка уже одобрена', 'noop')
      ]);
    } else if (roles.includes('rejected')) {
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
          [Markup.button.callback('🔙 Назад', 'userMenu')]
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
