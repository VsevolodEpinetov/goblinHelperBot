const { Composer, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')
const emporiumUtils = require('../util.js')

module.exports = Composer.action(/^action-emporium-confirm-[0-9]+$/g, async ctx => {
  util.log(ctx)
  const crID = ctx.callbackQuery.data.split('action-emporium-confirm-')[1];
  if (ctx.globalSession.emporium.queue[crID]) {

    const queueData = ctx.globalSession.emporium.queue[crID];
    if (ctx.callbackQuery.from.id != SETTINGS.CHATS.EPINETOV && ctx.callbackQuery.from.id != SETTINGS.CHATS.ANN && ctx.callbackQuery.from.id != queueData.whoMade) {
      ctx.answerCbQuery('Ты не можешь это делать')
      return;
    }

    try {
      const creatureData = queueData.data;
      const resultImageBuffer = Buffer.from(creatureData.preview.buffer.data, 'binary');
      let caption;
      if (!creatureData.isWH) caption = `Данные\n\nРасы: ${creatureData.races.join(', ')}\nКлассы: ${creatureData.classes.join(', ')}\nОружие: ${creatureData.weapons.join(', ')}\n\nСтудия: ${creatureData.studioName}\nРелиз: ${creatureData.releaseName}\nКод:${creatureData.code}\n\nПол: ${creatureData.sex}`
      else caption = `Данные\n\nФракции: ${creatureData.factions.join(', ')}\nТипы: ${creatureData.whTypes.join(', ')}\n\nСтудия: ${creatureData.studioName}\nРелиз: ${creatureData.releaseName}\nКод:${creatureData.code}`
      ctx.deleteMessage(queueData.lastBotMessageId);
      ctx.replyWithDocument({ source: resultImageBuffer, filename: `${creatureData.code}.png` }, {
        caption: caption,
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          Markup.button.callback('✅ Всё отлично', `action-emporium-publish-${crID}`),
          Markup.button.callback('❌ Что-то не так', `action-emporium-cancel-${crID}`),
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