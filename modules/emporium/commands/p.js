const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.command('p', async (ctx) => {
  util.log(ctx)


  ctx.reply('yo')
})