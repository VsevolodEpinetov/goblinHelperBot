const { Composer, Markup } = require('telegraf');
const lotsUtils = require('../utils')
const SETTINGS = require('../../../settings.json');

module.exports = Composer.command('info', (ctx) => {
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) {
    return;
  }

  let lotID = -1;
  let lotData;

  ctx.globalSession.lots.forEach((l, id) => {
    if (lotID == -1) {
      if (l != null) {
        if (l.author == ctx.message.reply_to_message.caption.split('\n')[0] && l.name == ctx.message.reply_to_message.caption.split('\n')[1]) {
          lotID = id;
          lotData = l;
        }
      }
    }
  })

  lotID > 0 ? console.log('found') : console.log('not found')

  console.log(lotData);
})