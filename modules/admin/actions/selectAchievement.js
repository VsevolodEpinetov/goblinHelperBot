const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { grantAchievement, hasAchievement } = require('../../loyalty/achievementsService');
const achievementsConfig = require('../../../configs/achievements');
const notifications = require('../../../configs/notifications');

module.exports = Composer.action(/^selectAchievement_/, async (ctx) => {
  try { 
    await ctx.answerCbQuery(); 
  } catch {}

  try {
    const [_, achievementType, userId] = ctx.callbackQuery.data.split('_');
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

    // Send public notification to RPG topic
    if (notifications.rpgTopicId) {
      try {
        await ctx.telegram.sendMessage(
          Number(notifications.rpgTopicId), 
          achievementMessage, 
          { parse_mode: 'HTML' }
        );
      } catch (error) {
        console.error('Failed to send RPG topic notification:', error);
      }
    }

    // Show success message and return to user view
    await ctx.editMessageText(
      `✅ <b>Достижение выдано!</b>\n\n` +
      `👤 <b>Пользователь:</b> ${userData.first_name} (@${userData.username})\n` +
      `🏆 <b>Достижение:</b> ${achievementConfig.title}\n\n` +
      `Уведомления отправлены пользователю и в RPG топик.`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🏆 Выдать ещё', `grantAchievement_${userId}`)],
          [Markup.button.callback('👤 К пользователю', `showUser_${userId}`)]
        ])
      }
    );

  } catch (error) {
    console.error('Error granting achievement:', error);
    await ctx.answerCbQuery('❌ Ошибка при выдаче достижения');
  }
});
