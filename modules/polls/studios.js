const { Composer } = require("telegraf");
const SETTINGS = require('../../settings.json')
const STUDIOS = require('../../studios.json')
const util = require('../util')

module.exports = Composer.command('studios', (ctx) => {
  util.log(ctx)
  /*if (
    ctx.message.chat.id != SETTINGS.CHATS.EPINETOV && 
    ctx.message.chat.id != SETTINGS.CHATS.TEST &&
    ctx.message.chat.id != SETTINGS.CHATS.GOBLIN
  ) { return; }*/

  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV && ctx.message.from.id != SETTINGS.CHATS.ALEKS) { return; }
  let message = `Список студий, которые будут участвовать в голосовании:`
  let messageBoughtPart = `А эти студии у нас уже есть, поэтому их не выкупаем:`
  let counterMain = 1;
  let counterBought = 1;

  for (let i = 0; i < STUDIOS.length; i++) {
    if (!STUDIOS[i].bought) {
      message += `\n${counterMain}. <a href="${STUDIOS[i].mainLink}">${STUDIOS[i].name}</a> - $${STUDIOS[i].price}`;
      counterMain++;
    } else {
      messageBoughtPart += `\n${counterBought}. <a href="${STUDIOS[i].mainLink}">${STUDIOS[i].name}</a> - $${STUDIOS[i].price}`
      counterBought++;
    }

  }
  message += `\n\n${messageBoughtPart}`;

  try {
    ctx.reply(message, {
      reply_to_message_id: ctx.message.message_id,
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