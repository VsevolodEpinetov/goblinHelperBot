const { Composer, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.command('pi', async (ctx) => {
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) { return; }

  if (!ctx.globalSession.participants) ctx.globalSession.participants = {};
  
  let participants = ctx.message.text.split('/pi\n')[1].split('\n')

  let obj = {};

  participants.forEach(p => {
    obj[p] = {
      name: '',
      username: ''
    }
  })
  
  ctx.globalSession.participants = obj;
  ctx.reply('Записал список участников')
})