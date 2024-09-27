const { Composer, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.command('resetm', async (ctx) => {
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) { return; }

  ctx.months.list = {};
  ctx.globalSession.currentMonth = '';
  
  ctx.replyWithHTML('done')
})