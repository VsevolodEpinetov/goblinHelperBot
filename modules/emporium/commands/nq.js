const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.command('nq', async (ctx) => {
  util.log(ctx)
  if (
    ctx.message.from.id != SETTINGS.CHATS.EPINETOV
  ) { return; }

  ctx.globalSession.emporium.queue = [];
  ctx.reply('nulled!')
})