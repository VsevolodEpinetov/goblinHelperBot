const knex = require('../db/knex');
const achievementsConfig = require('../../configs/achievements');
const notifications = require('../../configs/notifications');

const YEARS_OF_SERVICE = 'years_of_service';

async function grantAchievement(adminUserId, targetUserId, achievementType, achievementData = {}) {
  await knex('user_achievements').insert({
    user_id: Number(targetUserId),
    achievement_type: achievementType,
    achievement_data: achievementData,
    is_public: true
  });

  await knex('level_management_log').insert({
    admin_user_id: Number(adminUserId),
    target_user_id: Number(targetUserId),
    action_type: 'grant_achievement',
    reason: achievementData.reason || null,
    metadata: achievementData
  });

  // Notify RPG topic if configured
  try {
    if (notifications.rpgTopicId && notifications.mainGroupId) {
      const title = (achievementsConfig[achievementType]?.title) || achievementType;
      
      // Get user data for tagging
      const { getUser } = require('../db/helpers');
      const userData = await getUser(targetUserId);
      const username = userData?.username ? `@${userData.username}` : userData?.first_name || `ID: ${targetUserId}`;
      
      await globalThis.__bot?.telegram.sendMessage(
        notifications.mainGroupId, 
        `🏆 ${username} получил достижение: ${title}`,
        { 
          parse_mode: 'HTML',
          message_thread_id: notifications.rpgTopicId 
        }
      );
    }
  } catch {}

  return { success: true };
}

async function revokeAchievement(adminUserId, targetUserId, achievementType) {
  await knex('user_achievements')
    .where({ user_id: Number(targetUserId), achievement_type: achievementType })
    .del();

  await knex('level_management_log').insert({
    admin_user_id: Number(adminUserId),
    target_user_id: Number(targetUserId),
    action_type: 'revoke_achievement'
  });

  return { success: true };
}

async function hasAchievement(userId, achievementType) {
  const row = await knex('user_achievements')
    .where({ user_id: Number(userId), achievement_type: achievementType })
    .first();
  return !!row;
}

async function hasYearsOfService(userId) {
  return await hasAchievement(userId, YEARS_OF_SERVICE);
}

function getAchievementMultiplier(achievementType) {
  const def = achievementsConfig[achievementType];
  if (!def) return 1.0;
  return typeof def.multiplier === 'number' ? def.multiplier : 1.0;
}

module.exports = {
  grantAchievement,
  revokeAchievement,
  hasAchievement,
  hasYearsOfService,
  getAchievementMultiplier,
  YEARS_OF_SERVICE
};


