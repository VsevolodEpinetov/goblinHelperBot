const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')
const { ensureRoles } = require('../../rbac')
const { addStudio } = require('../../db/polls')

const POLLS_ROLES = ['polls', 'adminPolls', 'admin', 'adminPlus', 'super'];

module.exports = Composer.hears('+', async (ctx) => {
  util.log(ctx)

  const check = await ensureRoles(ctx, POLLS_ROLES);
  if (!check.allowed) return;

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