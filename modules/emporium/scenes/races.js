const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js')

const emporiumRacesStage = new Scenes.BaseScene('EMPORIUM_RACES_STAGE');

emporiumRacesStage.enter((ctx) => {
  ctx.replyWithHTML(`Так и запишем - ${ctx.session.emporium.creatureData.sex}. Напиши расы существа.\n\nДоступные:\n<code>human</code>\n<code>orc</code>\n<code>elf</code>`, {
    parse_mode: 'HTML'
  }).then(nctx => {
    ctx.session.emporium.botData.lastMessage.bot = nctx.message_id;
  })
});

emporiumRacesStage.on('message', (ctx) => {
  const data = ctx.message.text.replace(/\s/g, '');
  const racesArray = data.split(',')
  ctx.session.emporium.creatureData.races = racesArray;
  ctx.scene.enter('EMPORIUM_CLASSES_STAGE')
})

emporiumRacesStage.command('exit', (ctx) => {
  util.log(ctx)
  ctx.scene.leave();
})

emporiumRacesStage.leave(async (ctx) => {
});

module.exports = emporiumRacesStage;