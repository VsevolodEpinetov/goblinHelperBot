const { Composer } = require("telegraf");
const util = require('../../../util');

module.exports = Composer.action(/^adminEditKickstarterPledge_(\d+)$/, async (ctx) => {
  if (!util.isSuperUser(ctx.callbackQuery.from.id) || ctx.chat.type !== 'private') {
    await ctx.answerCbQuery('❌ Доступ запрещён');
    return;
  }

  const kickstarterId = parseInt(ctx.match[1]);
  ctx.session.editingKickstarter = { id: kickstarterId, field: 'pledgeName' };
  
  try {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  } catch (e) {
    // Continue anyway
  }

  ctx.scene.enter('ADMIN_SCENE_EDIT_KICKSTARTER_PLEDGE');
});

