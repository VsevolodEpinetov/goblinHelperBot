const { Composer, Scenes } = require('telegraf')

//const stage = new Scenes.Stage([require('./scenes/photoScene')]);

module.exports = Composer.hears(/^[гГ]облин[,]? хочу создать лот[.!]?$/g, (ctx) => {
  ctx.scene.enter('LOT_SCENE_PHOTO_STAGE');
  /*if (
    ctx.message.chat.id != SETTINGS.CHATS.GOBLIN &&
    ctx.message.chat.id != SETTINGS.CHATS.EPINETOV &&
    ctx.message.chat.id != SETTINGS.CHATS.TEST
  ) { return; }

  if (ctx.message.message_thread_id != SETTINGS.TOPICS.GOBLIN.LOTS) {
    ctx.reply('Милорд, сожалею, но мне было указано создавать лоты только в специальном канале! Попробуйте там')
  } else {
    ctx.scene.enter('LOT_SCENE_PHOTO_STAGE');
  }*/
})