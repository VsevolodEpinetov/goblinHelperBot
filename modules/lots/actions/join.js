const { Composer, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const lotsUtils = require('../utils')
const util = require('../../util')

module.exports = Composer.action(/^action-join-lot-[0-9]+$/g, ctx => {
  util.log(ctx)
  const lotID = ctx.callbackQuery.data.split('action-join-lot-')[1];

  if (ctx.globalSession.lots[lotID].opened) {
    const userID = ctx.callbackQuery.from.id;

    let participants = ctx.globalSession.lots[lotID].participants;
    let alreadyParticipate = false;
    participants.forEach(p => {
      if (userID == p.id) alreadyParticipate = true;
    });

    if (!alreadyParticipate) {
      ctx.globalSession.lots[lotID].participants.push(ctx.callbackQuery.from);
      const lotData = ctx.globalSession.lots[lotID];

      let organizator = lotData.whoCreated?.first_name + ' ' + lotData.whoCreated?.last_name;
      if (lotData.whoCreated.username) organizator += ` (@${lotData.whoCreated.username})`

      let caption = lotsUtils.getLotCaption({
        author: lotData.author,
        name: lotData.name,
        link: lotData.link,
        price: lotData.price,
        organizator: organizator,
        status: true,
        participants: lotData.participants
      })

      ctx.replyWithPhoto(lotData.photo, {
        caption: caption,
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          Markup.button.callback(SETTINGS.BUTTONS.LOT.JOIN, `action-join-lot-${lotID}`),
          Markup.button.callback(SETTINGS.BUTTONS.LOT.CLOSE, `action-close-lot-${lotID}`),
        ]),
        message_thread_id: ctx.callbackQuery.message.message_thread_id ? ctx.callbackQuery.message.message_thread_id : null,
        disable_notification: true
      })

      ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch((error) => {
        ctx.editMessageCaption(ctx.callbackQuery.message.chat.id, ctx.callbackQuery.message.message_id, undefined, 'удалено', {
          parse_mode: 'HTML'
        })
        console.log(error)
      });
    } else {
      ctx.answerCbQuery(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.ALREADY_IN)
    }
  } else {
    ctx.answerCbQuery(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.ALREADY_CLOSED)
  }
})