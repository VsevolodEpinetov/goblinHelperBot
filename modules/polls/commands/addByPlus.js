const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')
const { hasPermission } = require('../../rbac')
const { getUser } = require('../../db/helpers')

module.exports = Composer.hears('+', async (ctx) => {
  util.log(ctx)
  
  // Check permissions using new RBAC system
  const userData = await getUser(ctx.message.from.id);
  if (!userData || !hasPermission(userData.roles, 'admin:polls:create')) {
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