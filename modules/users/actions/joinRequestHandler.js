const { Composer } = require("telegraf");
const knex = require('../../db/knex');
const { findMonthByChatId, getUser } = require('../../db/helpers');

/**
 * Get current month period in YYYY_MM format
 */
function getCurrentMonthPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}_${month}`;
}

module.exports = Composer.on('chat_join_request', async (ctx) => {
  try {
    const joinRequest = ctx.chatJoinRequest;
    const chatId = ctx.chat.id;
    const userId = joinRequest.from.id;
    
    console.log('🔔 Join request received:', {
      chatId,
      userId,
      username: joinRequest.from.username,
      firstName: joinRequest.from.first_name,
      mainGroupId: process.env.MAIN_GROUP_ID
    });
    
    // Determine group type and period by looking up in database
    let groupType, groupPeriod;
    
    if (chatId.toString() === process.env.MAIN_GROUP_ID) {
      // Main group - check for user-specific invitation
      groupType = 'main';
      groupPeriod = null;
    } else {
      // Check if this is a registered group in the database
      const monthInfo = await findMonthByChatId(chatId.toString());
      
      if (!monthInfo) {
        console.log(`❌ Join request for unknown group ${chatId}, ignoring`);
        return;
      }
      
      // This is a registered archive group
      groupType = monthInfo.type;
      groupPeriod = `${monthInfo.year}_${monthInfo.month}`;
      
      // Found group info
    }
    
    let hasAccess = false;
    
    // Check if user has admin roles that grant automatic access
    const userData = await getUser(userId);
    const userRoles = userData?.roles || [];
    
    // Admin role grants access to regular groups
    if (userRoles.includes('admin') && groupType === 'regular') {
      hasAccess = true;
      console.log(`✅ User ${userId} has admin role, granting access to regular group`);
    }
    
    // AdminPlus role grants access to plus groups
    if (userRoles.includes('adminPlus') && groupType === 'plus') {
      hasAccess = true;
      console.log(`✅ User ${userId} has adminPlus role, granting access to plus group`);
    }
    
    // If not an admin or admin doesn't have the right permissions, check normal access
    if (!hasAccess) {
      if (groupType === 'main') {
      // For main group, check if user has a valid invitation link
      const validInvitation = await knex('invitationLinks')
        .where('userId', Number(userId))
        .whereNull('usedAt')
        .where('groupType', 'main')
        .first();
      
      console.log(`🔍 Main group access check for user ${userId}:`, {
        hasValidInvitation: !!validInvitation,
        invitationId: validInvitation?.id,
        invitationLink: validInvitation?.telegramInviteLink
      });
      
      hasAccess = !!validInvitation;
    } else {
      // For archive groups, check if user has paid subscription for this period
      // Users with 'plus' access can join both 'regular' and 'plus' groups
      // Users with 'regular' access can only join 'regular' groups
      
      if (groupType === 'regular') {
        // For regular groups, check if user has either regular or plus subscription
        const subscription = await knex('userGroups')
          .where('userId', Number(userId))
          .where('period', groupPeriod)
          .whereIn('type', ['regular', 'plus'])
          .first();
        
        hasAccess = !!subscription;
      } else if (groupType === 'plus') {
        // For plus groups, only users with plus subscription can join
        const subscription = await knex('userGroups')
          .where('userId', Number(userId))
          .where('period', groupPeriod)
          .where('type', 'plus')
          .first();
        
        hasAccess = !!subscription;
      } else {
        // For other group types, use original logic
        const subscription = await knex('userGroups')
          .where('userId', Number(userId))
          .where('period', groupPeriod)
          .where('type', groupType)
          .first();
        
        hasAccess = !!subscription;
      }
    }
    }
    
    if (!hasAccess) {
      console.log(`❌ User ${userId} tried to join ${groupType} group without access, declining`);
      
      // Decline the join request
      try {
        await ctx.telegram.declineChatJoinRequest(chatId, userId);
        console.log(`✅ Declined join request for user ${userId}`);
        
        // Send notification to logs group
        const groupName = groupType === 'main' ? 'основную группу' : 
                         groupType === 'plus' ? 'плюс группу' : 'обычную группу';
        const reason = groupType === 'main' ? 'Нет действующего приглашения' : 
                      groupType === 'plus' ? 'Нет оплаченной плюс подписки на этот период' :
                      'Нет оплаченной подписки (обычной или плюс) на этот период';
        
        await ctx.telegram.sendMessage(process.env.LOGS_GROUP_ID,
          `❌ <b>Отклонена попытка входа в ${groupName}</b>\n\n` +
          `👤 <b>Пользователь:</b> ${joinRequest.from.first_name} ${joinRequest.from.last_name || ''}\n` +
          `🆔 <b>ID:</b> <code>${userId}</code>\n` +
          `📱 <b>Username:</b> ${joinRequest.from.username ? `@${joinRequest.from.username}` : 'Не указан'}\n` +
          `📅 <b>Дата:</b> ${new Date().toLocaleString('ru-RU')}\n` +
          `🔹 <b>Группа:</b> ${groupName}${groupPeriod ? ` (${groupPeriod})` : ''}\n\n` +
          `Причина: ${reason}`,
          { parse_mode: 'HTML' }
        );
      } catch (error) {
        console.error('Failed to decline join request:', error);
      }
      return;
    }
    
    // User has access - approve the join request
    console.log(`✅ User ${userId} has access to ${groupType} group, approving join request`);
    
    try {
      await ctx.telegram.approveChatJoinRequest(chatId, userId);
      console.log(`✅ Approved join request for user ${userId}`);
      
      // For main group, mark the invitation link as used
      if (groupType === 'main') {
        const validInvitation = await knex('invitationLinks')
          .where('userId', Number(userId))
          .whereNull('usedAt')
          .where('groupType', 'main')
          .first();
        
        if (validInvitation) {
          await knex('invitationLinks')
            .where('id', validInvitation.id)
            .update({
              usedAt: new Date(),
              useCount: 1,
              telegramInviteLinkIsRevoked: true
            });
        }
      }
      
      // Send welcome message to the user
      try {
        const groupName = groupType === 'main' ? 'основную группу' : 
                         groupType === 'plus' ? 'плюс группу' : 'обычную группу';
        const welcomeMessage = groupType === 'main' ? 
          '🎉 <b>Добро пожаловать в основную группу!</b>\n\n' +
          'Твоя заявка была одобрена и ты успешно присоединился к сообществу!\n\n' +
          'Теперь ты можешь пользоваться всеми возможностями бота.\n\n' +
          'Используй команду /start для доступа к главному меню.' :
          `🎉 <b>Добро пожаловать в ${groupName}!</b>\n\n` +
          `Твоя заявка была одобрена и ты успешно присоединился к архиву ${groupPeriod}!\n\n` +
          `Теперь у тебя есть доступ к материалам этого периода.\n\n` +
          `Используй команду /start для доступа к главному меню.`;
        
        await ctx.telegram.sendMessage(userId, welcomeMessage, { parse_mode: 'HTML' });
      } catch (error) {
        console.error('Failed to send welcome message to user:', error);
      }
      
      // Send notification to logs group
      try {
        const groupName = groupType === 'main' ? 'основную группу' : 
                         groupType === 'plus' ? 'плюс группу' : 'обычную группу';
        let accessReason;
        if (userRoles.includes('admin') && groupType === 'regular') {
          accessReason = 'Одобрено по правам администратора';
        } else if (userRoles.includes('adminPlus') && groupType === 'plus') {
          accessReason = 'Одобрено по правам администратора плюс';
        } else if (groupType === 'main') {
          accessReason = 'Одобрено по приглашению';
        } else if (groupType === 'plus') {
          accessReason = 'Одобрено по плюс подписке';
        } else {
          accessReason = 'Одобрено по подписке (обычной или плюс)';
        }
        
        await ctx.telegram.sendMessage(process.env.LOGS_GROUP_ID,
          `✅ <b>Пользователь присоединился к ${groupName}</b>\n\n` +
          `👤 <b>Пользователь:</b> ${joinRequest.from.first_name} ${joinRequest.from.last_name || ''}\n` +
          `🆔 <b>ID:</b> <code>${userId}</code>\n` +
          `📱 <b>Username:</b> ${joinRequest.from.username ? `@${joinRequest.from.username}` : 'Не указан'}\n` +
          `📅 <b>Дата:</b> ${new Date().toLocaleString('ru-RU')}\n` +
          `🔹 <b>Группа:</b> ${groupName}${groupPeriod ? ` (${groupPeriod})` : ''}\n\n` +
          `Статус: <b>${accessReason}</b>`,
          { parse_mode: 'HTML' }
        );
      } catch (error) {
        console.error('Failed to send notification to logs group:', error);
      }
      
    } catch (error) {
      console.error('Failed to approve join request:', error);
    }
    
  } catch (error) {
    console.error('Error in joinRequestHandler:', error);
  }
});
