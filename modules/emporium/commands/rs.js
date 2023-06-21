const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.command('rs', async (ctx) => {
  util.log(ctx)
  if (
    ctx.message.from.id != SETTINGS.CHATS.EPINETOV
  ) { return; }

  const studioName = ctx.message.text.split('/rs ')[1];
  if (ctx.globalSession.emporium.studios[studioName]) {
    ctx.globalSession.emporium.studios[studioName] = undefined;
    ctx.reply(`Убрал студию ${studioName}`)
  } else {
    ctx.reply('Нет такой студии')
  }
})