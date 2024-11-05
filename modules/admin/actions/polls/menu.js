const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action('adminPolls', async (ctx) => {
  if (!ctx.polls.studios) ctx.polls.studios = [];
  if (!ctx.polls.core) ctx.polls.core = [];

  if (!ctx.callbackQuery.message.photo) {
    await ctx.editMessageText(`📊 <b>Меню работы с голосованиями</b> 📊\n\nСтудий в ядре: ${ctx.polls.core.length}\nДобавленных студий: ${ctx.polls.studios.length}`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('Ядро', 'adminPollsCore'),
          Markup.button.callback('Добавленные', 'adminPollsStudios'),
        ],
        [
          Markup.button.callback('🚀 Запустить', 'adminPollsStart'),
          Markup.button.callback('🔄 Посчитать', 'adminPollsCount')
        ],
        [
          Markup.button.callback('←', 'adminMenu')
        ]
      ])
    })
  } else {
    await ctx.deleteMessage();
    await ctx.replyWithHTML(`📊 <b>Меню работы с голосованиями</b> 📊\n\nСтудий в ядре: ${ctx.polls.core.length}\nДобавленных студий: ${ctx.polls.studios.length}`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('Ядро', 'adminPollsCore'),
          Markup.button.callback('Добавленные', 'adminPollsStudios'),
        ],
        [
          Markup.button.callback('🚀 Запустить', 'adminPollsStart'),
          Markup.button.callback('🔄 Посчитать', 'adminPollsCount')
        ],
        [
          Markup.button.callback('←', 'adminMenu')
        ]
      ])
    })
  }
});