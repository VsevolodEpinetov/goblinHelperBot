const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const lotsUtils = require('../utils')
const util = require('../../util')

module.exports = Composer.action(/^action-close-lot-[0-9]+$/g, async ctx => {
  util.log(ctx)
  const lotID = ctx.callbackQuery.data.split('action-close-lot-')[1];

  if (ctx.globalSession.lots[lotID].opened) {
    const userID = ctx.callbackQuery.from.id;
    const lotData = ctx.globalSession.lots[lotID];

    if (userID == lotData.whoCreated.id || userID == SETTINGS.CHATS.EPINETOV) {
      let organizator = lotData.whoCreated?.first_name + ' ' + lotData.whoCreated?.last_name;
      if (lotData.whoCreated.username) organizator += ` (@${lotData.whoCreated.username})`

      let caption = lotsUtils.getLotCaption(
        {
          author: lotData.author,
          name: lotData.name,
          link: lotData.link,
          price: lotData.price,
          currency: lotData.currency,
          organizator: organizator,
          status: false,
          participants: lotData.participants
        }
      )

      if (ctx.globalSession.lots[lotID].photos.length > 1) {
        try {
          if (lotData.lastMessage.bot) await ctx.deleteMessage(lotData.lastMessage.bot);
        }
        catch (e) {
          console.log(e)
        }
  
        await ctx.replyWithMediaGroup(lotData.photos.map((p, id) => {
          if (id == 0) {
            return {
              type: 'photo',
              media: p,
              caption: caption,
              parse_mode: "HTML"
            }
          } else {
            return { type: 'photo', media: p }
          }
        }), {
          message_thread_id: SETTINGS.TOPICS.GOBLIN.LOTS
        })
      } else {
        await ctx.replyWithPhoto(lotData.photos[0], {
          caption: caption,
          parse_mode: 'HTML',
          message_thread_id: SETTINGS.TOPICS.GOBLIN.LOTS
        })
      }

      ctx.globalSession.lots[lotID] = null;
      
      await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(async (error) => {
        await ctx.editMessageCaption(ctx.callbackQuery.message.message_id, undefined, 'удалено', {
          parse_mode: 'HTML'
        })
        console.log(error)
      });
    } else {
      await ctx.answerCbQuery(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.NOT_A_CREATOR)
    }
  } else {
    await ctx.answerCbQuery(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.ALREADY_CLOSED)
  }
})