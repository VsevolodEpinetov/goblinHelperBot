const { Composer, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const lotsUtils = require('../utils');
const util = require('../../util');

module.exports = Composer.action(/^action-join-lot-[0-9]+$/g, async ctx => {
  try {
    util.log(ctx);
    const lotID = parseInt(ctx.callbackQuery.data.split('action-join-lot-')[1]);

    if (!ctx.globalSession.lots[lotID]) {
      return await ctx.answerCbQuery(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.LOT_NOT_FOUND);
    }

    if (!ctx.globalSession.lots[lotID].opened) {
      return await ctx.answerCbQuery(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.ALREADY_CLOSED);
    }

    const userID = ctx.callbackQuery.from.id;
    let participants = ctx.globalSession.lots[lotID].participants;

    if (participants.some(p => p.id === userID)) {
      return await ctx.answerCbQuery(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.ALREADY_IN);
    }

    ctx.globalSession.lots[lotID].participants.push(ctx.callbackQuery.from);
    const lotData = ctx.globalSession.lots[lotID];

    let organizator = lotData.whoCreated?.first_name + ' ' + lotData.whoCreated?.last_name;
    if (lotData.whoCreated.username) organizator += ` (@${lotData.whoCreated.username})`;

    let caption = lotsUtils.getLotCaption({
      author: lotData.author,
      name: lotData.name,
      link: lotData.link,
      price: lotData.price,
      currency: lotData.currency,
      organizator: organizator,
      status: true,
      participants: lotData.participants,
      photos: lotData.photos
    });

    if (lotData.photos.length > 1) {
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
      }).then(nctx => {
        ctx.globalSession.lots[lotID].lastMessage.bot = nctx.message_id;
      })


      await ctx.reply('Присоединиться к лоту выше 👆', {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          Markup.button.callback(SETTINGS.BUTTONS.LOT.JOIN, `action-join-lot-${lotID}`),
          Markup.button.callback(SETTINGS.BUTTONS.LOT.CLOSE, `action-close-lot-${lotID}`),
        ]),
        message_thread_id: SETTINGS.TOPICS.GOBLIN.LOTS
      })
    } else {
      await ctx.replyWithPhoto(lotData.photos[0], {
        caption: caption,
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          Markup.button.callback(SETTINGS.BUTTONS.LOT.JOIN, `action-join-lot-${lotID}`),
          Markup.button.callback(SETTINGS.BUTTONS.LOT.CLOSE, `action-close-lot-${lotID}`)
        ]),
        message_thread_id: ctx.callbackQuery.message.message_thread_id ? ctx.callbackQuery.message.message_thread_id : null,
        disable_notification: true
      });
    }

    try {
      await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
    } catch (deleteError) {
      await ctx.editMessageCaption(ctx.callbackQuery.message.message_id, 'удалено', {
        parse_mode: 'HTML'
      });
      console.error('Failed to delete message:', deleteError);
    }

  } catch (error) {
    console.error('Failed to join lot:', error);
    await ctx.reply(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.JOIN_ERROR);
  }
});
