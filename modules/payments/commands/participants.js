const { Composer, Markup } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.command('participants', async (ctx) => {
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) { return; }

  if (!ctx.globalSession.participants) ctx.globalSession.participants = {};
  
  let message = `<b><i>Участники Бережливого Гоблина</i></b>\n\n`;

  console.log(ctx.globalSession.participants);
  
  ctx.reply(`Сейчас в БГ ${Object.keys(ctx.globalSession.participants).length} участников`)
})