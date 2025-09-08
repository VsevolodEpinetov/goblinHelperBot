const { Composer } = require('telegraf')
const SETTINGS = require('../../../settings.json');

// New raid trigger - only works in DMs
module.exports = Composer.hears(/^[гГ]облины[,]? на рейд[!]?$/g, async (ctx, next) => {
  console.log('🔍 Raid trigger matched! Chat ID:', ctx.message.chat.id);
  console.log('🔍 Chat type:', ctx.message.chat.type);
  
  // Only allow in private chats (DMs)
  if (ctx.message.chat.type !== 'private') {
    console.log('🔍 Not a private chat, calling next()');
    return next();
  }
  
  console.log('🔍 Processing raid creation in DM...');
  await ctx.deleteMessage(ctx.message.message_id)
  ctx.scene.enter('RAID_SCENE_PHOTO_STAGE');
})
