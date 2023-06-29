const { Composer, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')
const emporiumUtils = require('../util.js')

module.exports = Composer.action(/^action-change-bg-races-[0-9]+$/g, async ctx => {
  util.log(ctx)
  const crID = ctx.callbackQuery.data.split('action-change-bg-races-')[1];
  if (ctx.globalSession.emporium.queue[crID]) {

    const queueData = ctx.globalSession.emporium.queue[crID];
    if (ctx.callbackQuery.from.id != SETTINGS.CHATS.EPINETOV && ctx.callbackQuery.from.id != SETTINGS.CHATS.ANN && ctx.callbackQuery.from.id != queueData.whoMade) {
      ctx.answerCbQuery('Ты не можешь это делать')
      return;
    }

    ctx.reply('Меняю фон...')
    try {
      const creatureData = queueData.data;
      const pathToBaseImage = emporiumUtils.getRandomBaseImageSingleFilter(creatureData.races)
      const resultImageBuffer = await emporiumUtils.placePngAndGetPic(ctx, queueData.transparentFileId, pathToBaseImage)
      ctx.globalSession.emporium.queue[crID].data.preview = {
        buffer: resultImageBuffer
      }
      ctx.deleteMessage(queueData.lastBotMessageId);
      ctx.replyWithDocument({ source: resultImageBuffer, filename: `${creatureData.code}.png` }, {
        caption: `Данные\n\nРасы: ${creatureData.races.join(', ')}\nКлассы: ${creatureData.classes.join(', ')}\nОружие: ${creatureData.weapons.join(', ')}\n\nСтудия: ${creatureData.studioName}\nРелиз: ${creatureData.releaseName}\nКод:${creatureData.code}\n\nПол: ${creatureData.sex}`,
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('♻️ Фон класс', `action-change-bg-classes-${crID}`),
            Markup.button.callback('♻️ Фон раса', `action-change-bg-races-${crID}`),
          ],
          [
            Markup.button.callback('♻️ Фон', `action-change-bg-any-${crID}`)
          ],
          [
            Markup.button.callback('✅ На подтверждение', `action-emporium-confirm-${crID}`),
          ]
        ])
      }).then(nctx => {
        ctx.globalSession.emporium.queue[crID].lastBotMessageId = nctx.message_id;
      })
    }
    catch (err) {
      console.log(err);
      ctx.reply('Что-то пошло не так. Попробуй ещё раз!')
    }

  } else {
    ctx.answerCbQuery('Нет такого в бд')
  }
})