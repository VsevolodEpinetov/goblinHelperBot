const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { hasPermission } = require('../../../rbac');
const { getUser } = require('../../../db/helpers');
const { getCoreStudios, getDynamicStudios } = require('../../../db/polls');

module.exports = Composer.action('adminPollsCount', async (ctx) => {
  // Check permissions using new RBAC system
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData || !hasPermission(userData.roles, 'admin:polls:results')) {
    await ctx.answerCbQuery('❌ У вас нет прав для подсчета результатов голосований');
    return;
  }
  // Get studios from database
  const coreStudios = await getCoreStudios();
  const dynamicStudios = await getDynamicStudios();
  const coreStudioNames = coreStudios.map(s => s.name);
  const dynamicStudioNames = dynamicStudios.map(s => s.name);
  
  await ctx.editMessageText(`Ага, идея отличная, но я пока что хз, как реализовать. Поэтому пока что ручками:) /count на каждое сообщение\n\nСтудий в ядре: ${coreStudioNames.length}\nДобавленных студий: ${dynamicStudioNames.length}`, {
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
});