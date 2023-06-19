const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const STUDIOS = require('../../../studios.json')
const util = require('../../util')

module.exports = Composer.command('studios', (ctx) => {
  util.log(ctx)
  
  const isAnAdmin = ctx.message.from.id == SETTINGS.CHATS.EPINETOV || ctx.message.from.id == SETTINGS.CHATS.ALEKS;

  if (!isAnAdmin) { 
    return; 
  }

  let params = ctx.message.text.split('/studios ');
  let message = `Список студий, которые будут участвовать в голосовании:`
  let messageBoughtPart = `А эти студии у нас уже есть, поэтому их не выкупаем:`
  let counterMain = 1;
  let counterBought = 1;

  let listOfStudios;

  if (ctx.globalSession.studios) {
    listOfStudios = ctx.globalSession.studios;
    console.log('using session data');
    console.log(listOfStudios[1]);
  }
  else {
    listOfStudios = STUDIOS;
    console.log('using file data');    
  }

  function getStudioString (link, name, price, params) {
    if (params.indexOf('m') > -1) {
      return `<code>${name}</code>`
    } else {
      return `<a href="${link}">${name}</a> - $${price}`
    }
  }

  for (let i = 0; i < listOfStudios.length; i++) {
    const str = getStudioString(listOfStudios[i].mainLink, listOfStudios[i].name, listOfStudios[i].price, params);
    if (!listOfStudios[i].bought) {
      message += `\n${counterMain}. ${str}`;
      counterMain++;
    } else {
      messageBoughtPart += `\n${counterBought}. ${str}`
      counterBought++;
    }

  }

  try {
    ctx.reply(message, {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
    util.sleep(50);
    ctx.reply(messageBoughtPart, {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  }
  catch (e) {
    console.log('Failed to reply')
    console.log(e)
    ctx.reply(message, {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  }
})