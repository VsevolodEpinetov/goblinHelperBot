const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { ensureRoles } = require('../../../rbac');
const { getStats } = require('../../../db/polls');

const POLLS_ROLES = ['polls', 'adminPolls', 'admin', 'adminPlus', 'super'];

module.exports = Composer.action('adminPolls', async (ctx) => {
  const check = await ensureRoles(ctx, POLLS_ROLES, { errorMessage: '❌ У вас нет прав для работы с голосованиями' });
  if (!check.allowed) return;

  const userId = ctx.callbackQuery.from.id;
  
  // Get statistics from database
  const stats = await getStats();

  if (!ctx.callbackQuery.message.photo) {
    await ctx.editMessageText(`📊 <b>Меню работы с голосованиями</b> 📊\n\nСтудий в ядре: ${stats.coreStudios}\nДобавленных студий: ${stats.dynamicStudios}`, {
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
          Markup.button.callback('←', 'userMenu')
        ]
      ])
    })
  } else {
    await ctx.deleteMessage();
    await ctx.replyWithHTML(`📊 <b>Меню работы с голосованиями</b> 📊\n\nСтудий в ядре: ${stats.coreStudios}\nДобавленных студий: ${stats.dynamicStudios}`, {
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
          Markup.button.callback('←', 'userMenu')
        ]
      ])
    })
  }
});