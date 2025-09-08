const { Composer } = require('telegraf');

console.log('🔧 Logger middleware: Loading...');

/**
 * Comprehensive logging middleware
 * Logs all updates without interfering with the flow
 */
const logger = new Composer();

// Log all updates - use middleware instead of on('update')
logger.use(async (ctx, next) => {
  console.log('🔧 Logger middleware: Processing update...');
  
  // Get the actual update type (skip update_id)
  const updateKeys = Object.keys(ctx.update).filter(key => key !== 'update_id');
  const updateType = updateKeys[0] || 'unknown';
  const update = ctx.update[updateType];
  
  // Special handling for commands
  if (updateType === 'message' && update.text?.startsWith('/')) {
    console.log('🎯 COMMAND DETECTED:', update.text);
  }
  
  console.log('🔄 Update received:', {
    type: updateType,
    timestamp: new Date().toISOString(),
    userId: ctx.from?.id,
    username: ctx.from?.username,
    chatId: ctx.chat?.id,
    chatType: ctx.chat?.type
  });

  // Log specific update details
  switch (updateType) {
    case 'message':
      const isCommand = update.text?.startsWith('/');
      console.log('📨 Message details:', {
        text: update.text?.substring(0, 100),
        isCommand: isCommand,
        command: isCommand ? update.text.split(' ')[0] : null,
        hasPhoto: !!update.photo,
        hasDocument: !!update.document,
        hasSticker: !!update.sticker
      });
      
      // Special logging for commands
      if (isCommand) {
        console.log('🎯 COMMAND MESSAGE:', update.text);
        if (update.text === '/start') {
          console.log('🚀 /start command detected in logger middleware!');
        }
      }
      break;
      
    case 'callback_query':
      console.log('🔘 Callback query details:', {
        data: update.data,
        messageId: update.message?.message_id
      });
      break;
      
    case 'edited_message':
      console.log('✏️ Edited message details:', {
        text: update.text?.substring(0, 100),
        editDate: update.edit_date
      });
      break;
      
    case 'chat_join_request':
      console.log('🚪 Chat join request details:', {
        chatId: update.chat.id,
        chatTitle: update.chat.title,
        fromUserId: update.from.id
      });
      break;
      
    case 'my_chat_member':
      console.log('👤 Chat member update details:', {
        chatId: update.chat.id,
        status: update.new_chat_member?.status,
        oldStatus: update.old_chat_member?.status
      });
      break;
      
    case 'inline_query':
      console.log('🔍 Inline query details:', {
        query: update.query,
        offset: update.offset
      });
      break;
  }

  // Always call next() to pass control to the next middleware
  console.log('🔧 Logger middleware: Calling next()...');
  try {
    const result = await next();
    console.log('🔧 Logger middleware: next() completed successfully');
    return result;
  } catch (error) {
    console.log('❌ Error in logger middleware next():', error);
    // Re-throw to maintain error propagation
    throw error;
  }
});

module.exports = logger;
