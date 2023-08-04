const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js');
const emporiumUtils = require('../util.js')

const emporiumPhotoStage = new Scenes.BaseScene('EMPORIUM_CLASSES_PHOTO');

emporiumPhotoStage.enter((ctx) => {
  const creatureData = ctx.session.emporium.creatureData;
  let message = ``;
  if (!creatureData.isWH) message = `Записал указанное тобой оружие: ${creatureData.weapons.map(w => `${w}`).join(' ')}`
  else message = `Записал указанные тобой типы: ${creatureData.whTypes.map(w => `${w}`).join(' ')}`
  ctx.replyWithHTML(`Записал указанное тобой оружие: ${creatureData.whTypes.map(w => `${w}`).join(' ')} Пришли документом превью миниатюрки`, {
    parse_mode: 'HTML'
  }).then(nctx => {
    ctx.session.emporium.botData.lastMessage.bot = nctx.message_id;
  })
});

emporiumPhotoStage.on('document', async (ctx) => {
  const creatureData = ctx.session.emporium.creatureData;
  let pathToBaseImage; 
  if (!creatureData.isWH) pathToBaseImage = await emporiumUtils.getRandomBaseImageRacesAndClasses(creatureData.races, creatureData.classes)
  else pathToBaseImage = await emporiumUtils.getRandomBaseImageSingleFilter(creatureData.factions)
  const resultImageBuffer = await emporiumUtils.placePngAndGetPic(ctx, ctx.message.document.file_id, pathToBaseImage)
  ctx.session.emporium.creatureData.preview = {
    buffer: resultImageBuffer
  };
  const id = ctx.globalSession.emporium.queue.length;
  ctx.globalSession.emporium.queue.push({
    data: ctx.session.emporium.creatureData,
    status: 'waiting',
    whoMade: ctx.message.from.id,
    transparentFileId: ctx.message.document.file_id
  })
  try {
    ctx.deleteMessage(ctx.session.emporium.botData.lastMessage.bot);
  }
  catch (err) {
    console.log(err);
  }
  let caption;
  if (!creatureData.isWH) caption = `Данные\n\nРасы: ${creatureData.races.join(', ')}\nКлассы: ${creatureData.classes.join(', ')}\nОружие: ${creatureData.weapons.join(', ')}\n\nСтудия: ${creatureData.studioName}\nРелиз: ${creatureData.releaseName}\nКод:${creatureData.code}\n\nПол: ${creatureData.sex}`
  else caption = `Данные\n\nФракции: ${creatureData.factions.join(', ')}\nТипы: ${creatureData.whTypes.join(', ')}\n\nСтудия: ${creatureData.studioName}\nРелиз: ${creatureData.releaseName}\nКод:${creatureData.code}`
  ctx.replyWithDocument({ source: resultImageBuffer, filename: `${creatureData.code}.png` }, {
    caption: caption,
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('⚔️ Фон класс', `action-change-bg-classes-${id}`),
        Markup.button.callback('🧝‍♀️ Фон раса', `action-change-bg-races-${id}`),
      ],
      [ 
        Markup.button.callback('⚔️🧝‍♀️ Фон К+Р', `action-change-bg-any-${id}`)
      ],
      [
        Markup.button.callback('♻️ Фон рандом', `action-change-bg-random-${id}`),
        Markup.button.callback('📍 Фон конкретный', `action-change-bg-exact-${id}`),
      ],
      [
        Markup.button.callback('✅ На подтверждение', `action-emporium-confirm-${id}`)
      ]
    ])
  }).then(nctx => {
    ctx.globalSession.emporium.queue[id].lastBotMessageId = nctx.message_id;
  })

  ctx.scene.leave();
})

emporiumPhotoStage.command('exit', (ctx) => {
  util.log(ctx)
  ctx.scene.leave();
})

emporiumPhotoStage.leave(async (ctx) => {
});

module.exports = emporiumPhotoStage;