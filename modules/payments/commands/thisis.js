const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.command('thisis', async (ctx) => {
  console.log('hi')
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) { return; }

  if (!ctx.globalSession.months) ctx.globalSession.months = {};
  if (!ctx.globalSession.currentMonth) ctx.globalSession.currentMonth = '';
  
  let monthName = ctx.message.text.split('thisis ')[1];
  let isPlus = false;
  if (monthName.indexOf('plus') > 0) {
    isPlus = true;
    monthName = monthName.split(' plus')[0];
  }

  if (!ctx.globalSession.months[monthName].chats) ctx.globalSession.months[monthName].chats = {}
  if (!isPlus) {
    ctx.globalSession.months[monthName].chats.base = ctx.message.chat.id
    ctx.reply(`Записал базовый чат ${ctx.message.chat.id} под именем ${monthName}`)
  }
  else {
    ctx.globalSession.months[monthName].chats.plus = ctx.message.chat.id
    ctx.reply(`Записал плюсовый чат ${ctx.message.chat.id} под именем ${monthName}`)
  }
})