const { Composer, Markup } = require("telegraf");
const knex = require('../../../db/knex');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action(/^adminFindNonPayers_/, async (ctx) => {
  const userId = ctx.callbackQuery.from.id;
  const callbackData = ctx.callbackQuery.data;

  if (userId != SETTINGS.CHATS.EPINETOV && userId != SETTINGS.CHATS.GLAVGOBLIN) {
    return;
  }

  try {
    await ctx.answerCbQuery();

    // Parse year and month from callback data (format: adminFindNonPayers_2025_10)
    const parts = callbackData.split('_');
    if (parts.length < 3) {
      await ctx.reply('Ошибка: неверный формат данных');
      return;
    }

    const year = parts[1];
    const month = parts[2];
    const period = `${year}_${month}`;

    // Get all users with role 'goblin'
    const goblinUsers = await knex('userRoles')
      .where('role', 'goblin')
      .select('userId');

    if (goblinUsers.length === 0) {
      await ctx.reply(`Не найдено пользователей с ролью 'goblin' для периода ${year}-${month}`);
      return;
    }

    const goblinUserIds = goblinUsers.map(u => u.userId);

    // Get all users with admin or adminPlus roles to exclude them
    const adminUsers = await knex('userRoles')
      .whereIn('role', ['admin', 'adminPlus'])
      .select('userId');

    const adminUserIds = new Set(adminUsers.map(u => u.userId));

    // Filter out admin users
    const eligibleUserIds = goblinUserIds.filter(id => !adminUserIds.has(id));

    if (eligibleUserIds.length === 0) {
      await ctx.reply(`Все пользователи с ролью 'goblin' имеют роли admin или adminPlus для периода ${year}-${month}`);
      return;
    }

    // Get all users who paid for this period (either regular or plus)
    const paidUsers = await knex('userGroups')
      .where('period', period)
      .whereIn('userId', eligibleUserIds)
      .select('userId')
      .distinct();

    const paidUserIds = new Set(paidUsers.map(u => u.userId));

    // Find non-payers
    const nonPayersIds = eligibleUserIds.filter(id => !paidUserIds.has(id));

    if (nonPayersIds.length === 0) {
      await ctx.reply(`✅ Все пользователи с ролью 'goblin' (без admin/adminPlus) оплатили период ${year}-${month}`);
      return;
    }

    // Get user details for non-payers
    const nonPayers = await knex('users')
      .whereIn('id', nonPayersIds)
      .select('id', 'username', 'firstName', 'lastName')
      .orderBy('id', 'asc');

    // Format the message
    let message = `📋 <b>Неплательщики за ${year}-${month}</b>\n\n`;
    message += `Всего неплательщиков: <b>${nonPayers.length}</b>\n\n`;

    // Telegram message limit is 4096 characters, so we'll limit the list
    const maxUsers = 100;
    const usersToShow = nonPayers.slice(0, maxUsers);

    for (const user of usersToShow) {
      const username = user.username ? `@${user.username}` : 'нет username';
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Без имени';
      message += `• ${name} (${username}) - ID: ${user.id}\n`;
    }

    if (nonPayers.length > maxUsers) {
      message += `\n... и еще ${nonPayers.length - maxUsers} пользователей`;
    }

    // Send the message
    await ctx.reply(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('← Назад', `adminMonths_show_${year}_${month}`)
        ]
      ])
    });

  } catch (error) {
    console.error('Error finding non-payers:', error);
    await ctx.reply(`Ошибка при поиске неплательщиков: ${error.message}`);
  }
});

