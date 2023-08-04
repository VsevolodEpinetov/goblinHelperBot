const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js');
const { default: axios } = require("axios");

const emporiumWHTypeStage = new Scenes.BaseScene('EMPORIUM_WH_TYPE_STAGE');

emporiumWHTypeStage.enter(async (ctx) => {
  const api = axios.create({
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.TOKEN_GET_FILTERS}`
    },
  });
  const data = await api.get('https://api.stl-emporium.ru/api/wh-types?fields[0]=value&fields[1]=label&pagination[pageSize]=100');
  const whTypes = data.data.data.map(r => r.attributes.value).sort();
  ctx.session.whTypes = whTypes;
  ctx.replyWithHTML(`Теперь - выбери подходящие типы\n\nДоступные:${whTypes.map(r => `\n<code>${r},</code>`).join('')}`, {
    parse_mode: 'HTML'
  }).then(nctx => {
    ctx.session.emporium.botData.lastMessage.bot = nctx.message_id;
  })
});

emporiumWHTypeStage.command('exit', (ctx) => {
  util.log(ctx)
  ctx.reply('Вышел')
  ctx.scene.leave();
})

emporiumWHTypeStage.on('message', (ctx) => {
  const data = ctx.message.text.replace(/\s/g, '');
  const typesArray = data.split(',').filter((item) => item !== '');
  const validTypes = typesArray.filter((race) => ctx.session.whTypes.includes(race));

  try {
    ctx.deleteMessage(ctx.session.emporium.botData.lastMessage.bot);
  }
  catch (err) {
    console.log(err);
  }

  if (validTypes.length === 0) {
    ctx.reply('Указанные тобой фракций не существуют на сайте'); // Respond if no valid races are found
    ctx.scene.enter('EMPORIUM_WH_TYPE_STAGE');
  } else {
    ctx.session.emporium.creatureData.whTypes = validTypes;
    ctx.scene.enter('EMPORIUM_CLASSES_PHOTO');
  }
})

emporiumWHTypeStage.leave(async (ctx) => {
});

module.exports = emporiumWHTypeStage;