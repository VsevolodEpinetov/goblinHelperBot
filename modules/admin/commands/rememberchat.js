const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')
const { setSetting } = require('../../db/helpers');

module.exports = Composer.command('rememberchat', async (ctx) => {
  util.log(ctx);
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) return;
  
  const chatName = ctx.message.text.split('/rememberchat ')[1];

  await ctx.deleteMessage();

  // Store chat info in PostgreSQL
  const chatInfo = {
    thread_id: ctx.message.chat.is_forum ? ctx.message.message_thread_id : 0,
    id: ctx.message.chat.id
  };
  
  await setSetting(`chats.${chatName}`, chatInfo);

  await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `⚙️ ${ctx.message.from.username ? `@${ctx.message.from.username}` : `${ctx.message.from.first_name}`} (${ctx.message.from.id}) set the chat '${chatName}'`)
})