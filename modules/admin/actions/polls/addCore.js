const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { hasPermission } = require('../../../rbac');
const { getUser } = require('../../../db/helpers');

module.exports = Composer.action('adminPollsCoreAdd', async (ctx) => {
  // Check permissions using new RBAC system
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData || !hasPermission(userData.roles, 'admin:polls:edit')) {
    await ctx.answerCbQuery('❌ У вас нет прав для редактирования ядра голосований');
    return;
  }
  try {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  } catch (e) {
    await ctx.replyWithHTML(`Из-за ограничений телеграма тебе нужно использовать /start ещё раз. Старое сообщение останется, можешь его удалить вручную, если мешает.`)
    return;
  }
  ctx.scene.enter('ADMIN_SCENE_ADD_POLLS_CORE');
});