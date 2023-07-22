const { Scenes, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const util = require('../../util.js');
const emporiumUtils = require('../util.js')

const emporiumExactPhotoStage = new Scenes.BaseScene('EMPORIUM_STAGE_EXACT_PHOTO');

emporiumExactPhotoStage.enter((ctx) => {
  const id = ctx.session.passingId;
  ctx.replyWithHTML(`Пришли название картинки с <a href="https://disk.yandex.ru/d/mWaGAzRqlSBRLQ">Я.Диска</a> БЕЗ РАСШИРЕНИЯ. Например: <code>human8</code>. Если изображение не будет найдено, то будет использовано рандомное`, {
    parse_mode: 'HTML'
  }).then(nctx => {
    ctx.globalSession.emporium.queue[id].lastBotMessageId = nctx.message_id;
  })
});

emporiumExactPhotoStage.command('exit', (ctx) => {
  util.log(ctx)
  ctx.scene.leave();
})


emporiumExactPhotoStage.on('message', async (ctx) => {
  const crID = ctx.session.passingId;
  const queueData = ctx.globalSession.emporium.queue[crID];
  const creatureData = queueData.data;

  const userFileName = ctx.message.text;
  const pathToBaseImage = await emporiumUtils.getExactImage(userFileName);
  const resultImageBuffer = await emporiumUtils.placePngAndGetPic(ctx, queueData.transparentFileId, pathToBaseImage)
  ctx.globalSession.emporium.queue[crID].data.preview = {
    buffer: resultImageBuffer
  }

  ctx.deleteMessage(queueData.lastBotMessageId).catch(e => {
    console.log(e)
  })
  
  ctx.reply('Меняю фон...')
  ctx.replyWithDocument({ source: resultImageBuffer, filename: `${creatureData.code}.png` }, {
    caption: `Данные\n\nРасы: ${creatureData.races.join(', ')}\nКлассы: ${creatureData.classes.join(', ')}\nОружие: ${creatureData.weapons.join(', ')}\n\nСтудия: ${creatureData.studioName}\nРелиз: ${creatureData.releaseName}\nКод:${creatureData.code}\n\nПол: ${creatureData.sex}`,
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('⚔️ Фон класс', `action-change-bg-classes-${crID}`),
        Markup.button.callback('🧝‍♀️ Фон раса', `action-change-bg-races-${crID}`),
      ],
      [ 
        Markup.button.callback('⚔️🧝‍♀️ Фон К+Р', `action-change-bg-any-${crID}`)
      ],
      [
        Markup.button.callback('♻️ Фон рандом', `action-change-bg-random-${crID}`),
        Markup.button.callback('📍 Фон конкретный', `action-change-bg-exact-${crID}`),
      ],
      [
        Markup.button.callback('✅ На подтверждение', `action-emporium-confirm-${crID}`)
      ]
    ])
  }).then(nctx => {
    ctx.globalSession.emporium.queue[crID].lastBotMessageId = nctx.message_id;
  })

  ctx.scene.leave();
})

emporiumExactPhotoStage.leave(async (ctx) => {
});

module.exports = emporiumExactPhotoStage;