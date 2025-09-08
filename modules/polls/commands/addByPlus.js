const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.hears('+', async (ctx) => {
  util.log(ctx)
  const isAnAdmin = ctx.message.from.id == SETTINGS.CHATS.EPINETOV || ctx.message.from.id == SETTINGS.CHATS.GLAVGOBLIN || ctx.message.from.id == SETTINGS.CHATS.ALEKS || ctx.message.from.id == SETTINGS.CHATS.ARTYOM;

  if (!isAnAdmin) { 
    return; 
  }

  if (!ctx.message.reply_to_message) {
    return;
  }

  const messageText = ctx.message.reply_to_message.text || ctx.message.reply_to_message.caption;

  const studioName = JSON.stringify(messageText).replaceAll('"', '').split('\\n')[0].trim();

  ctx.polls.studios.push(studioName);

  const addedMessage = await ctx.reply(`Added ${studioName} and sorted`);
  setTimeout(async () => {
    await ctx.deleteMessage(addedMessage.message_id);
  }, 5000);
})