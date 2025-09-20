const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { hasPermission } = require('../../../rbac');
const { getUser } = require('../../../db/helpers');

module.exports = Composer.action('adminPollsCore', async (ctx) => {
  // Check permissions using new RBAC system
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData || !hasPermission(userData.roles, 'admin:polls:edit')) {
    await ctx.answerCbQuery('❌ У вас нет прав для управления ядром голосований');
    return;
  }
  await ctx.editMessageText(`📊 <b>Ядро голосований</b>\n\nСтудии ядра:\n${ctx.polls.core.join('\n')}`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('+/-', 'adminPollsCoreAdd'),
        Markup.button.callback('Сбросить', 'adminPollsCoreReset'),
      ],
      [
        Markup.button.callback('←', 'adminPolls')
      ]
    ])
  })
});