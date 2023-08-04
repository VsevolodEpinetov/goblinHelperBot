const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js');
const { default: axios } = require("axios");

const emporiumWHFactionsStage = new Scenes.BaseScene('EMPORIUM_WH_FACTIONS_STAGE');

emporiumWHFactionsStage.enter(async (ctx) => {
  const api = axios.create({
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.TOKEN_GET_FILTERS}`
    },
  });
  const data = await api.get('https://api.stl-emporium.ru/api/wh-factions?fields[0]=value&fields[1]=label&pagination[pageSize]=100');
  const factions = data.data.data.map(r => r.attributes.value).sort();
  ctx.session.factions = factions;
  ctx.replyWithHTML(`Самое время определиться с фракциями, к которым относится существо!\n\nДоступные:${factions.map(r => `\n<code>${r},</code>`).join('')}`, {
    parse_mode: 'HTML'
  }).then(nctx => {
    ctx.session.emporium.botData.lastMessage.bot = nctx.message_id;
  })
});

emporiumWHFactionsStage.command('exit', (ctx) => {
  util.log(ctx)
  ctx.reply('Вышел')
  ctx.scene.leave();
})

emporiumWHFactionsStage.on('message', (ctx) => {
  const data = ctx.message.text.replace(/\s/g, '');
  const factionsArray = data.split(',').filter((item) => item !== '');
  const validFactions = factionsArray.filter((race) => ctx.session.factions.includes(race));

  try {
    ctx.deleteMessage(ctx.session.emporium.botData.lastMessage.bot);
  }
  catch (err) {
    console.log(err);
  }

  if (validFactions.length === 0) {
    ctx.reply('Указанные тобой фракций не существуют на сайте'); // Respond if no valid races are found
    ctx.scene.enter('EMPORIUM_WH_FACTIONS_STAGE');
  } else {
    ctx.session.emporium.creatureData.factions = validFactions;
    ctx.scene.enter('EMPORIUM_WH_TYPE_STAGE');
  }
})

emporiumWHFactionsStage.leave(async (ctx) => {
});

module.exports = emporiumWHFactionsStage;