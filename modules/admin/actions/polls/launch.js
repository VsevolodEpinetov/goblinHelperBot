const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { getSetting, getUser } = require('../../../db/helpers');
const { hasPermission } = require('../../../rbac');
const { getAllStudios, getStats } = require('../../../db/polls');

module.exports = Composer.action('adminPollsStart', async (ctx) => {
  // Check permissions using new RBAC system
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData || !hasPermission(userData.roles, 'admin:polls:launch')) {
    await ctx.answerCbQuery('❌ У вас нет прав для запуска голосований');
    return;
  }
  // Get polls chat settings from PostgreSQL
  const pollsChat = await getSetting('chats.polls');
  const stats = await getStats();
  
  if (!pollsChat) {
    await ctx.editMessageText(`❌ Не смог запустить голосование - нет чата.\n\nСтудий в ядре: ${stats.coreStudios}\nДобавленных студий: ${stats.dynamicStudios}`, {
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

  // Get all studios from database
  const studios = await getAllStudios();
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

  await ctx.editMessageText(`✅ Голосование запущено\n\nСтудий в ядре: ${stats.coreStudios}\nДобавленных студий: ${stats.dynamicStudios}`, {
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