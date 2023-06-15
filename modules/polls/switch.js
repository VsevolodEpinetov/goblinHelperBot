const { Composer } = require("telegraf");
const SETTINGS = require('../../settings.json')
const STUDIOS = require('../../studios.json')
const util = require('../util')

module.exports = Composer.command('switch', async (ctx) => {
  util.log(ctx)
  if (
    ctx.message.chat.id != SETTINGS.CHATS.EPINETOV && 
    ctx.message.chat.id != SETTINGS.CHATS.TEST &&
    ctx.message.chat.id != SETTINGS.CHATS.GOBLIN
  ) { return; }

  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV && ctx.message.from.id != SETTINGS.CHATS.ALEKS) { return; }

  if (!ctx.globalSession.studios) {
    ctx.reply('Сначала используй /sync!')
    return;
  }

  const params = ctx.message.text.split('/switch ')[1];
  const list = ctx.message.text.indexOf(',') > -1 ? params.split(',') : [params];
  let successPart = `Новый статус:`
  let failedPart = `Не нашёл студии:\n`

  list.forEach((item, id) => {
    let index = -1;
    for (let i = 0; i < ctx.globalSession.studios.length; i++) {
      if (ctx.globalSession.studios[i].name == item) {
        index = i;
        break;
      }
    }
    if (index > -1) {
      successPart += `\n${item}: ${ctx.globalSession.studios[index].bought} -> ${!ctx.globalSession.studios[index].bought}`
      ctx.globalSession.studios[index].bought = !ctx.globalSession.studios[index].bought;
    } else {
      failedPart += `\n${item}`;
    }
  })

  ctx.reply(`${successPart}\n\n${failedPart}`)
})