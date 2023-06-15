const { Composer } = require("telegraf");
const SETTINGS = require('../../settings.json')
const STUDIOS = require('../../studios.json')
const util = require('../util')

module.exports = Composer.command('sync', async (ctx) => {
  util.log(ctx)
  if (
    ctx.message.chat.id != SETTINGS.CHATS.EPINETOV && 
    ctx.message.chat.id != SETTINGS.CHATS.TEST &&
    ctx.message.chat.id != SETTINGS.CHATS.GOBLIN
  ) { return; }

  ctx.globalSession.studios = STUDIOS;
  ctx.reply('synced!')
})