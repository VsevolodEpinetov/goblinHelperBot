const knex = require('../db/knex');
const { createInvitationLink } = require('../invitationService');

/**
 * Get or create invitation link for a specific group period and type
 * @param {string} groupPeriod - Period like "2025_12"
 * @param {string} groupType - "regular" or "plus"
 * @returns {Object} - { success: boolean, link?: string, error?: string }
 */
async function getOrCreateGroupInvitationLink(groupPeriod, groupType) {
  try {
    console.log(`🔍 Looking for existing link for ${groupPeriod}_${groupType}`);
    
    // Check if there's already an active invitation link for this group
    const existingLink = await knex('invitationLinks')
      .where('groupPeriod', groupPeriod)
      .where('groupType', groupType)
      .whereNull('usedAt')
      .where('telegramInviteLinkIsRevoked', false)
      .first();

    // Check if existing link is still valid (not expired)
    if (existingLink && existingLink.telegramInviteLink) {
      const now = new Date();
      const isExpired = existingLink.telegramInviteLinkExpireDate && 
                       existingLink.telegramInviteLinkExpireDate < now;
      
      if (!isExpired) {
        // Returning existing valid link
        console.log(`✅ Using existing valid link for ${groupPeriod}_${groupType}`);
        return {
          success: true,
          link: existingLink.telegramInviteLink,
          linkId: existingLink.id,
          isNew: false
        };
      } else {
        // Link is expired, mark it as used and create a new one
        console.log(`⚠️ Existing link for ${groupPeriod}_${groupType} is expired, creating new one`);
        await knex('invitationLinks')
          .where('id', existingLink.id)
          .update({ usedAt: new Date() });
      }
    }

    // No existing link, need to create one
    // For group invitations, we'll use NULL userId to indicate it's a group link
    // We need to get the group ID from the database
    const monthInfo = await knex('months')
      .select('chatId')
      .where('period', groupPeriod)
      .where('type', groupType)
      .first();
    
    if (!monthInfo || !monthInfo.chatId) {
      return {
        success: false,
        error: `No group found for ${groupPeriod}_${groupType}`
      };
    }
    
    const groupLink = await createInvitationLink(null, monthInfo.chatId, groupPeriod, groupType);
    
    if (groupLink.success) {
      return {
        success: true,
        link: groupLink.inviteLink,
        linkId: groupLink.linkId,
        isNew: true
      };
    } else {
      return {
        success: false,
        error: groupLink.error
      };
    }
  } catch (error) {
    console.error('Error getting or creating group invitation link:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Record that a user needs notification when link is updated
 * @param {number} userId - User ID
 * @param {string} groupPeriod - Period like "2025_12"
 * @param {string} groupType - "regular" or "plus"
 */
async function requestLinkNotification(userId, groupPeriod, groupType) {
  try {
    // Check if user already has a pending notification request
    const existingRequest = await knex('linkNotificationRequests')
      .where('userId', Number(userId))
      .where('groupPeriod', groupPeriod)
      .where('groupType', groupType)
      .whereNull('notifiedAt')
      .first();

    if (!existingRequest) {
      await knex('linkNotificationRequests').insert({
        userId: Number(userId),
        groupPeriod,
        groupType,
        requestedAt: new Date()
      });
      console.log(`📧 Link notification requested for user ${userId} for ${groupPeriod}_${groupType}`);
    }
  } catch (error) {
    console.error('Error requesting link notification:', error);
  }
}

/**
 * Notify all users who requested notification for a specific group
 * @param {Object} telegram - Telegram API client
 * @param {string} groupPeriod - Period like "2025_12"
 * @param {string} groupType - "regular" or "plus"
 * @param {string} newLink - New invitation link
 */
async function notifyUsersOfNewLink(telegram, groupPeriod, groupType, newLink) {
  try {
    const notificationRequests = await knex('linkNotificationRequests')
      .where('groupPeriod', groupPeriod)
      .where('groupType', groupType)
      .whereNull('notifiedAt')
      .select('userId');

    console.log(`📧 Notifying ${notificationRequests.length} users about new link for ${groupPeriod}_${groupType}`);

    for (const request of notificationRequests) {
      try {
        await telegram.sendMessage(
          request.userId,
          `🔗 <b>Ссылка обновлена!</b>\n\n` +
          `Ссылка-приглашение для ${groupPeriod} (${groupType}) была обновлена.\n\n` +
          `🔗 <b>Новая ссылка:</b>\n` +
          `${newLink}\n\n` +
          `Попробуй снова!`,
          { parse_mode: 'HTML' }
        );

        // Mark as notified
        await knex('linkNotificationRequests')
          .where('id', request.id)
          .update({ notifiedAt: new Date() });

        console.log(`✅ Notified user ${request.userId}`);
      } catch (error) {
        console.error(`❌ Failed to notify user ${request.userId}:`, error);
      }
    }
  } catch (error) {
    console.error('Error notifying users of new link:', error);
  }
}

/**
 * Get current group period and type for a user based on their subscription
 * @param {number} userId - User ID
 * @returns {Object} - { groupPeriod: string, groupType: string } or null
 */
async function getUserCurrentGroup(userId) {
  try {
    // Get user's current subscription to determine what groups they have access to
    const currentPeriod = getCurrentMonthPeriod();
    
    const subscription = await knex('userGroups')
      .where('userId', Number(userId))
      .where('period', currentPeriod)
      .first();

    if (subscription) {
      // User has a subscription, return their group info
      return {
        groupPeriod: subscription.period,
        groupType: subscription.type
      };
    }

    // If no subscription, check if there are any available groups for the current period
    const availableGroups = await knex('invitationLinks')
      .select('groupPeriod', 'groupType')
      .where('groupPeriod', currentPeriod)
      .whereNull('userId') // Group links, not user-specific
      .whereNull('usedAt')
      .where('telegramInviteLinkIsRevoked', false)
      .groupBy('groupPeriod', 'groupType');

    if (availableGroups.length > 0) {
      // Return the first available group (or we could let user choose)
      const group = availableGroups[0];
      return {
        groupPeriod: group.groupPeriod,
        groupType: group.groupType
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting user current group:', error);
    return null;
  }
}

/**
 * Get current month period in YYYY_MM format
 */
function getCurrentMonthPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}_${month}`;
}

module.exports = {
  getOrCreateGroupInvitationLink,
  requestLinkNotification,
  notifyUsersOfNewLink,
  getUserCurrentGroup
};
