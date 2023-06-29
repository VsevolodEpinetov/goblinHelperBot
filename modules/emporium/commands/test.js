const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const STUDIOS = require('../studios.json')
const util = require('../../util');
const { default: axios } = require("axios");

module.exports = Composer.command('test', async (ctx) => {
  util.log(ctx)
  if (
    ctx.message.from.id != SETTINGS.CHATS.EPINETOV
  ) { return; }

  try {
    const data = await axios.get('https://api.stl-emporium.ru/api/races?fields[0]=value&fields[1]=label&pagination[pageSize]=100');
    const races = data.data.data.map(r => r.attributes.value);
    console.log(races)
    ctx.reply('got races')
  } catch (err) {
    console.log(err)
    ctx.reply('error')
  }
})