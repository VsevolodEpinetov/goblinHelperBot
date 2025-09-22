const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { hasPermission } = require('../../../rbac');
const { getUser } = require('../../../db/helpers');
const { getStats } = require('../../../db/polls');

module.exports = Composer.action('adminPolls', async (ctx) => {
  // Check permissions using new RBAC system
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData || !hasPermission(userData.roles, 'admin:polls:create')) {
    await ctx.answerCbQuery('❌ У вас нет прав для работы с голосованиями');
    return;
  }

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
          Markup.button.callback('←', `${util.isSuperUser(userId) ? 'adminMenu' : 'userMenu'}`)
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
          Markup.button.callback('←', `${util.isSuperUser(userId) ? 'adminMenu' : 'userMenu'}`)
        ]
      ])
    })
  }
});