const { Composer } = require("telegraf");
const util = require('../util')

module.exports = Composer.command('id', (ctx) => {
  util.log(ctx);
  if (ctx.message.chat.from < 0) return;
  else {
    ctx.reply(`Твой telegramID: ${ctx.message.from.id}`);
  }
})