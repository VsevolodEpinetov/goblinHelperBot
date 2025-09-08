const { Markup } = require('telegraf');
const SETTINGS = require('../../../settings.json');

module.exports = async (ctx) => {
  try {
    console.log('🔍 /info command triggered by user:', ctx.from.id);
    console.log('🔍 Chat ID:', ctx.chat.id);
    console.log('🔍 Message ID:', ctx.message.message_id);
    
    // Delete the command message
    await ctx.deleteMessage();
    
    // Get basic chat information
    const chatInfo = {
      chatId: ctx.chat.id,
      chatType: ctx.chat.type,
      chatTitle: ctx.chat.title || 'Private Chat',
      topicId: ctx.message?.message_thread_id || 'Not a topic',
      isTopic: !!ctx.message?.message_thread_id
    };
    
    // Get user information (from command sender)
    const userInfo = {
      userId: ctx.from.id,
      username: ctx.from.username || 'not_set',
      firstName: ctx.from.first_name || '',
      lastName: ctx.from.last_name || '',
      isBot: ctx.from.is_bot || false,
      languageCode: ctx.from.language_code || 'not_set'
    };
    
    // Check if this is a reply to another message
    let repliedUserInfo = null;
    if (ctx.message.reply_to_message) {
      const repliedUser = ctx.message.reply_to_message.from;
      repliedUserInfo = {
        userId: repliedUser.id,
        username: repliedUser.username || 'not_set',
        firstName: repliedUser.first_name || '',
        lastName: repliedUser.last_name || '',
        isBot: repliedUser.is_bot || false,
        languageCode: repliedUser.language_code || 'not_set'
      };
    }
    
    // Format the information message
    let message = `🔍 <b>Информация о чате и пользователях</b>\n\n`;
    
    // Chat information
    message += `💬 <b>Информация о чате:</b>\n`;
    message += `• <b>ID чата:</b> <code>${chatInfo.chatId}</code>\n`;
    message += `• <b>Тип чата:</b> ${chatInfo.chatType}\n`;
    message += `• <b>Название:</b> ${chatInfo.chatTitle}\n`;
    message += `• <b>ID топика:</b> <code>${chatInfo.topicId}</code>\n`;
    message += `• <b>Это топик:</b> ${chatInfo.isTopic ? '✅ Да' : '❌ Нет'}\n\n`;
    
    // Command sender information
    message += `👤 <b>Отправитель команды:</b>\n`;
    message += `• <b>ID пользователя:</b> <code>${userInfo.userId}</code>\n`;
    message += `• <b>Username:</b> @${userInfo.username}\n`;
    message += `• <b>Имя:</b> ${userInfo.firstName} ${userInfo.lastName}\n`;
    message += `• <b>Бот:</b> ${userInfo.isBot ? '✅ Да' : '❌ Нет'}\n`;
    message += `• <b>Язык:</b> ${userInfo.languageCode}\n\n`;
    
    // Replied user information (if exists)
    if (repliedUserInfo) {
      message += `👥 <b>Пользователь в ответе:</b>\n`;
      message += `• <b>ID пользователя:</b> <code>${repliedUserInfo.userId}</code>\n`;
      message += `• <b>Username:</b> @${repliedUserInfo.username}\n`;
      message += `• <b>Имя:</b> ${repliedUserInfo.firstName} ${repliedUserInfo.lastName}\n`;
      message += `• <b>Бот:</b> ${repliedUserInfo.isBot ? '✅ Да' : '❌ Нет'}\n`;
      message += `• <b>Язык:</b> ${repliedUserInfo.languageCode}\n\n`;
    }
    
    // Additional context information
    message += `📊 <b>Дополнительная информация:</b>\n`;
    message += `• <b>Время сообщения:</b> ${new Date().toLocaleString('ru-RU')}\n`;
    message += `• <b>Тип сообщения:</b> ${ctx.message.message_id ? 'Команда' : 'Неизвестно'}\n`;
    message += `• <b>ID сообщения:</b> <code>${ctx.message.message_id}</code>\n`;
    
    // Add EPINETOV and GLAVGOBLIN check
    if (userInfo.userId.toString() === SETTINGS.CHATS.EPINETOV || userInfo.userId.toString() === SETTINGS.CHATS.GLAVGOBLIN) {
      message += `• <b>Статус:</b> 🔥 АДМИНИСТРАТОР\n`;
    }
    
    // Add message thread information if available
    if (ctx.message?.message_thread_id) {
      message += `• <b>Топик активен:</b> ✅ Да\n`;
    }
    
    // Add reply information if this is a reply
    if (ctx.message.reply_to_message) {
      message += `• <b>Ответ на сообщение:</b> ✅ Да\n`;
      message += `• <b>ID ответного сообщения:</b> <code>${ctx.message.reply_to_message.message_id}</code>\n`;
    }
    
    // Send to user's DMs
    await ctx.telegram.sendMessage(
      userInfo.userId,
      message,
      {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }
    );
    
    // Send confirmation to the original chat
    const confirmMessage = `✅ Информация отправлена в личные сообщения`;
    await ctx.reply(confirmMessage, { 
      reply_to_message_id: ctx.message.message_id 
    });
    
  } catch (error) {
    console.error('Error in /info command:', error);
    
    // Try to send error message to user's DMs
    try {
      await ctx.telegram.sendMessage(
        ctx.from.id,
        `❌ <b>Ошибка выполнения команды /info</b>\n\n` +
        `Произошла ошибка при получении информации. Попробуйте позже.`,
        { parse_mode: 'HTML' }
      );
    } catch (dmError) {
      console.error('Failed to send error message to DMs:', dmError);
    }
  }
};
