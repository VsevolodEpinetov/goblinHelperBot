const { Composer, Markup } = require('telegraf');
const { t } = require('../../i18n');
const { getLeaderboard, getLevelInfo } = require('../index');

const leaderboard = new Composer();

leaderboard.command('leaderboard', async (ctx) => {
  try {
    const leaderboardData = await getLeaderboard(10);
    
    if (leaderboardData.length === 0) {
      await ctx.reply('📊 No users on leaderboard yet.');
      return;
    }
    
    let message = `🏆 <b>Loyalty Leaderboard</b>\n\n`;
    
    leaderboardData.forEach((user, index) => {
      const levelInfo = getLevelInfo(user.level);
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      const name = user.firstName || user.username || `User ${user.userId}`;
      
      message += `${medal} <b>${name}</b>\n`;
      message += `   ${levelInfo.name}\n\n`;
    });
    
    message += `💡 <i>Levels are assigned by administrators</i>`;
    
    await ctx.replyWithHTML(message, {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('👤 My Profile', 'loyalty_profile')],
        [Markup.button.callback('📈 Level Chart', 'loyalty_levels')]
      ])
    });
    
  } catch (error) {
    console.error('Error in leaderboard command:', error);
    await ctx.reply('❌ Error loading leaderboard');
  }
});

// Action handler for leaderboard button
leaderboard.action('loyalty_leaderboard', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    
    const leaderboardData = await getLeaderboard(10);
    
    if (leaderboardData.length === 0) {
      await ctx.editMessageText('📊 No users on leaderboard yet.');
      return;
    }
    
    let message = `🏆 <b>Loyalty Leaderboard</b>\n\n`;
    
    leaderboardData.forEach((user, index) => {
      const levelInfo = getLevelInfo(user.level);
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      const name = user.firstName || user.username || `User ${user.userId}`;
      
      message += `${medal} <b>${name}</b>\n`;
      message += `   ${levelInfo.name}\n\n`;
    });
    
    message += `💡 <i>Levels are assigned by administrators</i>`;
    
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('👤 My Profile', 'loyalty_profile')],
        [Markup.button.callback('📈 Level Chart', 'loyalty_levels')]
      ])
    });
    
  } catch (error) {
    console.error('Error in leaderboard action:', error);
    await ctx.answerCbQuery('❌ Error loading leaderboard');
  }
});

module.exports = leaderboard;
