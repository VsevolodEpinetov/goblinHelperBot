const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const STUDIOS = require('../../../studios.json')
const util = require('../../util')

module.exports = Composer.command('studios', async (ctx) => {
  util.log(ctx)
  
  const isAnAdmin = ctx.message.from.id == SETTINGS.CHATS.EPINETOV || ctx.message.from.id == SETTINGS.CHATS.ALEKS || ctx.message.from.id == SETTINGS.CHATS.ARTYOM;

  if (!isAnAdmin) { 
    return; 
  }

  let params = ctx.message.text.split('/studios ');
  let message = `Список студий, которые будут участвовать в голосовании:`
  let secondMessageMain = ``;
  let messageBoughtPart = `А эти студии у нас уже есть, поэтому их не выкупаем:`
  let counterMain = 1;
  let counterBought = 1;

  let listOfStudios;

  if (ctx.globalSession.studios) {
    listOfStudios = ctx.globalSession.studios;
  }
  else {
    listOfStudios = STUDIOS;
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
      if (counterMain < 100) {
        message += `\n${counterMain}. ${str}`;
      } else {
        secondMessageMain += `\n${counterMain}. ${str}`;
      }
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
    await util.sleep(100);
    if (secondMessageMain.length > 1) {
      ctx.reply(secondMessageMain, {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
      await util.sleep(100);
    }
    ctx.reply(messageBoughtPart, {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  }
  catch (e) {
    ctx.reply(message, {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  }
})