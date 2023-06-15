const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js')

const lotScenePhotoStage = new Scenes.BaseScene('LOT_SCENE_PHOTO_STAGE');

lotScenePhotoStage.enter((ctx) => {
  if (!ctx.globalSession.lots) ctx.globalSession.lots = [];
  ctx.session.lot = SETTINGS.EMPTY_LOT;
  ctx.replyWithHTML(SETTINGS.MESSAGES.CREATE_LOT.GREETING, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
    ])
  }).then(nctx => {
    ctx.session.lot.lastMessage.bot = nctx.message_id;
  })
});

lotScenePhotoStage.on('photo', (ctx) => {
  ctx.session.lot = {
    ...ctx.session.lot,
    photo: ctx.message.photo[0].file_id,
    user: ctx.message.message_id,
    whoCreated: ctx.message.from
  }
  try {
    if (ctx.session.lot.lastMessage.bot) ctx.deleteMessage(ctx.session.lot.lastMessage.bot);
  }
  catch (e) {
    console.log(e)
  }
  return ctx.scene.enter('LOT_SCENE_PRICE_STAGE');
})

lotScenePhotoStage.on('document', (ctx) => {
  ctx.replyWithHTML(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.NOT_A_PHOTO, {
    reply_to_message_id: ctx.message.message_id
  }).catch((error) => {
    console.log("Error! Couldn't reply to a message, just sending a message")
    ctx.replyWithHTML(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.NOT_A_PHOTO)
  })
})

lotScenePhotoStage.on('message', (ctx) => {
  ctx.replyWithHTML(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.WAITING_FOR_A_PHOTO, {
    parse_mode: 'HTML',
    reply_to_message_id: ctx.message.message_id,
    ...Markup.inlineKeyboard([
      Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
    ])
  })
})

lotScenePhotoStage.command('exit', (ctx) => {
  ctx.scene.leave();
})

lotScenePhotoStage.action('actionStopLot', (ctx) => {
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

lotScenePhotoStage.leave(async (ctx) => {
});

module.exports = lotScenePhotoStage;