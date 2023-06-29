const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js');
const { default: axios } = require("axios");

const emporiumWeaponsStage = new Scenes.BaseScene('EMPORIUM_CLASSES_WEAPONS');

emporiumWeaponsStage.command('exit', (ctx) => {
  util.log(ctx)
  ctx.scene.leave();
})

emporiumWeaponsStage.enter(async (ctx) => {
  const data = await axios.get('https://api.stl-emporium.ru/api/weapons?fields[0]=value&fields[1]=label&pagination[pageSize]=100');
  const weapons = data.data.data.map(r => r.attributes.value).sort();
  ctx.session.weapons = weapons;
  const creatureData = ctx.session.emporium.creatureData;
  ctx.replyWithHTML(`Записал указанные тобой классы: ${creatureData.classes.map(r => `${r}`).join(' ')}. Напиши оружие, которое держит существо.\n\nДоступные:${weapons.map(w => `\n<code>${w},</code>`).join('')}`, {
    parse_mode: 'HTML'
  }).then(nctx => {
    ctx.session.emporium.botData.lastMessage.bot = nctx.message_id;
  })
});

emporiumWeaponsStage.on('message', (ctx) => {
  const data = ctx.message.text.replace(/\s/g, '');
  const weaponsArray = data.split(',').filter((item) => item !== '');
  const validWeapons = weaponsArray.filter((race) => ctx.session.weapons.includes(race));

  try {
    ctx.deleteMessage(ctx.session.emporium.botData.lastMessage.bot);
  }
  catch (err) {
    console.log(err);
  }

  if (validWeapons.length === 0) {
    ctx.reply('Указанные тобой оружие не существуют на сайте'); // Respond if no valid races are found
    ctx.scene.enter('EMPORIUM_CLASSES_WEAPONS');
  } else {
    ctx.session.emporium.creatureData.weapons = validWeapons;
    ctx.scene.enter('EMPORIUM_CLASSES_PHOTO');
  }
});


emporiumWeaponsStage.leave(async (ctx) => {
});

module.exports = emporiumWeaponsStage;