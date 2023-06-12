const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js')

const lotScenePriceStage = new Scenes.BaseScene('LOT_SCENE_PRICE_STAGE');

lotScenePriceStage.enter((ctx) => {
  try {
    ctx.replyWithHTML(SETTINGS.MESSAGES.CREATE_LOT.ASK_PRICE, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
      ])
    }).then(nctx => {
      ctx.session.lot.lastMessage.bot = nctx.message_id;
    })
  }
  catch (e) {
    console.log('Failed to reply to the message from the user')
    ctx.replyWithHTML(SETTINGS.MESSAGES.CREATE_LOT.ASK_PRICE, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
      ])
    }).then(nctx => {
      ctx.session.lot.lastMessage.bot = nctx.message_id;
    })
  }
});

lotScenePriceStage.on('text', (ctx) => {
  ctx.session.lot.price = parseFloat(ctx.message.text);
  ctx.session.lot.lastMessage.user = ctx.message.message_id;
  try {
    if (ctx.session.lot.lastMessage.bot) ctx.deleteMessage(ctx.session.lot.lastMessage.bot);
  }
  catch (e) {
    console.log(e)
  }
  return ctx.scene.enter('LOT_SCENE_LINK_STAGE');
});

lotScenePriceStage.action('actionStopLot', (ctx) => {
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

lotScenePriceStage.leave(async (ctx) => { });

module.exports = lotScenePriceStage;