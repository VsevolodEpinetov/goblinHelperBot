const { Composer, Markup } = require('telegraf');
const { getUser } = require('../../db/helpers');
const knex = require('../../db/knex');
const SETTINGS = require('../../../settings.json');
const { logDenied, logAdmin } = require('../../util/logger');

// Check if user is authorized admin
function isAuthorizedAdmin(userId) {
  return userId.toString() === SETTINGS.CHATS.EPINETOV || userId.toString() === SETTINGS.CHATS.GLAVGOBLIN;
}

// Fixed admin months action
const adminMonthsAction = Composer.action(/^adminMonths$/g, async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  if (!isAuthorizedAdmin(ctx.from.id)) {
    logDenied(ctx.from.id, ctx.from.username, 'adminMonths', 'unauthorized');
    return;
  }
  
  try {
    // Get available months from database instead of session
    const months = await knex('months')
      .select('period', 'type', 'chatId')
      .orderBy('period', 'desc');
    
    // Group by year
    const yearGroups = {};
    months.forEach(month => {
      const [year] = month.period.split('_');
      if (!yearGroups[year]) yearGroups[year] = [];
      yearGroups[year].push(month);
    });
    
    const years = Object.keys(yearGroups).sort().reverse();
    
    let message = `📅 <b>Управление месяцами</b>\n\n`;
    message += `📊 <b>Доступные года:</b> ${years.length}\n`;
    message += `📊 <b>Всего месяцев:</b> ${months.length}\n\n`;
    message += `Выберите год для управления:`;
    
    const keyboard = [];
    const yearButtons = years.map(year => 
      Markup.button.callback(`${year} (${yearGroups[year].length})`, `adminMonths_${year}`)
    );
    
    // Split into rows of 3
    for (let i = 0; i < yearButtons.length; i += 3) {
      keyboard.push(yearButtons.slice(i, i + 3));
    }
    
    keyboard.push([Markup.button.callback('🔙 Назад', 'adminMenu')]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });
    
  } catch (error) {
    console.error('❌ Error in adminMonths:', error);
    await ctx.editMessageText('❌ Ошибка загрузки месяцев', {
      ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'adminMenu')]])
    });
  }
});

// Fixed admin participants action
const adminParticipantsAction = Composer.action('adminParticipants', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  if (!isAuthorizedAdmin(ctx.from.id)) {
    logDenied(ctx.from.id, ctx.from.username, 'adminParticipants', 'unauthorized');
    return;
  }
  
  try {
    // Get user statistics from database
    const totalUsers = await knex('users').count('* as count').first();
    const goblinUsers = await knex('userRoles').where('role', 'goblin').count('* as count').first();
    const adminUsers = await knex('userRoles').whereIn('role', ['admin', 'adminPlus', 'super']).count('* as count').first();
    
    let message = `👥 <b>Управление участниками</b>\n\n`;
    message += `📊 <b>Статистика:</b>\n`;
    message += `• Всего пользователей: ${totalUsers.count}\n`;
    message += `• Гоблины: ${goblinUsers.count}\n`;
    message += `• Админы: ${adminUsers.count}\n\n`;
    message += `Выберите действие:`;
    
    const keyboard = [
      [
        Markup.button.callback('📋 Все заявки', 'adminAllApplications'),
        Markup.button.callback('🔍 Поиск', 'admin_search_user')
      ],
      [
        Markup.button.callback('👑 Управление ролями', 'adminRoleManagement'),
        Markup.button.callback('📊 Статистика', 'adminUserStats')
      ],
      [
        Markup.button.callback('🔙 Назад', 'adminMenu')
      ]
    ];
    
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });
    
  } catch (error) {
    console.error('❌ Error in adminParticipants:', error);
    await ctx.editMessageText('❌ Ошибка загрузки участников', {
      ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'adminMenu')]])
    });
  }
});

module.exports = Composer.compose([
  adminMonthsAction,
  adminParticipantsAction
]);
