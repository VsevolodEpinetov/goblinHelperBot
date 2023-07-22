const { Composer, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')
const emporiumUtils = require('../util.js')

module.exports = Composer.action(/^action-change-bg-exact-[0-9]+$/g, async ctx => {
  util.log(ctx)
  const crID = ctx.callbackQuery.data.split('action-change-bg-exact-')[1];
  if (ctx.globalSession.emporium.queue[crID]) {
    const queueData = ctx.globalSession.emporium.queue[crID];
    ctx.deleteMessage(queueData.lastBotMessageId).catch(e => {
      console.log(e)
    })
    ctx.session.passingId = crID;
    ctx.scene.enter('EMPORIUM_STAGE_EXACT_PHOTO');
  } else {
    ctx.answerCbQuery('Нет такого в бд')
  }
})