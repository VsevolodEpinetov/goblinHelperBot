const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json');
const { getSetting, setSetting } = require('../../db/helpers');
const util = require('../../util')

module.exports = Composer.command('remember', async (ctx) => {
  util.log(ctx);
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV && ctx.message.from.id != SETTINGS.CHATS.GLAVGOBLIN) return;
  
  const name = ctx.message.text.split(' ')[1], value = ctx.message.text.split(' ')[2];

  await ctx.deleteMessage();

  // Save setting to database
  await setSetting(name, value);

  await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `⚙️ ${ctx.message.from.username ? `@${ctx.message.from.username}` : `${ctx.message.from.first_name}`} (${ctx.message.from.id}) set the '${name}' to '${value}'`)
})