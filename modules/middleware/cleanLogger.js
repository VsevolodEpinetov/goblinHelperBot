const { Composer } = require('telegraf');

/**
 * Clean, minimal logging middleware
 * Only logs meaningful user interactions with specific format
 */
const cleanLogger = new Composer();

cleanLogger.use(async (ctx, next) => {
  const updateType = Object.keys(ctx.update).filter(key => key !== 'update_id')[0];
  const update = ctx.update[updateType];
  
  // Get user info
  const userId = ctx.from?.id;
  const username = ctx.from?.username;
  const chatType = ctx.chat?.type;
  const chatTitle = ctx.chat?.title;
  const chatId = ctx.chat?.id;
  
  // Format location string
  const location = chatType === 'private' ? 'DMs' : `${chatTitle} (${chatId})`;
  
  // Get current time
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  // Log commands
  if (updateType === 'message' && update.text?.startsWith('/')) {
    const command = update.text.split(' ')[0];
    console.log(`${timeStr} [INFO] User @${username || 'unknown'} (${userId}) used command ${command} in the ${location}`);
  }
  
  // Log callback queries (actions)
  if (updateType === 'callback_query') {
    const action = update.data;
    console.log(`${timeStr} [INFO] User @${username || 'unknown'} (${userId}) called action ${action} in the ${location}`);
  }
  
  // Log chat join requests
  if (updateType === 'chat_join_request') {
    console.log(`${timeStr} [INFO] User @${username || 'unknown'} (${userId}) requested to join ${update.chat.title} (${update.chat.id})`);
  }

  try {
    return await next();
  } catch (error) {
    console.error('❌ Error in middleware chain:', error);
    throw error;
  }
});

module.exports = cleanLogger;
