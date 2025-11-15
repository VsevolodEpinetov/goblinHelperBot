const { Composer } = require("telegraf");
const util = require('../../../util');

module.exports = Composer.action(/^addFilesKickstarter_(\d+)$/, async (ctx) => {
  // Check for super user
  if (!util.isSuperUser(ctx.callbackQuery.from.id)) {
    await ctx.answerCbQuery('❌ Только супер-пользователи могут добавлять файлы');
    return;
  }

  // Check for DM context
  if (ctx.chat.type !== 'private') {
    await ctx.answerCbQuery('❌ Добавление файлов доступно только в личных сообщениях');
    return;
  }

  try {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  } catch (e) {
    await ctx.replyWithHTML(`Из-за ограничений телеграма тебе нужно использовать /start ещё раз. Старое сообщение останется, можешь его удалить вручную, если мешает.`);
    return;
  }

  const ksId = parseInt(ctx.match[1]);
  ctx.session.editingKickstarter = { id: ksId, field: 'addFiles', files: [] };
  ctx.scene.enter('ADMIN_SCENE_ADD_KICKSTARTER_FILES');
});
