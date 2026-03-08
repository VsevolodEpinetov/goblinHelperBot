const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { ensureRoles } = require('../../../rbac');
const { getDynamicStudios } = require('../../../db/polls');

const POLLS_ROLES = ['polls', 'adminPolls', 'admin', 'adminPlus', 'super'];

module.exports = Composer.action('adminPollsStudios', async (ctx) => {
  const check = await ensureRoles(ctx, POLLS_ROLES, { errorMessage: '❌ У вас нет прав для управления добавленными студиями' });
  if (!check.allowed) return;
  // Get dynamic studios from database
  const dynamicStudios = await getDynamicStudios();
  const studioNames = dynamicStudios.map(s => s.name);
  
  await ctx.editMessageText(`📊➕ <b>Добавленные студии</b>\n\nВсе добавленные студии:\n${studioNames.join('\n')}`, {
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