const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.on('channel_post', async (ctx) => {
  console.log('hey')

  const channelID = ctx.channelPost.chat.id;
  const messageText = ctx.channelPost.text

  let monthName = messageText.split('thisis ')[1];
  let isPlus = false;
  if (monthName.indexOf('plus') > 0) {
    isPlus = true;
    monthName = monthName.split(' plus')[0];
  }

  if (!ctx.globalSession.months[monthName].chats) ctx.globalSession.months[monthName].chats = {}
  if (!isPlus) {
    ctx.globalSession.months[monthName].chats.base = channelID
    ctx.reply(`Записал базовый канал ${channelID} под именем ${monthName}`)
  }
  else {
    ctx.globalSession.months[monthName].chats.plus = channelID
    ctx.reply(`Записал плюсовый канал ${channelID} под именем ${monthName}`)
  }
})