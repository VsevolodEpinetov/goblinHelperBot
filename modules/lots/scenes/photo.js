const { Scenes, Markup } = require("telegraf");
const lotsUtils = require('../utils');
const util = require('../../util');
const SETTINGS = require('../../../settings.json')

const lotScenePhotoStage = new Scenes.BaseScene('LOT_SCENE_PHOTO_STAGE');

// Helper function to send the initial message in the photo stage
async function sendInitialPhotoMessage(ctx) {
  const sentMessage = await ctx.replyWithHTML(
    `Лоты - это прекрасно, лоты - это чудесно! Пришли мне превьюшки для лота. Любое количество от 1 до 10 картинок. \n\n<b>Этап:</b> 🖼 картинки\n<b>Загружено:</b> 0/10\n\n⚠️<i><b>ВАЖНО:</b> загружать картинки обязательно по одной штуке, иначе всё взорвётся!</i>`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot')
      ])
    }
  );

  // Store the chatID and messageID in the session for future reference
  ctx.session.lot.chatID = sentMessage.chat.id;
  ctx.session.lot.messageID = sentMessage.message_id;
}

// Helper function to update the photo stage message with the current number of photos
async function updatePhotoMessage(ctx) {
  const photoCount = ctx.session.lot.photos.length;

  await lotsUtils.updateLotCreationMessage(ctx,
    `Лоты - это прекрасно, лоты - это чудесно! Пришли мне превьюшки для лота. Любое количество от 1 до 10 картинок. \n\n<b>Этап:</b> 🖼 картинки\n<b>Загружено:</b> ${photoCount}/10`,
    [
      Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot'),
      ...(photoCount > 0 ? [Markup.button.callback(`👍 Этих хватит (${photoCount})`, 'finishPhotoUpload')] : [])
    ]
  )
}

lotScenePhotoStage.enter(async (ctx) => {
  lotsUtils.initializeLotSession(ctx);
  await sendInitialPhotoMessage(ctx);
});

lotScenePhotoStage.on('photo', async (ctx) => {
  ctx.session.lot.photos.push(ctx.message.photo[ctx.message.photo.length - 1].file_id);
  await ctx.deleteMessage(ctx.message.message_id);
  await updatePhotoMessage(ctx);

  // Automatically move to the next stage if 10 photos are uploaded
  if (ctx.session.lot.photos.length >= 10) {
    return ctx.scene.enter('LOT_SCENE_PRICE_STAGE');
  }
});

lotScenePhotoStage.on('text', async (ctx) => {
  await ctx.deleteMessage(ctx.message.message_id);

  const photoCount = ctx.session.lot.photos.length;
  await lotsUtils.updateLotCreationMessage(ctx,
    `⚠️ <b>Ожидаю картинки, а не текст! Если картинок уже достаточно, то нажми соответствующую кнопку!</b>⚠️\n\n<b>Этап:</b> 🖼 картинки\n<b>Загружено:</b> ${photoCount}/10`,
    [
      Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot'),
      ...(photoCount > 0 ? [Markup.button.callback(`👍 Этих хватит (${photoCount})`, 'finishPhotoUpload')] : [])
    ]
  );
});

lotScenePhotoStage.on('document', async (ctx) => {
  await ctx.deleteMessage(ctx.message.message_id);

  const photoCount = ctx.session.lot.photos.length;
  await lotsUtils.updateLotCreationMessage(ctx,
    `⚠️ <b>Ты прислал документ, а не картинку! Пришли, пожалуйста, картинку</b>⚠️\n\n<blockquote>Чтобы прислать картинку, при отправлении в телегу выбери пункт, чтобы телеграм сжал её</blockquote>\n\n<b>Этап:</b> 🖼 картинки\n<b>Загружено:</b> ${photoCount}/10`,
    [
      Markup.button.callback(SETTINGS.BUTTONS.CREATE_LOT.CANCEL, 'actionStopLot'),
      ...(photoCount > 0 ? [Markup.button.callback(`👍 Этих хватит (${photoCount})`, 'finishPhotoUpload')] : [])
    ]
  );
});

lotScenePhotoStage.action('finishPhotoUpload', async (ctx) => {
  return ctx.scene.enter('LOT_SCENE_PRICE_STAGE');
});

lotScenePhotoStage.action('actionStopLot', (ctx) => {
  if (ctx.callbackQuery.from.id == ctx.session.lot.whoCreated.id) {
    ctx.deleteMessage(ctx.callbackQuery.message.message_id)
    ctx.session.lot = null;
  }
})

module.exports = lotScenePhotoStage;
 