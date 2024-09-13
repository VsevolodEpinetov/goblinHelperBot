const { Composer } = require('telegraf')
const SETTINGS = require('../../../settings.json');

module.exports = Composer.hears(/^[гГ]облин[,]? хочу создать лот[.!]?$/g, async (ctx) => {
  if (
    ctx.message.chat.id != SETTINGS.CHATS.GOBLIN &&
    ctx.message.chat.id != SETTINGS.CHATS.EPINETOV &&
    ctx.message.chat.id != SETTINGS.CHATS.TEST
  ) { return; }

  if ((ctx.message.message_thread_id != SETTINGS.TOPICS.GOBLIN.LOTS && ctx.message.chat.id != SETTINGS.CHATS.TEST) && ctx.message.from.id != SETTINGS.CHATS.EPINETOV) {
    ctx.reply('Милорд, сожалею, но мне было указано создавать лоты только в специальном канале! Попробуйте там')
  } else {
    await ctx.deleteMessage(ctx.message.message_id)
    ctx.scene.enter('LOT_SCENE_PHOTO_STAGE');
  }
})