const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.command('remember', async (ctx) => {
  util.log(ctx);
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) return;
  
  const name = ctx.message.text.split(' ')[1], value = ctx.message.text.split(' ')[2];

  if (!ctx.settings) ctx.settings = {}

  await ctx.deleteMessage();

  ctx.settings[name] = value;

  await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `⚙️ ${ctx.message.from.username ? `@${ctx.message.from.username}` : `${ctx.message.from.first_name}`} (${ctx.message.from.id}) set the '${name}' to '${value}'`)
})