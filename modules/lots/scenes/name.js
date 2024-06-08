const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js')
const lotsUtils = require('../utils')

const lotSceneNameStage = new Scenes.BaseScene('LOT_SCENE_NAME_STAGE');

lotSceneNameStage.enter(async (ctx) => {
  try {
    await ctx.replyWithHTML(`Отлично, автора тоже запомнил! Теперь последний этап - название лота. Обычно это может быть название набора/проекта, ну либо что-то другое\n\n<b>Этап:</b> 🗒 название`, {
      reply_to_message_id: ctx.session.lot.lastMessage.user,
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
      ]),
      message_thread_id: SETTINGS.TOPICS.GOBLIN.LOTS
    }).then(nctx => {
      ctx.session.lot.lastMessage.bot = nctx.message_id;
    })
  } catch (e) {
    console.log('Failed to reply to the message')
    console.log(e)
    await ctx.replyWithHTML(`Отлично, автора тоже запомнил! Теперь последний этап - название лота. Обычно это может быть название набора/проекта, ну либо что-то другое\n\n<b>Этап:</b> 🗒 название`, {
      reply_to_message_id: ctx.session.lot.lastMessage.user,
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
      ]),
      message_thread_id: SETTINGS.TOPICS.GOBLIN.LOTS
    }).then(nctx => {
      ctx.session.lot.lastMessage.bot = nctx.message_id;
    })
  }
});

lotSceneNameStage.on('text', async (ctx) => {
  ctx.session.lot.name = ctx.message.text;
  try {
    if (ctx.session.lot.lastMessage.bot) await ctx.deleteMessage(ctx.session.lot.lastMessage.bot);
  }
  catch (e) {
    console.log(e)
  }

  let organizator = ctx.session.lot.whoCreated?.first_name + ' ' + ctx.session.lot.whoCreated?.last_name;
  if (ctx.session.lot.whoCreated.username) organizator += ` (@${ctx.session.lot.whoCreated.username})`

  let lotInfo = ctx.session.lot;

  if (ctx.session.lot.photos.length < 2) {
    await ctx.replyWithPhoto(ctx.session.lot.photos[0], {
      caption: lotsUtils.getLotCaption(
        {
          author: lotInfo.author,
          name: lotInfo.name,
          link: lotInfo.link,
          price: lotInfo.price,
          currency: lotInfo.currency,
          organizator: organizator,
          status: true
        }
      ),
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.LOT.JOIN, `action-join-lot-${ctx.globalSession.lots.length}`),
        Markup.button.callback(SETTINGS.BUTTONS.LOT.CLOSE, `action-close-lot-${ctx.globalSession.lots.length}`),
      ]),
      message_thread_id: SETTINGS.TOPICS.GOBLIN.LOTS
    })
  } else {
    await ctx.replyWithMediaGroup(ctx.session.lot.photos.map((p, id) => {
      if (id == 0) {
        return {
          type: 'photo',
          media: p,
          caption: lotsUtils.getLotCaption(
            {
              author: lotInfo.author,
              name: lotInfo.name,
              link: lotInfo.link,
              price: lotInfo.price,
              currency: lotInfo.currency,
              organizator: organizator,
              status: true
            }
          ),
          parse_mode: "HTML"
        }
      } else {
        return { type: 'photo', media: p }
      }
    })).then(nctx => {
      ctx.session.lot.lastMessage.bot = nctx.message_id;
    })


    await ctx.reply('Присоединиться к лоту выше 👆', {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.LOT.JOIN, `action-join-lot-${ctx.globalSession.lots.length}`),
        Markup.button.callback(SETTINGS.BUTTONS.LOT.CLOSE, `action-close-lot-${ctx.globalSession.lots.length}`),
      ]),
      message_thread_id: SETTINGS.TOPICS.GOBLIN.LOTS
    })
  }


  return ctx.scene.leave();
});

lotSceneNameStage.action('actionStopLot', async (ctx) => {
  util.log(ctx)
  if (ctx.session.lot) {
    await ctx.replyWithHTML(`👌`, {
      message_thread_id: SETTINGS.TOPICS.GOBLIN.LOTS
    });
    try {
      if (ctx.session.lot.lastMessage.bot) await ctx.deleteMessage(ctx.session.lot.lastMessage.bot);
    }
    catch (e) {
      console.log(e)
    }
    ctx.session.lot = null;
    return ctx.scene.leave();
  } else {
    await ctx.answerCbQuery(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.NOT_CREATING_A_LOT)
  }
})

lotSceneNameStage.leave(async (ctx) => {
  if (!ctx.globalSession.lots) ctx.globalSession.lots = [];
  ctx.globalSession.lots.push(ctx.session.lot);
  ctx.session.lot = null;
});

module.exports = lotSceneNameStage;