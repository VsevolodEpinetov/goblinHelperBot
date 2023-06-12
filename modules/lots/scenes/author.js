const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js')

const lotSceneAuthorStage = new Scenes.BaseScene('LOT_SCENE_AUTHOR_STAGE');

lotSceneAuthorStage.enter((ctx) => {
  try {
    ctx.replyWithHTML(`Понял, всех буду отправлять <a href='${ctx.session.lot.link}'>сюда</a>. А если вкратце - кто автор моделек?`, {
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
    ctx.replyWithHTML(`Понял, всех буду отправлять <a href='${ctx.session.lot.link}'>сюда</a>. А если вкратце - кто автор моделек?`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
      ])
    }).then(nctx => {
      ctx.session.lot.lastMessage.bot = nctx.message_id;
    })
  }
});

lotSceneAuthorStage.on('text', (ctx) => {
  ctx.session.lot.author = ctx.message.text;
  ctx.session.lot.lastMessage.user = ctx.message.message_id;
  try {
    if (ctx.session.lot.lastMessage.bot) ctx.deleteMessage(ctx.session.lot.lastMessage.bot);
  }
  catch (e) {
    console.log(e)
  }
  return ctx.scene.enter('LOT_SCENE_NAME_STAGE');
});

lotSceneAuthorStage.action('actionStopLot', (ctx) => {
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

lotSceneAuthorStage.leave(async (ctx) => { });

module.exports = lotSceneAuthorStage;