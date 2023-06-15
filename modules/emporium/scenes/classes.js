const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js')

const emporiumClassesStage = new Scenes.BaseScene('EMPORIUM_CLASSES_STAGE');

emporiumClassesStage.enter((ctx) => {
  ctx.replyWithHTML(`Так и запишем - ${ctx.session.emporium.creatureData.sex}. Напиши классы существа.\n\nДоступные:\n<code>rogue</code>\n<code>paladin</code>\n<code>wizard</code>`, {
    parse_mode: 'HTML'
  }).then(nctx => {
    ctx.session.emporium.botData.lastMessage.bot = nctx.message_id;
  })
});

emporiumClassesStage.on('message', (ctx) => {
  const data = ctx.message.text.replace(/\s/g, '');
  const racesArray = data.split(',')
  ctx.session.emporium.creatureData.classes = racesArray;

  const creatureData = ctx.session.emporium.creatureData;
  console.log(JSON.stringify(creatureData));
  ctx.replyWithHTML(`Данные:\n\nРасы: ${creatureData.races.join(', ')}\nКлассы: ${creatureData.classes.join(', ')}\n\nСтудия: ${creatureData.studioName}\nРелиз: ${creatureData.releaseName}\n\nПол: ${creatureData.sex}`)
  ctx.scene.leave();
})

emporiumClassesStage.command('exit', (ctx) => {
  util.log(ctx)
  ctx.scene.leave();
})

emporiumClassesStage.leave(async (ctx) => {
  ctx.session.emporium = {};
});

module.exports = emporiumClassesStage;