const { Composer, Markup } = require("telegraf");
const knex = require('../../../db/knex');
const { getUser, updateUser } = require('../../../db/helpers');
const SETTINGS = require('../../../../settings.json');

/**
 * Super User Management - Individual user management
 * Clean interface for managing individual users
 */

// Search message handler
const searchMessageHandler = Composer.on('text', async (ctx) => {
  // Only handle search if we're in search mode
  if (!ctx.session.superUserSearchMode) {
    return;
  }
  
  console.log('🎯 Super user search message handler triggered!');
  
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

      const rolesByUser = {};
      for (const role of roles) {
        if (!rolesByUser[role.userId]) {
          rolesByUser[role.userId] = [];
        }
        rolesByUser[role.userId].push(role.role);
      }

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
            [Markup.button.callback('🔙 Назад к поиску', 'super_user_search')]
          ])
        }
      );
      ctx.session.superUserSearchMode = false;
      return;
    }

    let message = `🔍 <b>Результаты поиска: "${searchQuery}"</b>\n\n`;
    message += `Найдено: <b>${users.length}</b> пользователей\n\n`;

    const keyboard = [];

    for (const user of users) {
      const firstName = user.firstName || 'Unknown';
      const lastName = user.lastName || '';
      const username = user.username ? `@${user.username}` : 'No username';
      
      // Get highest priority status emoji
      const statusEmoji = getHighestStatusEmoji(user.roles);
      const rolesText = user.roles.length > 0 ? user.roles.join(', ') : 'нет ролей';
      
      message += `${statusEmoji} <b>${firstName} ${lastName}</b> (${username})\n`;
      message += `ID: <code>${user.id}</code> | ${rolesText}\n\n`;

      keyboard.push([
        Markup.button.callback(`👤 ${firstName}`, `super_manage_user_${user.id}`)
      ]);
    }

    keyboard.push([
      Markup.button.callback('🔙 Назад к поиску', 'super_user_search')
    ]);

    await ctx.reply(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });

    // Clear search mode
    ctx.session.superUserSearchMode = false;

  } catch (error) {
    console.error('Error in super user search:', error);
    await ctx.reply(
      '❌ <b>Ошибка при поиске</b>\n\n' +
      `Техническая ошибка: ${error.message}`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад к поиску', 'super_user_search')]
        ])
      }
    );
    ctx.session.superUserSearchMode = false;
  }
});

// Individual user management handler
const userManagementHandler = Composer.action(/^super_manage_user_(\d+)$/g, async (ctx) => {
  const userId = ctx.callbackQuery.data.split('_')[3];
  console.log('🎯 super_manage_user action triggered!');
  console.log('🎯 User ID to manage:', userId);
  
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
            [Markup.button.callback('🔙 Назад', 'super_users_menu')]
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
    
    const firstName = processedUser.firstName || 'Unknown';
    const lastName = processedUser.lastName || '';
    const username = processedUser.username ? `@${processedUser.username}` : 'No username';
    
    // Check if user is approved
    const isApproved = processedUser.roles.some(role => ['goblin', 'admin', 'adminPlus', 'super'].includes(role));
    
    if (isApproved) {
      // Show approved user interface
      await showApprovedUserInterface(ctx, processedUser, firstName, lastName, username);
    } else {
      // Show non-approved user interface
      await showNonApprovedUserInterface(ctx, processedUser, firstName, lastName, username);
    }

  } catch (error) {
    console.error('Error managing user:', error);
    await ctx.editMessageText(
      '❌ <b>Ошибка при загрузке пользователя</b>\n\n' +
      `Техническая ошибка: ${error.message}`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'super_users_menu')]
        ])
      }
    );
  }
});

// Show interface for non-approved users
async function showNonApprovedUserInterface(ctx, processedUser, firstName, lastName, username) {
  const statusEmoji = getHighestStatusEmoji(processedUser.roles);
  const rolesText = processedUser.roles.length > 0 ? processedUser.roles.join(', ') : 'нет ролей';
  
  let statusText = 'Ожидает рассмотрения';
  if (processedUser.roles.includes('prereg')) {
    statusText = 'Предварительная регистрация';
  } else if (processedUser.roles.includes('preapproved')) {
    statusText = 'Предварительно одобрен';
  } else if (processedUser.roles.includes('rejected')) {
    statusText = 'Отклонен';
  }

  const message = `👤 <b>Управление пользователем</b>\n\n` +
                 `${statusEmoji} <b>${firstName} ${lastName}</b> (${username})\n` +
                 `ID: <code>${processedUser.id}</code>\n` +
                 `Статус: ${statusText}\n` +
                 `Роли: ${rolesText}\n\n` +
                 `Выберите действие:`;

  const keyboard = [];

  // Action buttons for non-approved users
  if (processedUser.roles.includes('rejected')) {
    keyboard.push([
      Markup.button.callback('✅ Одобрить', `super_approve_user_${processedUser.id}`),
      Markup.button.callback('⭐ Супер одобрить', `super_super_approve_user_${processedUser.id}`)
    ]);
  } else {
    keyboard.push([
      Markup.button.callback('✅ Одобрить', `super_approve_user_${processedUser.id}`),
      Markup.button.callback('⭐ Супер одобрить', `super_super_approve_user_${processedUser.id}`)
    ]);
  }

  keyboard.push([
    Markup.button.callback('🚫 Забанить', `super_ban_user_${processedUser.id}`)
  ]);

  keyboard.push([
    Markup.button.callback('🔙 Назад', 'super_users_menu')
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(keyboard)
  });
}

// Show interface for approved users
async function showApprovedUserInterface(ctx, processedUser, firstName, lastName, username) {
  const rolesText = processedUser.roles.length > 0 ? processedUser.roles.join(', ') : 'нет ролей';
  
  // Get user stats from database
  const userStats = await getUserStats(processedUser.id);
  
  const message = `👤 <b>Управление пользователем</b>\n\n` +
                 `🎉 <b>${firstName} ${lastName}</b> (${username})\n` +
                 `ID: <code>${processedUser.id}</code>\n` +
                 `Статус: Полностью одобрен\n` +
                 `Роли: ${rolesText}\n\n` +
                 `📊 <b>Статистика:</b>\n` +
                 `📅 Месяцы: ${userStats.months}\n` +
                 `🚀 Кикстартеры: ${userStats.kickstarters}\n` +
                 `💰 Баланс: ${userStats.balance}₽\n` +
                 `📜 Свитки: ${userStats.scrolls}\n\n` +
                 `Выберите действие:`;

  const keyboard = [
    [
      Markup.button.callback('📅 Месяцы', `super_user_months_${processedUser.id}`),
      Markup.button.callback('🚀 Кикстартеры', `super_user_kickstarters_${processedUser.id}`)
    ],
    [
      Markup.button.callback('💳 Платежи', `super_user_payments_${processedUser.id}`),
      Markup.button.callback('👤 Роли', `super_user_roles_${processedUser.id}`)
    ],
    [
      Markup.button.callback('⭐ XP', `super_user_xp_${processedUser.id}`),
      Markup.button.callback('🏆 Достижения', `super_user_achievements_${processedUser.id}`)
    ],
    [
      Markup.button.callback('🔙 Назад', 'super_users_menu')
    ]
  ];

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(keyboard)
  });
}

// User action handlers
const userActionHandler = Composer.action(/^super_(approve|super_approve|ban)_user_(\d+)$/g, async (ctx) => {
  const matches = ctx.callbackQuery.data.match(/^super_(approve|super_approve|ban)_user_(\d+)$/);
  const action = matches[1];
  const userId = matches[2];
  
  console.log('🎯 Super user action triggered:', action, 'for user:', userId);
  
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    let message = '';
    let logMessage = '';

    switch (action) {
      case 'approve':
        // Remove all existing roles and add goblin
        await knex('userRoles').where('userId', userId).del();
        await knex('userRoles').insert({ userId, role: 'goblin' });
        message = `✅ Пользователь ${userId} успешно одобрен`;
        logMessage = `✅ ${ctx.from.id} APPROVED user ${userId}`;
        break;

      case 'super_approve':
        // Remove all existing roles and add goblin
        await knex('userRoles').where('userId', userId).del();
        await knex('userRoles').insert({ userId, role: 'goblin' });
        message = `⭐ Пользователь ${userId} супер одобрен`;
        logMessage = `⭐ ${ctx.from.id} SUPER APPROVED user ${userId}`;
        break;

      case 'ban':
        // Remove all existing roles and add banned
        await knex('userRoles').where('userId', userId).del();
        await knex('userRoles').insert({ userId, role: 'banned' });
        message = `🚫 Пользователь ${userId} заблокирован`;
        logMessage = `🚫 ${ctx.from.id} BANNED user ${userId}`;
        break;
    }

    // Send log message
    await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, logMessage);

    await ctx.editMessageText(
      `${message}\n\nВыберите действие:`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('👤 Управление пользователем', `super_manage_user_${userId}`)],
          [Markup.button.callback('🔙 Назад к пользователям', 'super_users_menu')]
        ])
      }
    );

  } catch (error) {
    console.error(`Error performing ${action} on user:`, error);
    await ctx.editMessageText(
      `❌ <b>Ошибка при выполнении действия</b>\n\n` +
      `Техническая ошибка: ${error.message}`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', `super_manage_user_${userId}`)]
        ])
      }
    );
  }
});

// Helper functions
function getHighestStatusEmoji(roles) {
  if (!roles || roles.length === 0) {
    return '⏳';
  }
  
  // Priority order (highest to lowest)
  if (roles.includes('super')) return '👑';
  if (roles.includes('adminPlus')) return '🔥';
  if (roles.includes('admin')) return '⚡';
  if (roles.includes('goblin')) return '🎉';
  if (roles.includes('banned')) return '🚫';
  if (roles.includes('rejected')) return '❌';
  if (roles.includes('preapproved')) return '✅';
  if (roles.includes('pending')) return '⏳';
  if (roles.includes('prereg')) return '📝';
  
  return '🔍';
}

async function getUserStats(userId) {
  try {
    const userData = await getUser(userId);
    if (!userData) {
      return { months: 0, kickstarters: 0, balance: 0, scrolls: 0 };
    }

    const months = userData.purchases.groups.regular.length + userData.purchases.groups.plus.length;
    const kickstarters = userData.purchases.kickstarters.length;
    const balance = userData.purchases.balance || 0;
    const scrolls = Math.floor(userData.purchases.groups.plus.length / 3) * 2 - userData.purchases.scrollsSpent;

    return { months, kickstarters, balance, scrolls };
  } catch (error) {
    console.error('Error getting user stats:', error);
    return { months: 0, kickstarters: 0, balance: 0, scrolls: 0 };
  }
}

// Role management handler
const roleManagementHandler = Composer.action(/^super_user_roles_(\d+)$/g, async (ctx) => {
  const userId = ctx.callbackQuery.data.split('_')[3];
  console.log('🎯 super_user_roles action triggered for user:', userId);
  
  try { await ctx.answerCbQuery(); } catch {}
  
  // Set the user ID in session for the scene
  ctx.userSession = { userId: userId };
  
  // Enter the change roles scene
  await ctx.scene.enter('ADMIN_SCENE_CHANGE_USER_ROLES');
});

// Placeholder handlers for other approved user actions
const approvedUserActionsHandler = Composer.compose([
  Composer.action(/^super_user_months_(\d+)$/g, async (ctx) => {
    const userId = ctx.callbackQuery.data.split('_')[3];
    try { await ctx.answerCbQuery(); } catch {}
    await ctx.editMessageText(
      '📅 <b>Управление месяцами</b>\n\nФункция в разработке...',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', `super_manage_user_${userId}`)]
        ])
      }
    );
  }),
  
  Composer.action(/^super_user_kickstarters_(\d+)$/g, async (ctx) => {
    const userId = ctx.callbackQuery.data.split('_')[3];
    try { await ctx.answerCbQuery(); } catch {}
    await ctx.editMessageText(
      '🚀 <b>Управление кикстартерами</b>\n\nФункция в разработке...',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', `super_manage_user_${userId}`)]
        ])
      }
    );
  }),
  
  Composer.action(/^super_user_payments_(\d+)$/g, async (ctx) => {
    const userId = ctx.callbackQuery.data.split('_')[3];
    try { await ctx.answerCbQuery(); } catch {}
    await ctx.editMessageText(
      '💳 <b>Управление платежами</b>\n\nФункция в разработке...',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', `super_manage_user_${userId}`)]
        ])
      }
    );
  }),
  
  Composer.action(/^super_user_xp_(\d+)$/g, async (ctx) => {
    const userId = ctx.callbackQuery.data.split('_')[3];
    try { await ctx.answerCbQuery(); } catch {}
    await ctx.editMessageText(
      '⭐ <b>Управление XP</b>\n\nФункция в разработке...',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', `super_manage_user_${userId}`)]
        ])
      }
    );
  }),
  
  Composer.action(/^super_user_achievements_(\d+)$/g, async (ctx) => {
    const userId = ctx.callbackQuery.data.split('_')[3];
    try { await ctx.answerCbQuery(); } catch {}
    await ctx.editMessageText(
      '🏆 <b>Управление достижениями</b>\n\nФункция в разработке...',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', `super_manage_user_${userId}`)]
        ])
      }
    );
  })
]);

module.exports = Composer.compose([
  searchMessageHandler,
  userManagementHandler,
  userActionHandler,
  roleManagementHandler,
  approvedUserActionsHandler
]);
