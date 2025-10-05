const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { getKickstarters, getUser } = require('../../../db/helpers');
const { hasPermission } = require('../../../rbac');

module.exports = Composer.action('adminKickstarters', async (ctx) => {
  // Check if user has super user role or admin permissions
  if (!util.isSuperUser(ctx.callbackQuery.from.id)) {
    const userData = await getUser(ctx.callbackQuery.from.id);
    if (!userData || !hasPermission(userData.roles, 'admin:content:kickstarters:manage')) {
      await ctx.reply('❌ У вас нет прав для управления кикстартерами');
      return;
    }
  }

  const kickstartersData = await getKickstarters();

  if (!ctx.callbackQuery.message.photo) {
    await ctx.editMessageText(`Меню работы с кикстартерами\n\nВсего кикстартеров в базе: ${kickstartersData.list.length}`, {
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('+', 'adminAddKickstarter'),
          Markup.button.callback('🔍', 'searchKickstarter'),
          Markup.button.callback('✏️', 'adminEditKickstarter')
        ],
        [
          Markup.button.callback('←', 'userMenu')
        ]
      ])
    })
  } else {
    await ctx.deleteMessage();
    await ctx.replyWithHTML(`Меню работы с кикстартерами\n\nВсего кикстартеров в базе: ${kickstartersData.list.length}`, {
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('+', 'adminAddKickstarter'),
          Markup.button.callback('🔍', 'searchKickstarter'),
          Markup.button.callback('✏️', 'adminEditKickstarter')
        ],
        [
          Markup.button.callback('←', 'userMenu')
        ]
      ])
    })
  }
});