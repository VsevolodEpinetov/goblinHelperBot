const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { grantAchievement, hasAchievement } = require('../../loyalty/achievementsService');
const achievementsConfig = require('../../../configs/achievements');
const notifications = require('../../../configs/notifications');
const { ensureRoles } = require('../../rbac');

const SUPER_ROLES = ['super'];

module.exports = Composer.action(/^grantAchievement_/, async (ctx) => {
  const check = await ensureRoles(ctx, SUPER_ROLES);
  if (!check.allowed) return;

  try { 
    await ctx.answerCbQuery(); 
  } catch {}

  try {
    const userId = ctx.callbackQuery.data.split('_')[1];
    
    // Get user data
    const userData = await getUser(Number(userId));
    if (!userData) {
      await ctx.reply('❌ Пользователь не найден в базе данных.');
      return;
    }

    // Show available achievements
    const achievements = Object.entries(achievementsConfig);
    const keyboard = achievements.map(([key, config]) => [
      Markup.button.callback(
        `🏆 ${config.title}`, 
        `selectAchievement_${key}_${userId}`
      )
    ]);
    
    keyboard.push([Markup.button.callback('❌ Отмена', `showUser_${userId}`)]);

    const message = 
      `👤 <b>Пользователь:</b> ${userData.first_name} (@${userData.username})\n` +
      `🆔 <b>ID:</b> ${userId}\n\n` +
      `🏆 <b>Выберите достижение для выдачи:</b>`;

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(keyboard)
    });

  } catch (error) {
    console.error('Error in grantAchievement:', error);
    await ctx.reply('❌ Ошибка при открытии формы выдачи достижений.');
  }
});
