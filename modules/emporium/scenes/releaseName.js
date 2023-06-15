const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js')

const emporiumReleaseNameStage = new Scenes.BaseScene('EMPORIUM_RELEASE_NAME_STAGE');

emporiumReleaseNameStage.enter((ctx) => {
  ctx.replyWithHTML(`Понял, это релиз студии "${ctx.session.emporium.creatureData.studioName}". Напиши название релиза. Обязательно включай год и месяц выпуска. Например: 202305 - Hell Angels`, {
    parse_mode: 'HTML'
  }).then(nctx => {
    ctx.session.emporium.botData.lastMessage.bot = nctx.message_id;
  })
});

emporiumReleaseNameStage.on('message', (ctx) => {
  ctx.session.emporium.creatureData.releaseName = ctx.message.text;
  ctx.scene.enter('EMPORIUM_SEX_STAGE')
})

emporiumReleaseNameStage.command('exit', (ctx) => {
  util.log(ctx)
  ctx.scene.leave();
})

emporiumReleaseNameStage.leave(async (ctx) => {
});

module.exports = emporiumReleaseNameStage;