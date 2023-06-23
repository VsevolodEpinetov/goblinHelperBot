const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.command('fix', async (ctx) => {
  util.log(ctx)
  if (
    ctx.message.from.id != SETTINGS.CHATS.EPINETOV
  ) { return; }

  ctx.globalSession.emporium.queue.forEach(q => {
    if (q.data.preview) q.data.preview = undefined;
  })
  ctx.reply('fixed')
})