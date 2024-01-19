const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.hears('+', async (ctx) => {
  util.log(ctx)
  const isAnAdmin = ctx.message.from.id == SETTINGS.CHATS.EPINETOV || ctx.message.from.id == SETTINGS.CHATS.ALEKS || ctx.message.from.id == SETTINGS.CHATS.ARTYOM;

  if (!isAnAdmin) { 
    console.log('not an admin')
    return; 
  }

  if (!ctx.message.reply_to_message) {
    console.log('not replying')
    return;
  }

  const messageText = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption;

  const data = JSON.stringify(messageText).replaceAll('"', '').split('\\n');
  let studio = {
    name: "dummy",
    price: 0,
    mainLink: "google.com",
    bought: false
  }

  data.forEach((el, id) => {
    let type = 'name';
    let value = el;
    if (el.indexOf('http') == 0) {
      type = 'mainLink'
    } else if (el.indexOf('$') == 0 || el.indexOf('€') == 0) {
      type = 'price'
      value = el.replaceAll('$', '');
      value = value.replaceAll('€', '')
      value = parseInt(value);
    }
    studio[type] = value;
  })
  
  //ctx.globalSession.studios.push(studio);
  let copy = ctx.globalSession.studios.slice();
  copy.push(studio);
  copy.sort((a, b) => a.name.localeCompare(b.name))
  ctx.globalSession.studios = copy;

  ctx.reply('added and sorted')
})