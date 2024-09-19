const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const SETTINGS = require('../../../settings.json');

module.exports = Composer.action('requestAddUser', async (ctx) => {
  const userId = ctx.callbackQuery.from.id;

  ctx.members.list[userId] = {
    id: userId,
    username: ctx.callbackQuery.from.username || ctx.callbackQuery.from.first_name,
    first_name: ctx.callbackQuery.from.first_name,
    last_name: ctx.callbackQuery.from.last_name || '',
    dateAdded: new Date().toISOString(),
    roles: []
  };

  await ctx.telegram.sendMessage(
    SETTINGS.CHATS.EPINETOV,
    `<b>Новый запрос на добавление:</b>\n` +
    `<b>ID:</b> ${userId}\n` +
    `<b>Имя:</b> ${ctx.callbackQuery.from.first_name}\n` +
    `<b>Фамилия:</b> ${ctx.callbackQuery.from.last_name || 'нет'}\n` +
    `<b>Username:</b> ${ctx.callbackQuery.from.username || 'нет'}\n` +
    `<b>Дата:</b> ${new Date().toLocaleString()}`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('🐸 Гоблин', `setRoleGoblin_${userId}`),
          Markup.button.callback('❌ Отказать', `setRoleRejected_${userId}`)
        ],
        [
          Markup.button.callback('👑 Админ', `setRoleAdmin_${userId}`),
          Markup.button.callback('👑➕ Админ плюс', `setRoleAdminPlus_${userId}`)
        ],
        [
          Markup.button.callback('Закончить', `deleteThisMessage`)
        ]
      ])
    }
  );

  await ctx.replyWithHTML('Запрос на подтверждение отправлен. Придётся подождать :)');
});