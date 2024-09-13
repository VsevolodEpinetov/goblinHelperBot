const { Composer, Markup } = require('telegraf');
const lotsUtils = require('../utils')
const SETTINGS = require('../../../settings.json');

module.exports = Composer.command('infom', (ctx) => {
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) {
    return;
  }

  console.log(ctx.message.reply_to_message.chat.id);
  console.log(ctx.message.reply_to_message.message_id);
})