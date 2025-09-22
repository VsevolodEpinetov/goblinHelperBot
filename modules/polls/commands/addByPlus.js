const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')
const { hasPermission } = require('../../rbac')
const { getUser } = require('../../db/helpers')
const { addStudio } = require('../../db/polls')

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

  // Add studio to dynamic studios in database
  const success = await addStudio(studioName);
  
  if (success) {
    const addedMessage = await ctx.reply(`Added ${studioName} to polls`);
    setTimeout(async () => {
      await ctx.deleteMessage(addedMessage.message_id);
    }, 5000);
  } else {
    const errorMessage = await ctx.reply(`Studio ${studioName} already exists in polls`);
    setTimeout(async () => {
      await ctx.deleteMessage(errorMessage.message_id);
    }, 5000);
  }
})