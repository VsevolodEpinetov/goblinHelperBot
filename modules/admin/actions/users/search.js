const { Composer, Markup } = require("telegraf");

module.exports = Composer.action('searchUser', async (ctx) => {
  // Check if this is being used in EPINETOV's DMs - if not, don't allow it
  const SETTINGS = require('../../../settings.json');
  if (ctx.chat.id.toString() !== SETTINGS.CHATS.EPINETOV) {
    await ctx.answerCbQuery('❌ Поиск пользователей доступен только в личных сообщениях с администратором');
    return;
  }

  try {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  } catch (e) {
    await ctx.replyWithHTML(`Из-за ограничений телеграма тебе нужно использовать /start ещё раз. Старое сообщение останется, можешь его удалить вручную, если мешает.`)
    return;
  }
  ctx.scene.enter('SCENE_SEARCH_USER');
});