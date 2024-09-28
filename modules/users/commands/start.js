const { Composer, Markup } = require('telegraf');
const util = require('../../util');
const SETTINGS = require('../../../settings.json');

// Команда /start
module.exports = Composer.command('start', async (ctx) => {
  util.log(ctx);

  if (ctx.message.chat.id < 0) {
    await ctx.replyWithHTML('Работаю только в личке, пупсик')
  }

  if (!ctx.members) ctx.members = {};
  if (!ctx.users.list) ctx.users.list = {};

  const userId = ctx.message.from.id;
  ctx.deleteMessage(ctx.message.message_id)

  if (util.isSuperUser(userId)) {
    await ctx.replyWithHTML(`Выбери нужное действие`, {
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('Месяцы', 'adminMonths'),
          Markup.button.callback('Месяцы Плюс', 'adminMonthsPlus')
        ],
        [
          Markup.button.callback('Кикстартеры', 'adminKickstarters'),
          Markup.button.callback('Релизы', 'adminReleases')
        ],
        [
          Markup.button.callback('Люди', 'adminParticipants')
        ]
      ])
    })
    return;
  }

  if (!ctx.users.list[userId]) {
    await ctx.replyWithHTML(
      `Привет! Ты ещё не зарегистрирован. Нажми на кнопку, чтобы подать запрос на добавление.`, {
      ...Markup.inlineKeyboard([
        Markup.button.callback('Отправить запрос', 'requestAddUser')
      ])
    }
    );
  } else {
    const userData = ctx.users.list[userId];
    const roles = userData.roles;

    if (roles.length == 0) {
      await ctx.replyWithHTML('Твоё участие ещё не было подтверждено. Ожидай')
    }

    if (roles.indexOf('rejected') > -1) {
      await ctx.replyWithHTML('К сожалению, тебе было отказано в вступлении.')
      return;
    }
    
    if (roles.indexOf('goblin') > -1) {
      const message = util.getUserMessage(ctx, userData)
      const menu = util.getUserButtons(ctx, userData);

      await ctx.replyWithHTML(message, {
        ...Markup.inlineKeyboard(menu)
      });
      return;
    }
  }
});