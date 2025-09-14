const { Markup } = require("telegraf");
const { createInvitationLink, getUserInvitationLink } = require('../../invitationService');
const { getMainUserMenu } = require('./mainUserMenu');

/**
 * Check if user has already joined the group (has a used invitation link OR is an existing customer)
 */
async function checkIfUserJoinedGroup(userId) {
  const knex = require('../../db/knex');
  
  try {
    const usedLink = await knex('invitationLinks')
      .where('userId', Number(userId))
      .whereNotNull('usedAt')
      .where('useCount', '>', 0)
      .first();
    
    if (usedLink) {
      return true;
    }
    
    const purchaseHistory = await knex('userGroups')
      .where('userId', Number(userId))
      .count('* as count')
      .first();
    
    const hasPurchases = purchaseHistory && parseInt(purchaseHistory.count) > 0;
    
    if (hasPurchases) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking if user joined group:', error);
    return false;
  }
}

/**
 * Menu for approved users (goblin, admin, adminPlus)
 * This is where the invitation link logic happens
 */
async function getApprovedUserMenu(ctx, userData) {
  const userId = ctx.from.id;
  
  const hasJoinedGroup = await checkIfUserJoinedGroup(userId);
  
  if (hasJoinedGroup) {
    return getMainUserMenu(ctx, userData);
  }
  
  const existingLinkResult = await getUserInvitationLink(userId);
  let inviteLink;
  
  if (existingLinkResult.success) {
    inviteLink = existingLinkResult.inviteLink;
  } else {
    const linkResult = await createInvitationLink(userId);
    
    if (linkResult.success) {
      console.log(`🔗 Invitation Link: Created for user ${userId} (@${userData.username})`);
      inviteLink = linkResult.inviteLink;
    } else {
      console.error(`❌ Invitation Link Failed: User ${userId} - ${linkResult.error}`);
      return getMainUserMenu(ctx, userData);
    }
  }
  
  return {
    message: `🍻 <b>Гоблины подняли кружки!</b>\n\n` +
             `Ты прошёл обряд допуска и теперь наш.\n` +
             `Входи в логово, зови себя гоблином и ворчи вместе с нами.\n\n` +
             `🔗 <b>Твоя персональная ссылка:</b>\n` +
             `${inviteLink}\n\n` +
             `⚠️ Помни:\n` +
             `• Ссылка одноразовая, берегись терять.\n` +
             `• После входа протухнет.\n` +
             `• Потерял — бухти в чат, гоблины помогут.`,
    keyboard: [
      [Markup.button.callback('✅ Уже ворчу с гоблинами', 'confirmGroupJoin')],
      [Markup.button.callback('❓ Где тут выход, а где вход?', 'userHelp')]
    ]
  };  
}

/**
 * Mark invitation link as used
 */
async function markInvitationUsed(userId) {
  const knex = require('../../db/knex');
  
  try {
    await knex('invitationLinks')
      .where('userId', Number(userId))
      .whereNull('usedAt')
      .update({
        usedAt: new Date(),
        useCount: 1
      });
    
    return { success: true };
  } catch (error) {
    console.error('Error marking invitation as used:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { getApprovedUserMenu, markInvitationUsed };
