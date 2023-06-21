const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const STUDIOS = require('../studios.json')
const util = require('../../util')

module.exports = Composer.command('se', async (ctx) => {
  util.log(ctx)
  if (
    ctx.message.from.id != SETTINGS.CHATS.EPINETOV
  ) { return; }

  if (!ctx.globalSession.emporium) ctx.globalSession.emporium = {};
  ctx.globalSession.emporium.studios = STUDIOS;
  ctx.reply('synced!')
})