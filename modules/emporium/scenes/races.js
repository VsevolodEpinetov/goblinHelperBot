const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js');
const { default: axios } = require("axios");

const emporiumRacesStage = new Scenes.BaseScene('EMPORIUM_RACES_STAGE');

emporiumRacesStage.enter(async (ctx) => {
  const data = await axios.get('https://api.stl-emporium.ru/api/races?fields[0]=value&fields[1]=label&pagination[pageSize]=100');
  const races = data.data.data.map(r => r.attributes.value).sort();
  ctx.session.races = races;
  ctx.replyWithHTML(`Так и запишем - ${ctx.session.emporium.creatureData.sex}. Напиши расы существа.\n\nДоступные:${races.map(r => `\n<code>${r},</code>`).join('')}`, {
    parse_mode: 'HTML'
  }).then(nctx => {
    ctx.session.emporium.botData.lastMessage.bot = nctx.message_id;
  })
});

emporiumRacesStage.on('message', (ctx) => {
  const data = ctx.message.text.replace(/\s/g, '');
  const racesArray = data.split(',').filter((item) => item !== '');
  const validRaces = racesArray.filter((race) => ctx.session.races.includes(race));

  try {
    ctx.deleteMessage(ctx.session.emporium.botData.lastMessage.bot);
  }
  catch (err) {
    console.log(err);
  }

  if (validRaces.length === 0) {
    ctx.reply('Указанные тобой расы не существуют на сайте'); // Respond if no valid races are found
    ctx.scene.enter('EMPORIUM_RACES_STAGE');
  } else {
    ctx.session.emporium.creatureData.races = validRaces;
    ctx.scene.enter('EMPORIUM_CLASSES_STAGE');
  }
})

emporiumRacesStage.command('exit', (ctx) => {
  util.log(ctx)
  ctx.scene.leave();
})

emporiumRacesStage.leave(async (ctx) => {
});

module.exports = emporiumRacesStage;