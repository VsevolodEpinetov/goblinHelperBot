const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const SETTINGS = require('../../../settings.json');

module.exports = Composer.action('requestAddUser', async (ctx) => {
  const userId = ctx.callbackQuery.from.id;
  const toRemove = ctx.callbackQuery.message.message_id;

  ctx.users.list[userId] = {
    id: userId,
    username: ctx.callbackQuery.from.username || 'not_set',
    first_name: ctx.callbackQuery.from.first_name,
    last_name: ctx.callbackQuery.from.last_name || '',
    dateAdded: new Date().toISOString(),
    roles: [],
    purchases: {
      kickstarters: [],
      groups: {
        regular: [],
        plus: [],
        special: []
      },
      collections: [],
      balance: 0,
      releases: {},
      ticketsSpent: 0
    }
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
          Markup.button.callback('🐸 Гоблин', `setRole_goblin_${userId}`),
          Markup.button.callback('❌ Отказать', `setRole_rejected_${userId}`)
        ],
        [
          Markup.button.callback('👑 Админ', `setRole_admin_${userId}`),
          Markup.button.callback('👑➕ Админ плюс', `setRole_adminPlus_${userId}`)
        ],
        [
          Markup.button.callback('Закончить', `deleteThisMessage`)
        ]
      ])
    }
  );

  await ctx.deleteMessage(toRemove);
  await ctx.replyWithHTML('Запрос на подтверждение отправлен. Придётся подождать :)');
});