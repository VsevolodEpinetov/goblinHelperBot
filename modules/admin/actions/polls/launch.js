const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { getSetting } = require('../../../db/helpers');

module.exports = Composer.action('adminPollsStart', async (ctx) => {
  // Get polls chat settings from PostgreSQL
  const pollsChat = await getSetting('chats.polls');
  if (!pollsChat) {
    await ctx.editMessageText(`❌ Не смог запустить голосование - нет чата.\n\nСтудий в ядре: ${ctx.polls.core.length}\nДобавленных студий: ${ctx.polls.studios.length}`, {
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
    return;
  }

  const studios = ctx.polls.core.concat(ctx.polls.studios);
  studios.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const maxOptionsPerPoll = 9;
  let options = [[]];

  studios.forEach((studio, index) => {
    const currentPoll = options[options.length - 1];
    currentPoll.push(studio);

    if (currentPoll.length === maxOptionsPerPoll) {
      currentPoll.push('Пустой вариант');
      options.push([]);
    }
  });

  // Ensure the last poll ends with 'Пустой вариант'
  const lastPoll = options[options.length - 1];
  if (lastPoll.length > 0 && lastPoll[lastPoll.length - 1] !== 'Пустой вариант') {
    lastPoll.push('Пустой вариант');
  }

  // Send polls
  for (let i = 0; i < options.length; i++) {
    if (options[i].length > 0) { // Skip empty options
      await ctx.telegram.sendPoll(
        pollsChat.id,
        `Голосование. Часть ${i + 1}`,
        options[i],
        {
          is_anonymous: false,
          allows_multiple_answers: true,
          message_thread_id: pollsChat.thread_id
        }
      );
    }
  }

  await ctx.editMessageText(`✅ Голосование запущено\n\nСтудий в ядре: ${ctx.polls.core.length}\nДобавленных студий: ${ctx.polls.studios.length}`, {
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
});