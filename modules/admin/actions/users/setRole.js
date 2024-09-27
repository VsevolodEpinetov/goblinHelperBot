const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

// Обработчики ролей
module.exports = Composer.action(/^setRole_[a-zA-Z]+_[0-9]+/g, async (ctx) => {
  const userId = ctx.callbackQuery.data.split('_')[2];
  const roleName = ctx.callbackQuery.data.split('_')[1];

  let roleText = 'no_name';

  switch (roleName) {
    case 'goblin':
      roleText = '🐸 Гоблин'
      break;
    case 'rejected':
      roleText = '❌ Отказано'
      break;
    case 'admin':
      roleText = '👑 Админ'
      break;
    case 'adminPlus':
      roleText = '👑➕ Админ плюс'
      break;
  }

  if (ctx.users.list[userId].roles.indexOf(roleName) < 0) {
    ctx.users.list[userId].roles.push(roleName)
    await ctx.replyWithHTML(`Пользователю с ID ${userId} присвоена роль ${roleText}.`);
    await ctx.telegram.sendMessage(userId, `Твоё участие подтверждено! Тебе добавлена роль ${roleText}. Теперь можешь вновь использовать /start для взаимодействия с ботом`)
    await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `ℹ️ user ${userId} got role ${roleName}`)
  } else {
    await ctx.replyWithHTML(`🤔 Пользователь с ID ${userId} уже имеет роль ${roleText}.`);
  }
});