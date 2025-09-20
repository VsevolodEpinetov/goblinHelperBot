const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const STUDIOS = require('../../../../studios.json');
const { hasPermission } = require('../../../rbac');
const { getUser } = require('../../../db/helpers');

module.exports = Composer.action('adminPollsCoreReset', async (ctx) => {
  // Check permissions using new RBAC system
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData || !hasPermission(userData.roles, 'admin:polls:edit')) {
    await ctx.answerCbQuery('❌ У вас нет прав для сброса ядра голосований');
    return;
  }
  ctx.polls.core = [];
  STUDIOS.forEach(st => ctx.polls.core.push(st.name));
  await ctx.editMessageText(`✅ <i>Ядро было <b>сброшено</b> до того, что хранится на сервере</i>\n\n<u>Студии ядра:</u>\n${ctx.polls.core.join('\n')}`, {
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