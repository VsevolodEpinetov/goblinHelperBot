const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.reaction('👍', async (ctx) => {
  //console.log('yes')
  //console.log(ctx.update.message_reaction);
  let text;
  ctx.copyMessage(ctx.update.message_reaction.chat.id).then((nctx) => {
    console.log(nctx.message)
    //text = ctx.message.text;
  });
  console.log(text);
  return;
  const isAnAdmin = ctx.message.from.id == SETTINGS.CHATS.EPINETOV || ctx.message.from.id == SETTINGS.CHATS.ALEKS || ctx.message.from.id == SETTINGS.CHATS.ARTYOM;

  if (!isAnAdmin) { 
    return; 
  }

  const messageText = ctx.message.text;

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