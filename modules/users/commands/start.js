const { Composer, Markup } = require('telegraf');
const util = require('../../util');
const SETTINGS = require('../../../settings.json');

// Команда /start
module.exports = Composer.command('start', async (ctx) => {
  util.log(ctx);

  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) {
    return;
  }

  if (!ctx.members) ctx.members = {};
  if (!ctx.members.list) ctx.members.list = {};

  const userId = ctx.message.from.id;
  ctx.deleteMessage(ctx.message.message_id)

  if (userId == SETTINGS.CHATS.EPINETOV) {
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

  if (!ctx.members.list[userId]) {
    await ctx.replyWithHTML(
      `Привет! Ты ещё не зарегистрирован. Нажми на кнопку, чтобы подать запрос на добавление.`, {
      ...Markup.inlineKeyboard([
        Markup.button.callback('Отправить запрос', 'requestAddUser')
      ])
    }
    );
  } else {
    // Если пользователь есть, показываем меню
    await ctx.replyWithHTML(
      `Привет, ${ctx.message.from.first_name}! Выбери один из пунктов меню:`, {
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('Подписка', `showMonths`),
          Markup.button.callback('Подписка+', `showMonthsPlus`)
        ],
        [
          Markup.button.callback('Кикстартеры', `requestKickstarter`),
          Markup.button.callback('Релизы', `requestRelease`)
        ],
        [
          Markup.button.callback('Коллекции', `showCollections`)
        ]
      ])
    });
  }
});