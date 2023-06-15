const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js')

const emporiumStudioNameStage = new Scenes.BaseScene('EMPORIUM_STUDIO_NAME_STAGE');

emporiumStudioNameStage.enter((ctx) => {
  ctx.replyWithHTML('Напиши название студии. Например: Flesh of Gods', {
    parse_mode: 'HTML'
  }).then(nctx => {
    ctx.session.emporium.botData.lastMessage.bot = nctx.message_id;
  })
});

emporiumStudioNameStage.on('message', (ctx) => {
  ctx.session.emporium.creatureData.studioName = ctx.message.text;
  ctx.scene.enter('EMPORIUM_RELEASE_NAME_STAGE')
})

emporiumStudioNameStage.command('exit', (ctx) => {
  util.log(ctx)
  ctx.scene.leave();
})

emporiumStudioNameStage.leave(async (ctx) => {
});

module.exports = emporiumStudioNameStage;