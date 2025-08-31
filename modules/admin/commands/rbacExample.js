const { Composer, Markup } = require('telegraf');
const { t } = require('../../i18n');
const { 
  requirePermission, 
  requireAdmin, 
  requireSuperAdmin,
  hasPermission,
  getUserPermissions,
  getRoleHierarchy,
  promoteToAdmin,
  demoteAdmin
} = require('../../rbac');

/**
 * Example command demonstrating RBAC usage
 * This shows how to use different permission levels and role management
 */
const rbacExample = new Composer();

// Basic permission check - only users with user management permission
rbacExample.command('rbac_example', 
  requirePermission('admin:users:view', '❌ У вас нет прав для просмотра пользователей'),
  async (ctx) => {
    try {
      const userId = ctx.from.id;
      
      // Get user permissions
      const userData = await require('../../db/helpers').getUser(userId);
      const permissions = getUserPermissions(userData.roles);
      
      const message = `🔐 <b>RBAC Пример</b>\n\n` +
        `👤 <b>Пользователь:</b> ${ctx.from.first_name}\n` +
        `🆔 <b>ID:</b> <code>${userId}</code>\n` +
        `👑 <b>Роли:</b> ${userData.roles.join(', ')}\n\n` +
        `📋 <b>Доступные действия:</b>\n` +
        `• Управление пользователями: ${permissions['admin:users:view'] ? '✅' : '❌'}\n` +
        `• Управление контентом: ${permissions['admin:content:months:manage'] ? '✅' : '❌'}\n` +
        `• Управление опросами: ${permissions['admin:polls:create'] ? '✅' : '❌'}\n` +
        `• Супер-админ: ${permissions['admin:super:roles:manage'] ? '✅' : '❌'}`;
      
      await ctx.replyWithHTML(message, {
        ...Markup.inlineKeyboard([
          [Markup.button.callback('👥 Управление ролями', 'rbac_roles')],
          [Markup.button.callback('🔐 Проверить права', 'rbac_check')],
          [Markup.button.callback('📊 Иерархия ролей', 'rbac_hierarchy')]
        ])
      });
    } catch (error) {
      console.error('RBAC example error:', error);
      await ctx.reply('❌ Произошла ошибка при выполнении команды');
    }
  }
);

// Action to show role management options
rbacExample.action('rbac_roles', 
  requireAdmin('❌ Требуются права администратора'),
  async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const message = `👑 <b>Управление ролями</b>\n\n` +
        `Выберите действие для управления ролями пользователей:`;
      
      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('➕ Добавить роль', 'rbac_add_role')],
          [Markup.button.callback('➖ Убрать роль', 'rbac_remove_role')],
          [Markup.button.callback('👤 Продвинуть в админы', 'rbac_promote')],
          [Markup.button.callback('⬅️ Назад', 'rbac_example')]
        ])
      });
    } catch (error) {
      console.error('RBAC roles action error:', error);
      await ctx.reply('❌ Произошла ошибка');
    }
  }
);

// Action to check specific permissions
rbacExample.action('rbac_check', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    const userData = await require('../../db/helpers').getUser(userId);
    
    const message = `🔐 <b>Проверка прав доступа</b>\n\n` +
      `👤 <b>Пользователь:</b> ${ctx.from.first_name}\n` +
      `👑 <b>Роли:</b> ${userData.roles.join(', ')}\n\n` +
      `📋 <b>Проверка конкретных прав:</b>\n` +
      `• admin:users:view: ${hasPermission(userData.roles, 'admin:users:view') ? '✅' : '❌'}\n` +
      `• admin:content:months:manage: ${hasPermission(userData.roles, 'admin:content:months:manage') ? '✅' : '❌'}\n` +
      `• admin:polls:create: ${hasPermission(userData.roles, 'admin:polls:create') ? '✅' : '❌'}\n` +
      `• admin:super:roles:manage: ${hasPermission(userData.roles, 'admin:super:roles:manage') ? '✅' : '❌'}`;
    
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Назад', 'rbac_roles')]
      ])
    });
  } catch (error) {
    console.error('RBAC check action error:', error);
    await ctx.reply('❌ Произошла ошибка');
  }
});

// Action to show role hierarchy
rbacExample.action('rbac_hierarchy', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    
    const hierarchy = getRoleHierarchy();
    let message = `📊 <b>Иерархия ролей</b>\n\n`;
    
    Object.entries(hierarchy).forEach(([role, info]) => {
      message += `👑 <b>${role}</b> (уровень ${info.level})\n` +
        `📝 ${info.description}\n` +
        `🔄 Наследует: ${info.inherits.length > 0 ? info.inherits.join(', ') : 'ничего'}\n\n`;
    });
    
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Назад', 'rbac_roles')]
      ])
    });
  } catch (error) {
    console.error('RBAC hierarchy action error:', error);
    await ctx.reply('❌ Произошла ошибка');
  }
});

// Action to promote user to admin (requires super admin)
rbacExample.action('rbac_promote', 
  requireSuperAdmin('❌ Требуются права супер-администратора'),
  async (ctx) => {
    try {
      await ctx.answerCbQuery();
      
      const message = `👑 <b>Продвижение в админы</b>\n\n` +
        `Эта функция доступна только супер-администраторам.\n\n` +
        `Для продвижения пользователя используйте команду:\n` +
        `<code>/promote_user &lt;user_id&gt; &lt;admin_type&gt;</code>\n\n` +
        `Типы админов:\n` +
        `• admin - обычный администратор\n` +
        `• adminPlus - расширенный администратор\n` +
        `• super - супер-администратор`;
      
      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Назад', 'rbac_roles')]
        ])
      });
    } catch (error) {
      console.error('RBAC promote action error:', error);
      await ctx.reply('❌ Произошла ошибка');
    }
  }
);

// Back action
rbacExample.action('rbac_example', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    const userData = await require('../../db/helpers').getUser(userId);
    const permissions = getUserPermissions(userData.roles);
    
    const message = `🔐 <b>RBAC Пример</b>\n\n` +
      `👤 <b>Пользователь:</b> ${ctx.from.first_name}\n` +
      `🆔 <b>ID:</b> <code>${userId}</code>\n` +
      `👑 <b>Роли:</b> ${userData.roles.join(', ')}\n\n` +
      `📋 <b>Доступные действия:</b>\n` +
      `• Управление пользователями: ${permissions['admin:users:view'] ? '✅' : '❌'}\n` +
      `• Управление контентом: ${permissions['admin:content:months:manage'] ? '✅' : '❌'}\n` +
      `• Управление опросами: ${permissions['admin:polls:create'] ? '✅' : '❌'}\n` +
      `• Супер-админ: ${permissions['admin:super:roles:manage'] ? '✅' : '❌'}`;
    
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('👥 Управление ролями', 'rbac_roles')],
        [Markup.button.callback('🔐 Проверить права', 'rbac_check')],
        [Markup.button.callback('📊 Иерархия ролей', 'rbac_hierarchy')]
      ])
    });
  } catch (error) {
    console.error('RBAC back action error:', error);
    await ctx.reply('❌ Произошла ошибка');
  }
});

module.exports = rbacExample;
