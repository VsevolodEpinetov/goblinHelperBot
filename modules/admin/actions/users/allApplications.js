const { Composer, Markup } = require("telegraf");
const { t } = require('../../../../modules/i18n');
const knex = require('../../../../modules/db/knex');
const SETTINGS = require('../../../../settings.json');
const { getUser } = require('../../../db/helpers');
const { ensureRoles } = require('../../../rbac');

const SUPER_ROLES = ['super'];

// Determine highest role among approved roles
function getHighestRole(roles) {
  if (!Array.isArray(roles)) return null;
  const order = ['super', 'adminPlus', 'admin', 'goblin'];
  return order.find(r => roles.includes(r)) || null;
}

// Main handler for all applications view
const allApplicationsHandler = Composer.action('adminAllApplications', async (ctx) => {
  const check = await ensureRoles(ctx, SUPER_ROLES);
  if (!check.allowed) return;
  
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    // Get all users
    const users = await knex('users')
      .select('id', 'username', 'firstName', 'lastName')
      .orderBy('id', 'desc')
      .limit(50); // Limit to prevent message overflow

    // Get all roles for these users
    const userIds = users.map(u => u.id);
    const roles = await knex('userRoles')
      .select('userId', 'role')
      .whereIn('userId', userIds);

    // Group roles by userId
    const rolesByUser = {};
    for (const role of roles) {
      if (!rolesByUser[role.userId]) {
        rolesByUser[role.userId] = [];
      }
      rolesByUser[role.userId].push(role.role);
    }

    // Combine users with their roles
    const allUsers = users.map(user => ({
      ...user,
      roles: rolesByUser[user.id] || []
    }));

    if (allUsers.length === 0) {
      await ctx.editMessageText(
        '📋 <b>Управление заявками</b>\n\n' +
        'Нет пользователей в системе.',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Назад', 'userMenu')]
          ])
        }
      );
      return;
    }

    // Roles are already properly loaded as arrays from userRoles table
    const processedUsers = allUsers;

    // Group users by status based on their roles
    const statusGroups = {
      prereg: processedUsers.filter(user => user.roles && user.roles.includes('prereg')),
      pending: processedUsers.filter(user => user.roles && user.roles.includes('pending')),
      preapproved: processedUsers.filter(user => user.roles && user.roles.includes('preapproved')),
      rejected: processedUsers.filter(user => user.roles && user.roles.includes('rejected')),
      approved: processedUsers.filter(user => user.roles && user.roles.some(role => ['goblin', 'admin', 'adminPlus', 'super'].includes(role))),
      other: processedUsers.filter(user => user.roles && user.roles.length > 0 && !user.roles.includes('rejected') && !user.roles.includes('pending') && !user.roles.includes('prereg') && !user.roles.includes('preapproved') && !user.roles.some(role => ['goblin', 'admin', 'adminPlus', 'super'].includes(role)))
    };

    let message = '📋 <b>Управление заявками</b>\n\n';
    let totalCount = processedUsers.length;

    // Add status counts
    message += `📈 <b>Статистика:</b>\n`;
    message += `📝 Предварительная регистрация: <b>${statusGroups.prereg.length}</b>\n`;
    message += `⏳ Ожидают рассмотрения: <b>${statusGroups.pending.length}</b>\n`;
    message += `✅ Приняты к собеседованию: <b>${statusGroups.preapproved.length}</b>\n`;
    message += `❌ Отклонены: <b>${statusGroups.rejected.length}</b>\n`;
    message += `🎉 Полностью одобрены: <b>${statusGroups.approved.length}</b>\n`;
    message += `🔍 Прочие роли: <b>${statusGroups.other.length}</b>\n\n`;

    message += `📋 <b>Последние пользователи (${totalCount}):</b>\n\n`;

    // Add recent users (limit to 5 for readability)
    const recentUsers = processedUsers.slice(0, 5);
    for (const user of recentUsers) {
      const firstName = user.firstName || 'Unknown';
      const lastName = user.lastName || '';
      const username = user.username ? `@${user.username}` : 'No username';
      
      let statusEmoji = '❓';
      let statusText = 'Неизвестно';
      
      if (!user.roles || user.roles.length === 0) {
        statusEmoji = '⏳';
        statusText = 'Ожидает рассмотрения';
      } else if (user.roles.includes('prereg')) {
        statusEmoji = '📝';
        statusText = 'Предварительная регистрация';
      } else if (user.roles.includes('pending')) {
        statusEmoji = '⏳';
        statusText = 'Ожидает рассмотрения';
      } else if (user.roles.includes('preapproved')) {
        statusEmoji = '✅';
        statusText = 'Принят к собеседованию';
      } else if (user.roles.includes('rejected')) {
        statusEmoji = '❌';
        statusText = 'Отклонен';
      } else if (user.roles.some(role => ['goblin', 'admin', 'adminPlus', 'super'].includes(role))) {
        statusEmoji = '🎉';
        const top = getHighestRole(user.roles);
        statusText = top ? top : 'Полностью одобрен';
      } else {
        statusEmoji = '🔍';
        statusText = user.roles.join(', ');
      }
      
      message += `${statusEmoji} <b>${firstName} ${lastName}</b> (${username})\n`;
      message += `   ID: ${user.id} | ${statusText}\n\n`;
    }

    // Create keyboard
    const keyboard = [];

    // Add filter buttons
    keyboard.push([
      Markup.button.callback('📝 Предварительная регистрация', 'admin_filter_prereg'),
      Markup.button.callback('⏳ Новые заявки', 'admin_filter_pending')
    ]);
    keyboard.push([
      Markup.button.callback('❌ Отклоненные', 'admin_filter_rejected'),
      Markup.button.callback('✅ Одобренные', 'admin_filter_approved')
    ]);
    keyboard.push([
      Markup.button.callback('🔍 Прочие роли', 'admin_filter_other')
    ]);
    keyboard.push([
      Markup.button.callback('🔍 Поиск пользователя', 'admin_search_user')
    ]);
    keyboard.push([
      Markup.button.callback('🔄 Обновить', 'adminAllApplications'),
      Markup.button.callback('🔙 Назад', 'userMenu')
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });

  } catch (error) {
    console.error('Error fetching all applications:', error);
    
    let errorMessage = '❌ <b>Ошибка при загрузке заявок</b>\n\n';
    errorMessage += `Техническая ошибка: ${error.message}`;
    
    await ctx.editMessageText(errorMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'userMenu')]
      ])
    });
  }
});

// Handle status filters
const filterHandler = Composer.action(/^admin_filter_(prereg|pending|rejected|approved|other)$/g, async (ctx) => {
  const check = await ensureRoles(ctx, SUPER_ROLES);
  if (!check.allowed) return;
  
  const status = ctx.callbackQuery.data.split('_')[2];
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    let users;
    let statusText;
    let statusEmoji;
    
    switch (status) {
      case 'prereg':
        users = await knex('users')
          .join('userRoles', 'users.id', 'userRoles.userId')
          .where('userRoles.role', 'prereg')
          .select('users.*')
          .orderBy('users.id', 'desc')
          .limit(5);
        statusText = 'Предварительная регистрация';
        statusEmoji = '📝';
        break;
        
      case 'pending':
        users = await knex('users')
          .join('userRoles', 'users.id', 'userRoles.userId')
          .where('userRoles.role', 'pending')
          .select('users.*')
          .orderBy('users.id', 'desc')
          .limit(5);
        statusText = 'Ожидают рассмотрения';
        statusEmoji = '⏳';
        break;
        
      case 'rejected':
        users = await knex('users')
          .join('userRoles', 'users.id', 'userRoles.userId')
          .where('userRoles.role', 'rejected')
          .select('users.*')
          .orderBy('users.id', 'desc')
          .limit(5);
        statusText = 'Отклонены';
        statusEmoji = '❌';
        break;
        
      case 'approved':
        users = await knex('users')
          .join('userRoles', 'users.id', 'userRoles.userId')
          .whereIn('userRoles.role', ['goblin', 'admin', 'adminPlus', 'super'])
          .select('users.*')
          .orderBy('users.id', 'desc')
          .limit(5);
        statusText = 'Одобрены';
        statusEmoji = '✅';
        break;
        
      case 'other':
        users = await knex('users')
          .join('userRoles', 'users.id', 'userRoles.userId')
          .whereNotIn('userRoles.role', ['goblin', 'admin', 'adminPlus', 'super', 'rejected'])
          .select('users.*')
          .orderBy('users.id', 'desc')
          .limit(5);
        statusText = 'Прочие роли';
        statusEmoji = '🔍';
        break;
    }

    if (users.length === 0) {
      await ctx.editMessageText(
        `📋 <b>${statusEmoji} ${statusText}</b>\n\n` +
        'Нет пользователей в этой категории.',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Назад к списку', 'adminAllApplications')]
          ])
        }
      );
      return;
    }

    let message = `📋 <b>${statusEmoji} ${statusText}</b>\n\n`;
    message += `Найдено: <b>${users.length}</b> пользователей\n\n`;

    for (const user of users) {
      const firstName = user.firstName || 'Unknown';
      const lastName = user.lastName || '';
      const username = user.username ? `@${user.username}` : 'No username';
      
      message += `${statusEmoji} <b>${firstName} ${lastName}</b> (${username})\n`;
      message += `   ID: ${user.id}\n\n`;
    }

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад к списку', 'adminAllApplications')]
      ])
    });

  } catch (error) {
    console.error('Error filtering applications:', error);
    await ctx.editMessageText(
      '❌ <b>Ошибка при фильтрации</b>\n\n' +
      `Техническая ошибка: ${error.message}`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад к списку', 'adminAllApplications')]
        ])
      }
    );
  }
});

// Handle user search
const searchHandler = Composer.action('admin_search_user', async (ctx) => {
  const check = await ensureRoles(ctx, SUPER_ROLES);
  if (!check.allowed) return;
  
  try { await ctx.answerCbQuery(); } catch {}
  
  await ctx.editMessageText(
    '🔍 <b>Поиск пользователя</b>\n\n' +
    'Введите ID пользователя или username для поиска:\n\n' +
    'Примеры:\n' +
    '• <code>123456789</code> - поиск по ID\n' +
    '• <code>username</code> - поиск по username\n' +
    '• <code>@username</code> - поиск по username с @\n\n' +
    'Отправьте сообщение с данными для поиска.',
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад к списку', 'adminAllApplications')]
      ])
    }
  );
});

// Handle search results (this will be triggered by a message handler)
const searchMessageHandler = Composer.hears(/^[0-9@a-zA-Z_]+$/, async (ctx, next) => {
  const check = await ensureRoles(ctx, SUPER_ROLES, { errorMessage: null });
  if (!check.allowed) return next();
  
  if (ctx.message.text.startsWith('/')) {
    return next();
  }
  
  if (!ctx.message.text.match(/^[0-9@a-zA-Z_]{3,}$/)) {
    return next();
  }
  const searchQuery = ctx.message.text.trim();
  
  try {
    let users = [];
    
    // Check if it's a numeric ID
    if (/^\d+$/.test(searchQuery)) {
      users = await knex('users')
        .select('id', 'username', 'firstName', 'lastName')
        .where('id', searchQuery);
    } else {
      // Search by username (with or without @)
      const cleanUsername = searchQuery.replace('@', '');
      users = await knex('users')
        .select('id', 'username', 'firstName', 'lastName')
        .where('username', 'ilike', `%${cleanUsername}%`)
        .limit(10);
    }

    // Get roles for found users
    if (users.length > 0) {
      const userIds = users.map(u => u.id);
      const roles = await knex('userRoles')
        .select('userId', 'role')
        .whereIn('userId', userIds);

      // Group roles by userId
      const rolesByUser = {};
      for (const role of roles) {
        if (!rolesByUser[role.userId]) {
          rolesByUser[role.userId] = [];
        }
        rolesByUser[role.userId].push(role.role);
      }

      // Add roles to users
      users = users.map(user => ({
        ...user,
        roles: rolesByUser[user.id] || []
      }));
    }

    if (users.length === 0) {
      await ctx.reply(
        '❌ <b>Пользователь не найден</b>\n\n' +
        `По запросу "${searchQuery}" ничего не найдено.`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Назад к списку', 'adminAllApplications')]
          ])
        }
      );
      return;
    }

    // Roles are already properly loaded as arrays from userRoles table
    const processedUsers = users;

    let message = `🔍 <b>Результаты поиска: "${searchQuery}"</b>\n\n`;
    message += `Найдено: <b>${processedUsers.length}</b> пользователей\n\n`;

    const keyboard = [];

    for (const user of processedUsers) {
      const firstName = user.firstName || 'Unknown';
      const lastName = user.lastName || '';
      const username = user.username ? `@${user.username}` : 'No username';
      
      let statusEmoji = '❓';
      let statusText = 'Неизвестно';
      
      if (!user.roles || user.roles.length === 0) {
        statusEmoji = '⏳';
        statusText = 'Ожидает рассмотрения';
      } else if (user.roles.includes('prereg')) {
        statusEmoji = '📝';
        statusText = 'Предварительная регистрация';
      } else if (user.roles.includes('pending')) {
        statusEmoji = '⏳';
        statusText = 'Ожидает рассмотрения';
      } else if (user.roles.includes('preapproved')) {
        statusEmoji = '✅';
        statusText = 'Принят к собеседованию';
      } else if (user.roles.includes('rejected')) {
        statusEmoji = '❌';
        statusText = 'Отклонен';
      } else if (user.roles.some(role => ['goblin', 'admin', 'adminPlus', 'super'].includes(role))) {
        statusEmoji = '🎉';
        statusText = 'Полностью одобрен';
      } else {
        statusEmoji = '🔍';
        statusText = user.roles.join(', ');
      }
      
      message += `${statusEmoji} <b>${firstName} ${lastName}</b> (${username})\n`;
      message += `   ID: ${user.id} | ${statusText}\n\n`;

      // Add management buttons for each user
        keyboard.push([
        Markup.button.callback(`👤 Управление ${firstName}`, `admin_manage_user_${user.id}`)
      ]);
    }

    keyboard.push([Markup.button.callback('🔙 Назад к списку', 'adminAllApplications')]);

    await ctx.reply(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });

  } catch (error) {
    console.error('Error searching users:', error);
    await ctx.reply(
      '❌ <b>Ошибка при поиске</b>\n\n' +
      `Техническая ошибка: ${error.message}`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад к списку', 'adminAllApplications')]
        ])
      }
    );
  }
});

// Handle user management interface
// Handler for role management
const changeRolesHandler = Composer.action(/^admin_change_roles_(\d+)$/g, async (ctx) => {
  const check = await ensureRoles(ctx, SUPER_ROLES);
  if (!check.allowed) return;

  const userId = ctx.callbackQuery.data.split('_')[3];
  try { await ctx.answerCbQuery(); } catch {}
  
  // Set the user ID in session for the scene
  ctx.userSession = { userId: userId };
  
  // Enter the change roles scene
  await ctx.scene.enter('ADMIN_SCENE_CHANGE_USER_ROLES');
});

const userManagementHandler = Composer.action(/^admin_manage_user_(\d+)$/g, async (ctx) => {
  const check = await ensureRoles(ctx, SUPER_ROLES);
  if (!check.allowed) return;

  const userId = ctx.callbackQuery.data.split('_')[3];
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    // Get user details
    const user = await knex('users')
      .select('id', 'username', 'firstName', 'lastName')
      .where('id', userId)
      .first();

    if (!user) {
      await ctx.editMessageText(
        '❌ <b>Пользователь не найден</b>\n\n' +
        'Пользователь с указанным ID не существует.',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Назад к поиску', 'admin_search_user')]
          ])
        }
      );
      return;
    }

    // Get user roles
    const roles = await knex('userRoles')
      .select('role')
      .where('userId', userId);

    const processedUser = {
      ...user,
      roles: roles.map(r => r.role)
    };
    
    console.log('🔍 User data loaded:', processedUser);

    const firstName = processedUser.firstName || 'Unknown';
    const lastName = processedUser.lastName || '';
    const username = processedUser.username ? `@${processedUser.username}` : 'No username';
    
    let statusEmoji = '❓';
    let statusText = 'Неизвестно';
    
    if (!processedUser.roles || processedUser.roles.length === 0) {
      statusEmoji = '⏳';
      statusText = 'Ожидает рассмотрения';
    } else if (processedUser.roles.includes('prereg')) {
      statusEmoji = '📝';
      statusText = 'Предварительная регистрация';
    } else if (processedUser.roles.includes('pending')) {
      statusEmoji = '⏳';
      statusText = 'Ожидает рассмотрения';
    } else if (processedUser.roles.includes('preapproved')) {
      statusEmoji = '✅';
      statusText = 'Предварительно одобрен';
    } else if (processedUser.roles.includes('rejected')) {
      statusEmoji = '❌';
      statusText = 'Отклонен';
    } else if (processedUser.roles.includes('selfbanned')) {
      statusEmoji = '🚫';
      statusText = 'Самоисключен';
    } else if (processedUser.roles.some(role => ['goblin', 'admin', 'adminPlus', 'super'].includes(role))) {
      statusEmoji = '🎉';
      const top = getHighestRole(processedUser.roles);
      statusText = top ? top : 'Полностью одобрен';
    } else {
      statusEmoji = '🔍';
      statusText = processedUser.roles.join(', ');
    }

    // Load extended stats
    let message = `👤 <b>Управление пользователем</b>\n\n`;
    message += `${statusEmoji} <b>${firstName} ${lastName}</b> (${username})\n`;
    message += `ID: <code>${processedUser.id}</code>\n`;
    message += `Статус: ${statusText}\n`;
    message += `Роли: ${processedUser.roles && processedUser.roles.length > 0 ? processedUser.roles.join(', ') : 'Нет ролей'}\n`;

    try {
      const full = await getUser(Number(userId));
      const reg = full?.purchases?.groups?.regular?.length || 0;
      const plus = full?.purchases?.groups?.plus?.length || 0;
      message += `Месяцы: ${reg}+${plus}\n`;
    } catch {}
    try {
      const lvl = await knex('user_levels').where({ user_id: Number(userId) }).first();
      if (lvl) {
        message += `XP: ${lvl.total_xp || 0} | Уровень: ${lvl.current_tier?.toUpperCase?.() || 'N/A'} ${lvl.current_level || 0}\n`;
      }
    } catch {}

    message += `\nВыберите действие:`;

    const keyboard = [];

    // Add action buttons based on current status
    if (!processedUser.roles || processedUser.roles.length === 0 || processedUser.roles.includes('pending') || processedUser.roles.includes('prereg') || processedUser.roles.includes('preapproved')) {
      // Not fully approved
      keyboard.push([
        Markup.button.callback('✅ Преодобрить', `admin_approve_user_${userId}`),
        Markup.button.callback('⭐ Супер одобрить', `admin_super_approve_user_${userId}`)
      ]);
      keyboard.push([
        Markup.button.callback('🚫 Забанить', `admin_ban_user_${userId}`)
      ]);
    } else if (processedUser.roles.includes('preapproved')) {
      // Preapproved user - can super approve or downgrade
      keyboard.push([
        Markup.button.callback('⭐ Супер одобрить', `admin_super_approve_user_${userId}`),
        Markup.button.callback('⬇️ Понизить статус', `admin_downgrade_user_${userId}`)
      ]);
    } else if (processedUser.roles.includes('rejected')) {
      // Rejected user - can approve or super approve
      keyboard.push([
        Markup.button.callback('✅ Преодобрить', `admin_approve_user_${userId}`),
        Markup.button.callback('⭐ Супер одобрить', `admin_super_approve_user_${userId}`)
      ]);
    } else if (processedUser.roles.includes('selfbanned')) {
      // Self-banned user - can approve or super approve
      keyboard.push([
        Markup.button.callback('✅ Преодобрить', `admin_approve_user_${userId}`),
        Markup.button.callback('⭐ Супер одобрить', `admin_super_approve_user_${userId}`)
      ]);
      keyboard.push([
        Markup.button.callback('👤 Роли', `admin_change_roles_${userId}`)
      ]);
      keyboard.push([
        Markup.button.callback('🚫 Забанить', `admin_ban_user_${userId}`)
      ]);
    } else if (processedUser.roles.some(role => ['goblin', 'admin', 'adminPlus', 'super'].includes(role))) {
      // Approved user menu
      keyboard.push([
        Markup.button.callback('📜 История', `admin_user_history_${userId}`),
        Markup.button.callback('🗓️ Месяцы', `showUserMonths_${userId}`)
      ]);
      keyboard.push([
        Markup.button.callback('🚀 Кикстартеры', `admin_user_kickstarters_${userId}`),
        Markup.button.callback('👤 Роли', `admin_change_roles_${userId}`)
      ]);
      keyboard.push([
        Markup.button.callback('✨ Настроить XP', `admin_user_adjust_xp_${userId}`),
        Markup.button.callback('🏆 Достижения', `admin_user_achievements_${userId}`)
      ]);
      keyboard.push([
        Markup.button.callback('📜 Свитки', `admin_user_scrolls_${userId}`)
      ]);
      keyboard.push([
        Markup.button.callback('🚫 Забанить', `admin_ban_user_${userId}`)
      ]);
    }

    keyboard.push([
      Markup.button.callback('🔙 Назад к поиску', 'admin_search_user')
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });

  } catch (error) {
    console.error('Error managing user:', error);
    await ctx.editMessageText(
      '❌ <b>Ошибка при загрузке пользователя</b>\n\n' +
      `Техническая ошибка: ${error.message}`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад к поиску', 'admin_search_user')]
        ])
      }
    );
  }
});

// Handle user actions
const userActionHandler = Composer.action(/^admin_(approve|reject|super_approve|ban|delete|downgrade)_user_(\d+)$/g, async (ctx) => {
  const roleCheck = await ensureRoles(ctx, SUPER_ROLES);
  if (!roleCheck.allowed) return;

  const parts = ctx.callbackQuery.data.split('_');
  let action, userId;
  
  if (parts[1] === 'super' && parts[2] === 'approve') {
    action = 'super_approve';
    userId = parts[4];
  } else {
    action = parts[1];
    userId = parts[3];
  }
  
  console.log(`🎯 admin_${action}_user action triggered!`);
  console.log('🎯 Callback data:', ctx.callbackQuery.data);
  console.log('🎯 Split result:', ctx.callbackQuery.data.split('_'));
  console.log('🎯 User ID:', userId);
  console.log('🎯 Action:', action);
  
  try { await ctx.answerCbQuery(); } catch {}
  
  // Validate userId
  if (!userId || isNaN(Number(userId))) {
    console.error('❌ Invalid userId:', userId);
    await ctx.editMessageText('❌ Ошибка: неверный ID пользователя');
    return;
  }
  
  try {
    // Get user details first
    const user = await knex('users').where('id', Number(userId)).first();
    if (!user) {
      await ctx.editMessageText('❌ Пользователь не найден');
      return;
    }

    const firstName = user.firstName || 'Unknown';
    const username = user.username ? `@${user.username}` : 'No username';

    switch (action) {
      case 'approve':
        // Remove rejected role if exists and add preapproved role
        await knex('userRoles').where('userId', Number(userId)).where('role', 'rejected').del();
        await knex('userRoles').insert({ userId: Number(userId), role: 'preapproved' }).onConflict(['userId', 'role']).ignore();
        
        // No need to update in-memory data - database is source of truth
        
        // Generate natural code phrase
        const codePhrase = `гоблин-${userId.toString().slice(-4)}`;
        
        // Send approval message to user
        try {
          await ctx.telegram.sendMessage(userId, 
            '✅ <b>Заявка принята к рассмотрению</b>\n\n' +
'Ты прошёл первый круг. Теперь тебя ждёт собеседование.\n\n' +
'Напиши @EvgenMol и прошепчи кодовую фразу:\n' +
`<code>${codePhrase}</code>\n\n` +
'Совет решит, достоин ли ты логова. Ответ будет окончательным.',
            {
              parse_mode: 'HTML'
            }
          );
        } catch (error) {
          console.error(`Failed to send approval message to user ${userId}:`, error);
        }
        
        await ctx.editMessageText(
          `✅ <b>Пользователь принят к собеседованию</b>\n\n` +
          `${firstName} (${username}) получил роль "preapproved"\n` +
          `Кодовая фраза: <code>${codePhrase}</code>\n\n` +
          `📨 Уведомление отправлено пользователю`,
          {
            parse_mode: 'HTML'
          }
        );
        break;

      case 'reject':
        // Remove all roles and add rejected role
        await knex('userRoles').where('userId', Number(userId)).del();
        await knex('userRoles').insert({ userId: Number(userId), role: 'rejected' });
        
        // No need to update in-memory data - database is source of truth
        
        // Send rejection message to user
        try {
          await ctx.telegram.sendMessage(userId, 
'❌ <b>Заявка отклонена</b>\n\n' +
'Совет посмотрел на тебя и расхохотался. Нет тебе дороги в логово.\n\n' +
'Иди к эльфам — там тебя, может, и приголубят.',
            {
              parse_mode: 'HTML'
            }
          );
        } catch (error) {
          console.error(`Failed to send rejection message to user ${userId}:`, error);
        }
        
        await ctx.editMessageText(
          `❌ <b>Пользователь отклонен</b>\n\n` +
          `${firstName} (${username}) получил роль "rejected"\n\n` +
          `📨 Уведомление отправлено пользователю`,
          {
            parse_mode: 'HTML',
          }
        );
        break;

      case 'super_approve':
        // Remove all roles and add goblin role
        await knex('userRoles').where('userId', Number(userId)).del();
        await knex('userRoles').insert({ userId: Number(userId), role: 'goblin' });
        
        // No need to update in-memory data - database is source of truth
        // getUser() will load fresh data from database when needed
        
        // Send super approval message to user
        try {
          await ctx.telegram.sendMessage(userId, 
            '🎉 <b>Заявка полностью одобрена!</b>\n\n' +
            'Поздравляем! Твоя заявка была полностью одобрена.\n\n' +
            'Теперь ты можешь пользоваться всеми возможностями бота через /start\n\n' +
            'Добро пожаловать в сообщество!',
            {
              parse_mode: 'HTML'
            }
          );
        } catch (error) {
          console.error(`Failed to send super approval message to user ${userId}:`, error);
        }
        
        await ctx.editMessageText(
          `⭐ <b>Пользователь полностью одобрен</b>\n\n` +
          `${firstName} (${username}) получил роль "goblin"\n\n` +
          `📨 Уведомление отправлено пользователю`,
          {
            parse_mode: 'HTML'
          }
        );
        break;

      case 'ban':
        // Add banned role
        await knex('userRoles').insert({ userId: Number(userId), role: 'banned' }).onConflict(['userId', 'role']).ignore();
        
        // No need to update in-memory data - database is source of truth
        
        // Send ban message to user
        try {
          await ctx.telegram.sendMessage(userId, 
            '🚫 <b>Доступ ограничен</b>\n\n' +
            'Твой доступ к боту был ограничен администрацией.\n\n' +
            'Если у тебя есть вопросы, можешь обратиться к администрации.\n\n' +
            'Спасибо за понимание.',
            {
              parse_mode: 'HTML'
            }
          );
        } catch (error) {
          console.error(`Failed to send ban message to user ${userId}:`, error);
        }
        
        await ctx.editMessageText(
          `🚫 <b>Пользователь забанен</b>\n\n` +
          `${firstName} (${username}) получил роль "banned"\n\n` +
          `📨 Уведомление отправлено пользователю`,
          {
            parse_mode: 'HTML'
          }
        );
        break;

      case 'delete':
        // Delete user - CASCADE DELETE will handle all related records
        console.log(`🗑️ Starting delete process for user ${userId}`);
        
        try {
          const deletedCount = await knex('users').where('id', Number(userId)).del();
          console.log(`🗑️ Deleted ${deletedCount} user record(s)`);
          
          if (deletedCount === 0) {
            console.log(`❌ User ${userId} not found for deletion`);
            await ctx.editMessageText(
              `❌ <b>Пользователь не найден</b>\n\n` +
              `Пользователь ${firstName} (${username}) не найден в системе.`,
              {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                  [Markup.button.callback('🔙 Назад к управлению', `admin_manage_user_${userId}`)]
                ])
              }
            );
          } else {
            console.log(`✅ User ${userId} successfully deleted with CASCADE`);
            await ctx.editMessageText(
              `🗑️ <b>Пользователь удален</b>\n\n` +
              `${firstName} (${username}) полностью удален из системы\n\n` +
              `Все связанные записи удалены автоматически.`,
              {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                  [Markup.button.callback('🔙 Назад к поиску', 'admin_search_user')]
                ])
              }
            );
          }
        } catch (error) {
          console.error(`❌ Error deleting user ${userId}:`, error);
          await ctx.editMessageText(
            `❌ <b>Ошибка при удалении</b>\n\n` +
            `Не удалось удалить пользователя ${firstName} (${username}).\n\n` +
            `Ошибка: ${error.message}`,
            {
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard([
                [Markup.button.callback('🔙 Назад к управлению', `admin_manage_user_${userId}`)]
              ])
            }
          );
        }
        break;

      case 'downgrade':
        // Remove all roles (back to pending)
        await knex('userRoles').where('userId', Number(userId)).del();
        await ctx.editMessageText(
          `⬇️ <b>Статус понижен</b>\n\n` +
          `${firstName} (${username}) возвращен в статус "ожидает рассмотрения"`,
          {
            parse_mode: 'HTML'
          }
        );
        break;
    }

  } catch (error) {
    console.error(`Error performing ${action} on user:`, error);
    await ctx.editMessageText(
      `❌ <b>Ошибка при выполнении действия</b>\n\n` +
      `Техническая ошибка: ${error.message}`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад к управлению', `admin_manage_user_${userId}`)]
        ])
      }
    );
  }
});

const scrollsManagement = require('./scrollsManagement');

module.exports = Composer.compose([
  allApplicationsHandler,
  filterHandler,
  searchHandler,
  searchMessageHandler,
  changeRolesHandler,
  userManagementHandler,
  userActionHandler,
  scrollsManagement
]);