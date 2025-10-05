const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { getUser } = require('../../../db/helpers');
const { hasPermission } = require('../../../rbac');

module.exports = Composer.action('adminAddKickstarter', async (ctx) => {
  // Check if user has super user role or admin permissions
  if (!util.isSuperUser(ctx.callbackQuery.from.id)) {
    const userData = await getUser(ctx.callbackQuery.from.id);
    if (!userData || !hasPermission(userData.roles, 'admin:content:kickstarters:manage')) {
      await ctx.reply('❌ У вас нет прав для добавления кикстартеров');
      return;
    }
  }

  ctx.session.kickstarter = {
    name: '',
    creator: '',
    link: [],
    files: [],
    pledgeCost: 0,
    cost: 0,
    tags: [],
    photos: [],
    pledgeName: ''
  }
  try {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  } catch (e) {
    await ctx.replyWithHTML(`Из-за ограничений телеграма тебе нужно использовать /start ещё раз. Старое сообщение останется, можешь его удалить вручную, если мешает.`)
    return;
  }
  ctx.scene.enter('ADMIN_SCENE_ADD_KICKSTARTER_LINK');
});