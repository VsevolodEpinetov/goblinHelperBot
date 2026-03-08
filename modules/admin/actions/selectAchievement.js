const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { grantAchievement, revokeAchievement, hasAchievement } = require('../../loyalty/achievementsService');
const achievementsConfig = require('../../../configs/achievements');
const notifications = require('../../../configs/notifications');
const knex = require('../../db/knex');
const { ensureRoles } = require('../../rbac');

const SUPER_ROLES = ['super'];

const adminUserAchievements = Composer.action(/^admin_user_achievements_\d+$/g, async (ctx) => {
  const check = await ensureRoles(ctx, SUPER_ROLES);
  if (!check.allowed) return;
  try { await ctx.answerCbQuery(); } catch {}
  
  const userId = ctx.callbackQuery.data.split('_').pop();
  
  // Get user data
  const userData = await getUser(userId);
  if (!userData) {
    await ctx.reply('❌ Пользователь не найден');
    return;
  }

  // Get user's current achievements
  const userAchievements = await getUserAchievements(userId);
  
  // Build message
  const username = userData.username || userData.first_name || `ID: ${userId}`;
  const message = `🏆 <b>Управление достижениями</b>\n\n` +
    `👤 <b>Пользователь:</b> ${username}\n` +
    `🆔 <b>ID:</b> ${userId}\n\n` +
    `📊 <b>Текущие достижения:</b>\n${formatUserAchievements(userAchievements)}\n\n` +
    `Выберите действие:`;

  // Build keyboard with available achievements
  const keyboard = [];
  const availableAchievements = Object.keys(achievementsConfig);
  
  // Group achievements by 2 per row
  for (let i = 0; i < availableAchievements.length; i += 2) {
    const row = [];
    for (let j = 0; j < 2 && i + j < availableAchievements.length; j++) {
      const achievementType = availableAchievements[i + j];
      const hasIt = userAchievements.includes(achievementType);
      const buttonText = `${hasIt ? '✅' : '➕'} ${achievementsConfig[achievementType].title}`;
      const callbackData = hasIt ? 
        `revokeAchievement_${achievementType}_${userId}` : 
        `selectAchievement_${achievementType}_${userId}`;
      
      row.push(Markup.button.callback(buttonText, callbackData));
    }
    keyboard.push(row);
  }
  
  // Add back button
  keyboard.push([
    Markup.button.callback('🔙 Назад к пользователю', `admin_manage_user_${userId}`)
  ]);

  await ctx.editMessageText(message, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(keyboard)
  });
});

// Handler for granting achievements
const selectAchievement = Composer.action(/^selectAchievement_/, async (ctx) => {
  const check = await ensureRoles(ctx, SUPER_ROLES);
  if (!check.allowed) return;
  try { 
    await ctx.answerCbQuery(); 
  } catch {}

  try {
    const parts = ctx.callbackQuery.data.split('_');
    const userId = parts[parts.length - 1]; // Last part is always user ID
    const achievementType = parts.slice(1, -1).join('_'); // Everything between first and last is achievement type
    const achievementConfig = achievementsConfig[achievementType];

    if (!achievementConfig) {
      await ctx.answerCbQuery('❌ Достижение не найдено');
      return;
    }

    // Get user data
    const userData = await getUser(Number(userId));
    if (!userData) {
      await ctx.answerCbQuery('❌ Пользователь не найден');
      return;
    }

    // Check if user already has this achievement
    const alreadyHas = await hasAchievement(Number(userId), achievementType);
    
    if (alreadyHas) {
      await ctx.answerCbQuery('❌ У пользователя уже есть это достижение');
      return;
    }

    // Grant the achievement
    await grantAchievement(ctx.from.id, Number(userId), achievementType, {
      reason: 'Выдано администратором',
      grantedBy: ctx.from.first_name
    });

    // Send DM notification to user
    const achievementMessage = 
      `🏆 <b>Новое достижение!</b>\n\n` +
      `Гоблин ${userData.first_name} заслужил знак отличия:\n\n` +
      `✨ <b>${achievementConfig.title}</b>\n` +
      `${achievementConfig.description}\n\n` +
      `🕯 Главгоблин кивает одобрительно.`;

    try {
      await ctx.telegram.sendMessage(Number(userId), achievementMessage, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Failed to send DM notification:', error);
    }

    // Send public notification to RPG topic in main group
    if (notifications.rpgTopicId && notifications.mainGroupId) {
      try {
        // Create tagged message for RPG topic
        const username = userData.username ? `@${userData.username}` : userData.first_name || `ID: ${userId}`;
        const rpgMessage = 
          `🏆 <b>Новое достижение!</b>\n\n` +
          `${username} заслужил знак отличия:\n\n` +
          `✨ <b>${achievementConfig.title}</b>\n` +
          `${achievementConfig.description}\n\n` +
          `🕯 Главгоблин кивает одобрительно.`;
        
        await ctx.telegram.sendMessage(
          notifications.mainGroupId,
          rpgMessage, 
          { 
            parse_mode: 'HTML',
            message_thread_id: notifications.rpgTopicId
          }
        );
      } catch (error) {
        console.error('Failed to send RPG topic notification:', error);
      }
    }

    // Show success message and refresh achievements menu
    setTimeout(async () => {
      try {
        await ctx.editMessageText(
          `🏆 <b>Управление достижениями</b>\n\n` +
          `👤 <b>Пользователь:</b> ${userData.first_name} (@${userData.username})\n` +
          `🆔 <b>ID:</b> ${userId}\n\n` +
          `✅ Достижение "${achievementConfig.title}" выдано!`,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔄 Обновить список', `admin_user_achievements_${userId}`)],
              [Markup.button.callback('🔙 Назад к пользователю', `admin_manage_user_${userId}`)]
            ])
          }
        );
      } catch (error) {
        console.log('Error updating achievements menu:', error.message);
      }
    }, 1500);

  } catch (error) {
    console.error('Error granting achievement:', error);
    await ctx.answerCbQuery('❌ Ошибка при выдаче достижения');
  }
});

// Handler for revoking achievements
const revokeAchievementHandler = Composer.action(/^revokeAchievement_/, async (ctx) => {
  const check = await ensureRoles(ctx, SUPER_ROLES);
  if (!check.allowed) return;
  try { 
    await ctx.answerCbQuery(); 
  } catch {}

  try {
    const parts = ctx.callbackQuery.data.split('_');
    const userId = parts[parts.length - 1]; // Last part is always user ID
    const achievementType = parts.slice(1, -1).join('_'); // Everything between first and last is achievement type
    const achievementConfig = achievementsConfig[achievementType];

    if (!achievementConfig) {
      await ctx.answerCbQuery('❌ Достижение не найдено');
      return;
    }

    // Get user data
    const userData = await getUser(Number(userId));
    if (!userData) {
      await ctx.answerCbQuery('❌ Пользователь не найден');
      return;
    }

    // Check if user has this achievement
    const hasIt = await hasAchievement(Number(userId), achievementType);
    
    if (!hasIt) {
      await ctx.answerCbQuery('❌ У пользователя нет этого достижения');
      return;
    }

    // Revoke the achievement
    await revokeAchievement(ctx.from.id, Number(userId), achievementType);

    // Show success message and refresh achievements menu
    setTimeout(async () => {
      try {
        await ctx.editMessageText(
          `🏆 <b>Управление достижениями</b>\n\n` +
          `👤 <b>Пользователь:</b> ${userData.first_name} (@${userData.username})\n` +
          `🆔 <b>ID:</b> ${userId}\n\n` +
          `❌ Достижение "${achievementConfig.title}" отозвано!`,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔄 Обновить список', `admin_user_achievements_${userId}`)],
              [Markup.button.callback('🔙 Назад к пользователю', `admin_manage_user_${userId}`)]
            ])
          }
        );
      } catch (error) {
        console.log('Error updating achievements menu:', error.message);
      }
    }, 1500);

  } catch (error) {
    console.error('Error revoking achievement:', error);
    await ctx.answerCbQuery('❌ Ошибка при отзыве достижения');
  }
});

// Helper function to get user's achievements
async function getUserAchievements(userId) {
  const achievements = await knex('user_achievements')
    .where('user_id', Number(userId))
    .select('achievement_type');
  
  return achievements.map(a => a.achievement_type);
}

// Helper function to format user achievements for display
function formatUserAchievements(achievements) {
  if (achievements.length === 0) {
    return 'Нет достижений';
  }
  
  return achievements.map(achievementType => {
    const config = achievementsConfig[achievementType];
    const title = config?.title || achievementType;
    return `• ${title}`;
  }).join('\n');
}

// Export all handlers composed together
module.exports = Composer.compose([
  adminUserAchievements,
  selectAchievement,
  revokeAchievementHandler
]);
