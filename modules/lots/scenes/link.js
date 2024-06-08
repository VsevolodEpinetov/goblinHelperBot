const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js')

const lotSceneLinkStage = new Scenes.BaseScene('LOT_SCENE_LINK_STAGE');

lotSceneLinkStage.enter(async (ctx) => {
  try {
    await ctx.replyWithHTML(`Стоимость лота записал, спасибо! Пришли описание лота, чтобы было понимание, что это такое. Можно ссылку, если оно понятно будет\n\n<b>Этап:</b> ✍️ описание\n\nℹ️ <i><b>Для информации:</b> краткость - сестра таланта! Если описание слишком большое, то всё может взорваться</i>`, {
      reply_to_message_id: ctx.session.lot.lastMessage.user,
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
      ])
    }).then(nctx => {
      ctx.session.lot.lastMessage.bot = nctx.message_id;
    })
  }
  catch (e) {
    console.log('Failed to reply to the message')
    console.log(e)
    await ctx.replyWithHTML(`Стоимость лота записал, спасибо! Пришли описание лота, чтобы было понимание, что это такое. Можно ссылку, если оно понятно будет\n\n<b>Этап:</b> ✍️ описание`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
      ])
    }).then(nctx => {
      ctx.session.lot.lastMessage.bot = nctx.message_id;
    })
  }
});

lotSceneLinkStage.on('text', async (ctx) => {
  ctx.session.lot.link = ctx.message.text;
  ctx.session.lot.lastMessage.user = ctx.message.message_id;
  try {
    if (ctx.session.lot.lastMessage.bot) await ctx.deleteMessage(ctx.session.lot.lastMessage.bot);
  }
  catch (e) {
    console.log(e)
  }
  return ctx.scene.enter('LOT_SCENE_AUTHOR_STAGE');
});

lotSceneLinkStage.action('actionStopLot', async (ctx) => {
  util.log(ctx)
  if (ctx.session.lot) {
    await ctx.replyWithHTML(`👌`);
    try {
      if (ctx.session.lot.lastMessage.bot) await ctx.deleteMessage(ctx.session.lot.lastMessage.bot);
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

lotSceneLinkStage.leave(async (ctx) => { });

module.exports = lotSceneLinkStage;