const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { hasPermission } = require('../../../rbac');
const { getUser } = require('../../../db/helpers');
const { clearDynamicStudios } = require('../../../db/polls');

module.exports = Composer.action('adminPollsStudiosReset', async (ctx) => {
  // Check permissions using new RBAC system
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData || !hasPermission(userData.roles, 'admin:polls:edit')) {
    await ctx.answerCbQuery('❌ У вас нет прав для сброса добавленных студий');
    return;
  }
  // Clear dynamic studios from database
  await clearDynamicStudios();
  await ctx.editMessageText(`✅ <i>Все добавленные студии были <b>сброшены</b></i>\n\n<u>Добавленные студии:</u>\n(пусто)`, {
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