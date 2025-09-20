const { Composer, Markup } = require("telegraf");
const knex = require('../../../db/knex');

/**
 * Super Users Management Menu
 * Clean interface for managing users with proper statistics
 */

// Main users management menu
const superUsersMenuHandler = Composer.action('super_users_menu', async (ctx) => {
  console.log('🎯 super_users_menu action triggered!');
  
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    // Get user statistics
    const stats = await getUserStatistics();
    
    const message = `👥 <b>Управление пользователями</b>\n\n` +
                   `📊 <b>Статистика:</b>\n` +
                   `👤 Всего пользователей: <b>${stats.total}</b>\n` +
                   `⏳ Ожидают рассмотрения: <b>${stats.pending}</b>\n` +
                   `✅ Одобрены: <b>${stats.approved}</b>\n` +
                   `❌ Отклонены: <b>${stats.rejected}</b>\n` +
                   `🚫 Заблокированы: <b>${stats.banned}</b>\n\n` +
                   `Выберите действие:`;

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('📝 Новые заявки', 'super_new_requests'),
          Markup.button.callback('📊 Статистика', 'super_user_stats')
        ],
        [
          Markup.button.callback('🔍 Поиск', 'super_user_search')
        ],
        [
          Markup.button.callback('🔙 Назад', 'adminMenu')
        ]
      ])
    });

  } catch (error) {
    console.error('Error in super users menu:', error);
    await ctx.editMessageText(
      '❌ <b>Ошибка при загрузке меню</b>\n\n' +
      `Техническая ошибка: ${error.message}`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'adminMenu')]
        ])
      }
    );
  }
});

// New requests handler
const newRequestsHandler = Composer.action('super_new_requests', async (ctx) => {
  console.log('🎯 super_new_requests action triggered!');
  
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    // Get pending users
    const users = await knex('users')
      .select('id', 'username', 'firstName', 'lastName')
      .orderBy('id', 'desc')
      .limit(20);

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

    const usersWithRoles = users.map(user => ({
      ...user,
      roles: rolesByUser[user.id] || []
    }));

    // Filter pending users
    const pendingUsers = usersWithRoles.filter(user => 
      !user.roles.length || 
      user.roles.includes('pending') || 
      user.roles.includes('prereg') ||
      user.roles.includes('preapproved')
    );

    let message = `📝 <b>Новые заявки</b>\n\n`;
    
    if (pendingUsers.length === 0) {
      message += `✅ Нет новых заявок\n\n`;
    } else {
      message += `Найдено заявок: <b>${pendingUsers.length}</b>\n\n`;
      
      // Show first 5 users
      const displayUsers = pendingUsers.slice(0, 5);
      for (const user of displayUsers) {
        const statusEmoji = getStatusEmoji(user.roles);
        const firstName = user.firstName || 'Unknown';
        const lastName = user.lastName || '';
        const username = user.username ? `@${user.username}` : 'No username';
        
        message += `${statusEmoji} <b>${firstName} ${lastName}</b> (${username})\n`;
        message += `ID: <code>${user.id}</code>\n\n`;
      }
      
      if (pendingUsers.length > 5) {
        message += `... и ещё ${pendingUsers.length - 5} заявок\n\n`;
      }
    }

    const keyboard = [];
    
    // Add user buttons
    for (const user of pendingUsers.slice(0, 8)) {
      const firstName = user.firstName || 'Unknown';
      keyboard.push([
        Markup.button.callback(`👤 ${firstName}`, `super_manage_user_${user.id}`)
      ]);
    }

    keyboard.push([
      Markup.button.callback('🔙 Назад', 'super_users_menu')
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });

  } catch (error) {
    console.error('Error in new requests:', error);
    await ctx.editMessageText(
      '❌ <b>Ошибка при загрузке заявок</b>\n\n' +
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

// User search handler
const userSearchHandler = Composer.action('super_user_search', async (ctx) => {
  console.log('🎯 super_user_search action triggered!');
  
  try { await ctx.answerCbQuery(); } catch {}
  
  await ctx.editMessageText(
    `🔍 <b>Поиск пользователя</b>\n\n` +
    `Отправьте ID пользователя или username (с @ или без):\n\n` +
    `<i>Например: 123456789 или @username</i>`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'super_users_menu')]
      ])
    }
  );
  
  // Set search mode flag
  ctx.session.superUserSearchMode = true;
});

// User statistics handler
const userStatsHandler = Composer.action('super_user_stats', async (ctx) => {
  console.log('🎯 super_user_stats action triggered!');
  
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    const stats = await getUserStatistics();
    
    // Get additional detailed stats
    const detailedStats = await getDetailedUserStatistics();
    
    const message = `📊 <b>Детальная статистика пользователей</b>\n\n` +
                   `👤 <b>Всего пользователей:</b> ${stats.total}\n\n` +
                   `📝 <b>По статусам:</b>\n` +
                   `⏳ Ожидают рассмотрения: ${stats.pending}\n` +
                   `✅ Одобрены: ${stats.approved}\n` +
                   `❌ Отклонены: ${stats.rejected}\n` +
                   `🚫 Заблокированы: ${stats.banned}\n\n` +
                   `👑 <b>По ролям:</b>\n` +
                   `🎉 Гоблины: ${detailedStats.goblins}\n` +
                   `⚡ Админы: ${detailedStats.admins}\n` +
                   `🔥 Админ+: ${detailedStats.adminPlus}\n` +
                   `👑 Супер админы: ${detailedStats.supers}\n` +
                   `🗳️ Админы голосований: ${detailedStats.pollsAdmins}`;

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', 'super_users_menu')]
      ])
    });

  } catch (error) {
    console.error('Error in user stats:', error);
    await ctx.editMessageText(
      '❌ <b>Ошибка при загрузке статистики</b>\n\n' +
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

// Helper functions
async function getUserStatistics() {
  const users = await knex('users').select('id');
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

  const usersWithRoles = users.map(user => ({
    ...user,
    roles: rolesByUser[user.id] || []
  }));

  const stats = {
    total: usersWithRoles.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    banned: 0
  };

  for (const user of usersWithRoles) {
    if (!user.roles.length || user.roles.includes('pending') || user.roles.includes('prereg')) {
      stats.pending++;
    } else if (user.roles.includes('rejected')) {
      stats.rejected++;
    } else if (user.roles.includes('banned')) {
      stats.banned++;
    } else if (user.roles.some(role => ['goblin', 'admin', 'adminPlus', 'super'].includes(role))) {
      stats.approved++;
    }
  }

  return stats;
}

async function getDetailedUserStatistics() {
  const roleStats = await knex('userRoles')
    .select('role')
    .count('* as count')
    .groupBy('role');

  const stats = {
    goblins: 0,
    admins: 0,
    adminPlus: 0,
    supers: 0,
    pollsAdmins: 0
  };

  for (const stat of roleStats) {
    switch (stat.role) {
      case 'goblin':
        stats.goblins = parseInt(stat.count);
        break;
      case 'admin':
        stats.admins = parseInt(stat.count);
        break;
      case 'adminPlus':
        stats.adminPlus = parseInt(stat.count);
        break;
      case 'super':
        stats.supers = parseInt(stat.count);
        break;
      case 'adminPolls':
      case 'polls':
        stats.pollsAdmins += parseInt(stat.count);
        break;
    }
  }

  return stats;
}

function getStatusEmoji(roles) {
  if (!roles || roles.length === 0) {
    return '⏳';
  }
  
  if (roles.includes('prereg')) {
    return '📝';
  } else if (roles.includes('pending')) {
    return '⏳';
  } else if (roles.includes('preapproved')) {
    return '✅';
  } else if (roles.includes('rejected')) {
    return '❌';
  } else if (roles.includes('banned')) {
    return '🚫';
  } else if (roles.some(role => ['goblin', 'admin', 'adminPlus', 'super'].includes(role))) {
    return '🎉';
  } else {
    return '🔍';
  }
}

module.exports = Composer.compose([
  superUsersMenuHandler,
  newRequestsHandler,
  userSearchHandler,
  userStatsHandler
]);
