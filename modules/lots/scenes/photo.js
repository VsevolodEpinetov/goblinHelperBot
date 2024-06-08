const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js')

const lotScenePhotoStage = new Scenes.BaseScene('LOT_SCENE_PHOTO_STAGE');

lotScenePhotoStage.enter(async (ctx) => {
  try {
    if (!ctx.globalSession.lots) ctx.globalSession.lots = [];
    ctx.session.lot = SETTINGS.EMPTY_LOT;
    ctx.session.lot.photos = [];
    await ctx.replyWithHTML(`Лоты - это прекрасно, лоты - это чудесно! Пришли мне превьюшки для лота. Любое количество от 1 до 10 картинок. \n\n<b>Этап:</b> 🖼 картинки\n<b>Загружено:</b> 0/10\n\n⚠️<i><b>ВАЖНО:</b> загружать картинки обязательно по одной штуке, иначе всё взорвётся!</i>`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
      ]),
      message_thread_id: SETTINGS.TOPICS.GOBLIN.LOTS
    }).then(nctx => {
      ctx.session.lot.lastMessage.bot = nctx.message_id;
    })
  } catch (e) {
    console.error('Failed to enter photo scene:', e);
  }
});

lotScenePhotoStage.on('photo', async (ctx) => {
  try {
    ctx.session.lot.photos.push(ctx.message.photo[ctx.message.photo.length - 1].file_id);
    try {
      if (ctx.session.lot.lastMessage.bot) await ctx.deleteMessage(ctx.session.lot.lastMessage.bot);
    }
    catch (e) {
      console.log(e)
    }
    await ctx.replyWithHTML(`Добавил картинку!\n\n<b>Этап:</b> 🖼 картинки\n<b>Загружено:</b> ${ctx.session.lot.photos.length}/10\n\n⚠️<i><b>ВАЖНО:</b> загружать картинки обязательно по одной штуке, иначе всё взорвётся!</i>`, {
      parse_mode: 'HTML',
      reply_to_message_id: ctx.message.message_id,
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot'),
        Markup.button.callback(`👍 Этих хватит (${ctx.session.lot.photos.length})`, 'finishPhotoUpload')
      ]),
      message_thread_id: SETTINGS.TOPICS.GOBLIN.LOTS
    }).then(nctx => {
      ctx.session.lot.lastMessage.bot = nctx.message_id;
    });
  } catch (e) {
    console.error('Failed to handle photo message:', e);
  }
})

lotScenePhotoStage.on('document', async (ctx) => {
  try {
    await ctx.replyWithHTML(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.NOT_A_PHOTO, {
      reply_to_message_id: ctx.message.message_id,
      message_thread_id: SETTINGS.TOPICS.GOBLIN.LOTS
    })
  } catch (e) {
    console.error('Failed to handle document message:', e);
  }
})

lotScenePhotoStage.on('message', async (ctx) => {
  try {
    await ctx.replyWithHTML(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.WAITING_FOR_A_PHOTO, {
      parse_mode: 'HTML',
      reply_to_message_id: ctx.message.message_id,
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
      ]),
      message_thread_id: SETTINGS.TOPICS.GOBLIN.LOTS
    })
  } catch (e) {
    console.error('Failed to handle non-photo message:', e);
  }
})

lotScenePhotoStage.action('finishPhotoUpload', async (ctx) => {
  try {
    ctx.session.lot = {
      ...ctx.session.lot,
      whoCreated: ctx.callbackQuery.from
    }
    if (ctx.session.lot.photos.length > 0) {
      try {
        if (ctx.session.lot.lastMessage.bot) await ctx.deleteMessage(ctx.session.lot.lastMessage.bot);
      } catch (e) {
        console.error('Failed to delete message:', e);
      }
      await ctx.scene.enter('LOT_SCENE_PRICE_STAGE');
    } else {
      await ctx.replyWithHTML(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.NO_PHOTOS_UPLOADED);
    }
  } catch (e) {
    console.error('Failed to finish photo upload:', e);
  }
});

lotScenePhotoStage.command('exit', (ctx) => {
  ctx.scene.leave();
})

lotScenePhotoStage.action('actionStopLot', async (ctx) => {
  try {
    util.log(ctx)
    if (ctx.session.lot) {
      await ctx.replyWithHTML(`👌`, {
        message_thread_id: SETTINGS.TOPICS.GOBLIN.LOTS
      });
      try {
        if (ctx.session.lot.lastMessage.bot) await ctx.deleteMessage(ctx.session.lot.lastMessage.bot);
      } catch (e) {
        console.error('Failed to delete message:', e);
      }
      ctx.session.lot = null;
      await ctx.scene.leave();
    } else {
      await ctx.answerCbQuery(SETTINGS.MESSAGES.CREATE_LOT.ERRORS.NOT_CREATING_A_LOT)
    }
  } catch (e) {
    console.error('Failed to handle stop lot action:', e);
  }
})

lotScenePhotoStage.leave(async (ctx) => { });

module.exports = lotScenePhotoStage;
