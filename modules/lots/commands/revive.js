const { Composer, Markup } = require('telegraf');
const lotsUtils = require('../utils')
const SETTINGS = require('../../../settings.json');

module.exports = Composer.command('revive', (ctx) => {
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) {
    return;
  }

  const lotID = parseInt(ctx.message.text.split('/revive ')[1]);
  const lotData = ctx.globalSession.lots[lotID];

  let organizator = lotData.whoCreated?.first_name + ' ' + lotData.whoCreated?.last_name;
  if (lotData.whoCreated.username) organizator += ` (@${lotData.whoCreated.username})`

  let caption = lotsUtils.getLotMessage({
    author: lotData.author,
    name: lotData.name,
    link: lotData.link,
    price: lotData.price,
    organizator: organizator,
    status: true,
    participants: lotData.participants
  })

  if (caption.length > 1023) {
    caption = lotsUtils.getLotMessageShort({
      author: lotData.author,
      name: lotData.name,
      link: lotData.link,
      price: lotData.price,
      organizator: organizator,
      status: true,
      participants: lotData.participants
    })
  }

  ctx.replyWithPhoto(lotData.photo, {
    caption: caption,
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      Markup.button.callback(SETTINGS.BUTTONS.LOT.JOIN, `action-join-lot-${lotID}`),
      Markup.button.callback(SETTINGS.BUTTONS.LOT.CLOSE, `action-close-lot-${lotID}`),
    ]),
    disable_notification: true
  }).catch((error) => {
    console.log(error)
  })

})