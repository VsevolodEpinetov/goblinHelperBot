const { Composer } = require('telegraf');

/**
 * Clean logging middleware - only logs meaningful interactions
 */
const logger = new Composer();

logger.use(async (ctx, next) => {
  // Only log meaningful interactions
  const updateType = Object.keys(ctx.update).filter(key => key !== 'update_id')[0];
  const update = ctx.update[updateType];
  
  // Log commands in private chats
  if (updateType === 'message' && update.text?.startsWith('/') && ctx.chat?.type === 'private') {
    const userId = ctx.from?.id;
    const username = ctx.from?.username;
    const command = update.text.split(' ')[0];
    console.log(`🎯 Command: ${command} from ${userId} (@${username || 'no_username'})`);
  }
  
  // Log callback queries (button presses)
  if (updateType === 'callback_query' && ctx.chat?.type === 'private') {
    const userId = ctx.from?.id;
    const username = ctx.from?.username;
    const action = update.data;
    console.log(`🔘 Action: ${action} from ${userId} (@${username || 'no_username'})`);
  }
  
  // Log chat join requests
  if (updateType === 'chat_join_request') {
    const userId = update.from.id;
    const username = update.from.username;
    console.log(`🚪 Join Request: ${userId} (@${username || 'no_username'}) to ${update.chat.title}`);
  }

  try {
    return await next();
  } catch (error) {
    console.error('❌ Error in middleware chain:', error);
    throw error;
  }
});

module.exports = logger;
