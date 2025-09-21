const { Telegraf } = require('telegraf');
const knex = require('./db/knex');

/**
 * Invitation Link Service
 * Handles creation and management of Telegram invitation links
 */

// Create a bot instance for API calls
const bot = new Telegraf(process.env.TOKEN);

/**
 * Create a new invitation link for a user or group
 * @param {number} userId - User ID (0 for group links)
 * @param {string} groupId - Group ID (optional, defaults to MAIN_GROUP_ID)
 * @param {string} groupPeriod - Group period for group links (optional)
 * @param {string} groupType - Group type for group links (optional)
 */
async function createInvitationLink(userId, groupId = process.env.MAIN_GROUP_ID, groupPeriod = null, groupType = null) {
  try {
    console.log(`🔗 Creating invitation link for user ${userId} to group ${groupId}`);
    
    let username;
    let linkName;
    
    if (userId === null || userId === 0) {
      // Group link
      username = `Group ${groupPeriod}_${groupType}`;
      linkName = `bot-made for ${groupPeriod}_${groupType}`;
    } else {
      // User link - get user info from database instead of Telegram API
      const { getUser } = require('./db/helpers');
      const userData = await getUser(userId);
      if (userData) {
        username = userData.username !== 'not_set' ? `@${userData.username}` : userData.first_name || `User ${userId}`;
        linkName = `bot-made for ${username}`;
      } else {
        username = `User ${userId}`;
        linkName = `bot-made for ${username}`;
      }
    }
    
    // Create invitation link using Telegram API with approval mode
    // For group links (monthly archives), use longer expiration (90 days)
    // For user links, use shorter expiration (7 days)
    const isGroupLink = userId === null || userId === 0;
    const expirationDays = isGroupLink ? 90 : 7; // 90 days for group links, 7 days for user links
    
    const inviteLink = await bot.telegram.createChatInviteLink(groupId, {
      name: linkName,
      expire_date: Math.floor(Date.now() / 1000) + (expirationDays * 24 * 60 * 60),
      creates_join_request: true // Enable approval mode - requires admin approval
      // Note: member_limit can't be used with creates_join_request
    });
    
    console.log(`✅ Created invitation link (expires in ${expirationDays} days): ${inviteLink.invite_link}`);
    
    // Determine group type
    let finalGroupType;
    if (groupType) {
      finalGroupType = groupType;
    } else if (groupId === process.env.MAIN_GROUP_ID) {
      finalGroupType = 'main';
    } else {
      finalGroupType = 'regular';
    }
    
    // Store the link in database
    const linkId = await knex('invitationLinks').insert({
      userId: userId === null || userId === 0 ? null : Number(userId),
      groupPeriod: groupPeriod || 'main', // Use provided period or 'main' for user links
      groupType: finalGroupType,
      telegramInviteLink: inviteLink.invite_link,
      telegramInviteLinkName: inviteLink.name,
      telegramInviteLinkCreatorId: inviteLink.creator?.id,
      telegramInviteLinkIsPrimary: inviteLink.is_primary || false,
      telegramInviteLinkIsRevoked: inviteLink.is_revoked || false,
      telegramInviteLinkExpireDate: inviteLink.expire_date ? new Date(inviteLink.expire_date * 1000) : null,
      telegramInviteLinkMemberLimit: inviteLink.member_limit || 1,
      createsJoinRequest: inviteLink.creates_join_request || true,
      useCount: 0,
      createdAt: new Date()
    }).returning('id');
    
    return {
      success: true,
      linkId: linkId[0],
      inviteLink: inviteLink.invite_link,
      groupPeriod: groupPeriod || inviteLink.invite_link.split('/').pop()
    };
  } catch (error) {
    console.error('❌ Error creating invitation link:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Revoke an invitation link
 */
async function revokeInvitationLink(userId) {
  try {
    // Get the user's unused invitation link
    const existingLink = await knex('invitationLinks')
      .where('userId', userId)
      .whereNull('usedAt')
      .first();
    
    if (!existingLink) {
      return { success: false, error: 'No unused invitation link found' };
    }
    
    // Try to revoke the link (this might not work if it's already used)
    try {
      await bot.telegram.revokeChatInviteLink(
        existingLink.groupType === 'main' ? process.env.MAIN_GROUP_ID : process.env.MAIN_GROUP_ID,
        existingLink.groupPeriod
      );
    } catch (revokeError) {
      console.log('⚠️ Could not revoke link (might be already used):', revokeError.message);
    }
    
    // Mark as used in database
    await knex('invitationLinks')
      .where('id', existingLink.id)
      .update({
        usedAt: new Date()
      });
    
    return { success: true };
  } catch (error) {
    console.error('❌ Error revoking invitation link:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get user's invitation link if it exists
 */
async function getUserInvitationLink(userId) {
  try {
    const existingLink = await knex('invitationLinks')
      .where('userId', Number(userId))
      .whereNull('usedAt')
      .where('useCount', 0)
      .first();
    
    if (existingLink) {
      return {
        success: true,
        inviteLink: existingLink.telegramInviteLink,
        groupPeriod: existingLink.groupPeriod,
        groupType: existingLink.groupType
      };
    }
    
    return { success: false, error: 'No unused invitation link found' };
  } catch (error) {
    console.error('❌ Error getting user invitation link:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  createInvitationLink,
  revokeInvitationLink,
  getUserInvitationLink
};
