const { Composer } = require("telegraf");
const knex = require('../../db/knex');
const { getUser } = require('../../db/helpers');
const { markInvitationUsed } = require('../menuSystem');

module.exports = Composer.on('new_chat_members', async (ctx) => {
  try {
    const newMembers = ctx.message.new_chat_members;
    const chatId = ctx.chat.id;
    
    // Check if this is the main group
    if (chatId.toString() !== process.env.MAIN_GROUP_ID) {
      return;
    }
    
    console.log('🎉 New members joined main group:', newMembers.map(m => `${m.first_name} (${m.id})`));
    
    for (const member of newMembers) {
      const userId = member.id;
      
      // Check if this user has an unused invitation link
      const existingLink = await knex('invitationLinks')
        .where('userId', Number(userId))
        .whereNull('usedAt')
        .first();
      
      if (existingLink) {
        console.log(`✅ User ${userId} joined with valid invitation link, marking as used`);
        
        // Mark the invitation link as used
        await knex('invitationLinks')
          .where('id', existingLink.id)
          .update({
            usedAt: new Date(),
            telegramInviteLinkIsRevoked: true
          });
        
        // Send confirmation message to the user
        try {
          await ctx.telegram.sendMessage(userId, 
            '🎉 <b>Добро пожаловать в основную группу!</b>\n\n' +
            'Ты успешно присоединился к сообществу!\n\n' +
            'Теперь ты можешь пользоваться всеми возможностями бота.\n\n' +
            'Используй команду /start для доступа к главному меню.',
            { parse_mode: 'HTML' }
          );
        } catch (error) {
          console.error('Failed to send welcome message to user:', error);
        }
        
        // Send notification to logs group
        try {
          await ctx.telegram.sendMessage(process.env.LOGS_GROUP_ID,
            `✅ <b>Пользователь присоединился к группе</b>\n\n` +
            `👤 <b>Пользователь:</b> ${member.first_name} ${member.last_name || ''}\n` +
            `🆔 <b>ID:</b> <code>${userId}</code>\n` +
            `📱 <b>Username:</b> ${member.username ? `@${member.username}` : 'Не указан'}\n` +
            `📅 <b>Дата:</b> ${new Date().toLocaleString('ru-RU')}`,
            { parse_mode: 'HTML' }
          );
        } catch (error) {
          console.error('Failed to send notification to logs group:', error);
        }
      }
    }
  } catch (error) {
    console.error('Error in groupJoinHandler:', error);
  }
});
