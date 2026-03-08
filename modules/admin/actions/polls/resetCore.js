const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { ensureRoles } = require('../../../rbac');
const { getCoreStudios } = require('../../../db/polls');

const POLLS_ROLES = ['polls', 'adminPolls', 'admin', 'adminPlus', 'super'];

module.exports = Composer.action('adminPollsCoreReset', async (ctx) => {
  const check = await ensureRoles(ctx, POLLS_ROLES, { errorMessage: '❌ У вас нет прав для сброса ядра голосований' });
  if (!check.allowed) return;
  
  // Get core studios from database
  const coreStudios = await getCoreStudios();
  const coreStudioNames = coreStudios.map(s => s.name);
  
  await ctx.editMessageText(`✅ <i>Ядро было <b>сброшено</b> до того, что хранится на сервере</i>\n\n<u>Студии ядра:</u>\n${coreStudioNames.join('\n')}`, {
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