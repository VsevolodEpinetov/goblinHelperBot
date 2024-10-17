const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.command('rememberchat', async (ctx) => {
  util.log(ctx);
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) return;
  
  const chatName = ctx.message.text.split('/rememberchat ')[1];

  if (!ctx.settings) ctx.settings = {}
  if (!ctx.settings.chats) ctx.settings.chats = {}

  await ctx.deleteMessage();

  ctx.settings.chats[chatName] = {
    thread_id: ctx.message.chat.is_forum ? ctx.message.message_thread_id : 0,
    id: ctx.message.chat.id
  }

  await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `⚙️ ${ctx.message.from.username ? `@${ctx.message.from.username}` : `${ctx.message.from.first_name}`} (${ctx.message.from.id}) set the chat '${chatName}'`)
})