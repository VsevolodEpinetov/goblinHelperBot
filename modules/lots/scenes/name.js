const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js')
const lotsUtils = require('../utils')

const lotSceneNameStage = new Scenes.BaseScene('LOT_SCENE_NAME_STAGE');

lotSceneNameStage.enter((ctx) => {
  try {
    ctx.replyWithHTML(`<b>${ctx.session.lot.author}</b>... Кажется, я это раньше где-то слышал 🤔 А набор как называется?`, {
      reply_to_message_id: ctx.session.lot.lastMessage.user,
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
      ])
    }).then(nctx => {
      ctx.session.lot.lastMessage.bot = nctx.message_id;
    })
  } catch (e) {
    console.log('Failed to reply to the message')
    console.log(e)
    ctx.replyWithHTML(`<b>${ctx.session.lot.author}</b>... Кажется, я это раньше где-то слышал 🤔 А набор как называется?`, {
      reply_to_message_id: ctx.session.lot.lastMessage.user,
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
      ])
    }).then(nctx => {
      ctx.session.lot.lastMessage.bot = nctx.message_id;
    })
  }
});

lotSceneNameStage.on('text', (ctx) => {
  ctx.session.lot.name = ctx.message.text;
  try {
    if (ctx.session.lot.lastMessage.bot) ctx.deleteMessage(ctx.session.lot.lastMessage.bot);
  }
  catch (e) {
    console.log(e)
  }

  let organizator = ctx.session.lot.whoCreated?.first_name + ' ' + ctx.session.lot.whoCreated?.last_name;
  if (ctx.session.lot.whoCreated.username) organizator += ` (@${ctx.session.lot.whoCreated.username})`

  let lotInfo = ctx.session.lot;

  ctx.replyWithPhoto(ctx.session.lot.photo, {
    caption: lotsUtils.getLotCaption(
      {
        author: lotInfo.author,
        name: lotInfo.name,
        link: lotInfo.link,
        price: lotInfo.price,
        organizator: organizator,
        status: true
      }
    ),
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      Markup.button.callback(SETTINGS.BUTTONS.LOT.JOIN, `action-join-lot-${ctx.globalSession.lots.length}`),
      Markup.button.callback(SETTINGS.BUTTONS.LOT.CLOSE, `action-close-lot-${ctx.globalSession.lots.length}`),
    ])
  })

  return ctx.scene.leave();
});

lotSceneNameStage.action('actionStopLot', (ctx) => {
  util.log(ctx)
  if (ctx.session.lot) {
    ctx.replyWithHTML(`👌`);
    try {
      if (ctx.session.lot.lastMessage.bot) ctx.deleteMessage(ctx.session.lot.lastMessage.bot);
    }
    catch (e) {
      console.log(e)
    }
    ctx.session.lot = null;
    return ctx.scene.leave();
  } else {
    ctx.answerCbQuery(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.NOT_CREATING_A_LOT)
  }
})

lotSceneNameStage.leave(async (ctx) => {
  if (!ctx.globalSession.lots) ctx.globalSession.lots = [];
  ctx.globalSession.lots.push(ctx.session.lot);
  ctx.session.lot = null;
});

module.exports = lotSceneNameStage;