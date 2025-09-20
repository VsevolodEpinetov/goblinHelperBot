const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { hasPermission } = require('../../../rbac');
const { getUser } = require('../../../db/helpers');

module.exports = Composer.action('adminPollsStudios', async (ctx) => {
  // Check permissions using new RBAC system
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData || !hasPermission(userData.roles, 'admin:polls:edit')) {
    await ctx.answerCbQuery('❌ У вас нет прав для управления добавленными студиями');
    return;
  }
  await ctx.editMessageText(`📊➕ <b>Добавленные студии</b>\n\nВсе добавленные студии:\n${ctx.polls.studios.join('\n')}`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('+/-', 'adminPollsStudiosAdd'),
        Markup.button.callback('Сбросить', 'adminPollsStudiosReset'),
      ],
      [
        Markup.button.callback('←', 'adminPolls')
      ]
    ])
  })
});