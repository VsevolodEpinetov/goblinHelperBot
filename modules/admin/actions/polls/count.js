const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const STUDIOS = require('../../../../studios.json');
const { hasPermission } = require('../../../rbac');
const { getUser } = require('../../../db/helpers');

module.exports = Composer.action('adminPollsCount', async (ctx) => {
  // Check permissions using new RBAC system
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData || !hasPermission(userData.roles, 'admin:polls:results')) {
    await ctx.answerCbQuery('❌ У вас нет прав для подсчета результатов голосований');
    return;
  }
  ctx.polls.core = [];
  STUDIOS.forEach(st => ctx.polls.core.push(st.name));
  await ctx.editMessageText(`Ага, идея отличная, но я пока что хз, как реализовать. Поэтому пока что ручками:) /count на каждое сообщение\n\nСтудий в ядре: ${ctx.polls.core.length}\nДобавленных студий: ${ctx.polls.studios.length}`, {
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