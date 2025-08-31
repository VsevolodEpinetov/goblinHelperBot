const { Composer, Markup } = require('telegraf');
const { t } = require('../../i18n');
const { 
  getUserLoyalty, 
  getLevelInfo, 
  getLevelBenefits,
  getNextLevel,
  getMaterialProgression,
  MATERIAL_TIERS
} = require('../index');

const profile = new Composer();

profile.command('profile', async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    // Get user loyalty data
    const loyalty = await getUserLoyalty(userId);
    if (!loyalty) {
      await ctx.reply('❌ Error loading profile');
      return;
    }
    
    // Get level info
    const levelInfo = getLevelInfo(loyalty.level);
    const benefits = getLevelBenefits(loyalty.level);
    const progression = getMaterialProgression(loyalty.level);
    
    // Get next level info
    const nextLevel = getNextLevel(loyalty.level);
    const nextLevelInfo = getLevelInfo(nextLevel);
    
    // Build profile message
    let message = `👤 <b>Loyalty Profile</b>\n\n`;
    message += `🆔 <b>User:</b> ${ctx.from.first_name} ${ctx.from.last_name || ''}\n`;
    message += `👑 <b>Level:</b> ${levelInfo.name}\n`;
    message += `📊 <b>Tier:</b> ${MATERIAL_TIERS[levelInfo.tier].name}\n`;
    
    if (nextLevelInfo && nextLevel !== loyalty.level) {
      message += `📈 <b>Next Level:</b> ${nextLevelInfo.name}\n`;
    } else {
      message += `🏆 <b>Status:</b> Maximum level reached!\n`;
    }
    
    message += `💰 <b>Discount:</b> ${levelInfo.discount}%\n\n`;
    
    // Material progression
    message += `🔧 <b>Material Progress:</b>\n`;
    message += `  • Current: ${progression.material.charAt(0).toUpperCase() + progression.material.slice(1)} ${progression.currentSublevel}\n`;
    if (progression.nextMaterial) {
      message += `  • Next: ${progression.nextMaterial.charAt(0).toUpperCase() + progression.nextMaterial.slice(1)}\n`;
    }
    message += `  • Sublevel: ${progression.currentSublevel}/3\n\n`;
    
    // Benefits
    message += `🎁 <b>Your Benefits:</b>\n`;
    benefits.forEach(benefit => {
      message += `  • ${benefit}\n`;
    });
    
    await ctx.replyWithHTML(message, {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📊 Leaderboard', 'loyalty_leaderboard')],
        [Markup.button.callback('📈 Level Chart', 'loyalty_levels')]
      ])
    });
    
  } catch (error) {
    console.error('Error in profile command:', error);
    await ctx.reply('❌ Error loading profile');
  }
});

// Action handler for profile button
profile.action('loyalty_profile', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    
    const userId = ctx.from.id;
    const loyalty = await getUserLoyalty(userId);
    if (!loyalty) {
      await ctx.editMessageText('❌ Error loading profile');
      return;
    }
    
    const levelInfo = getLevelInfo(loyalty.level);
    const benefits = getLevelBenefits(loyalty.level);
    const progression = getMaterialProgression(loyalty.level);
    
    const nextLevel = getNextLevel(loyalty.level);
    const nextLevelInfo = getLevelInfo(nextLevel);
    
    let message = `👤 <b>Loyalty Profile</b>\n\n`;
    message += `🆔 <b>User:</b> ${ctx.from.first_name} ${ctx.from.last_name || ''}\n`;
    message += `👑 <b>Level:</b> ${levelInfo.name}\n`;
    message += `📊 <b>Tier:</b> ${MATERIAL_TIERS[levelInfo.tier].name}\n`;
    
    if (nextLevelInfo && nextLevel !== loyalty.level) {
      message += `📈 <b>Next Level:</b> ${nextLevelInfo.name}\n`;
    } else {
      message += `🏆 <b>Status:</b> Maximum level reached!\n`;
    }
    
    message += `💰 <b>Discount:</b> ${levelInfo.discount}%\n\n`;
    
    message += `🔧 <b>Material Progress:</b>\n`;
    message += `  • Current: ${progression.material.charAt(0).toUpperCase() + progression.material.slice(1)} ${progression.currentSublevel}\n`;
    if (progression.nextMaterial) {
      message += `  • Next: ${progression.nextMaterial.charAt(0).toUpperCase() + progression.nextMaterial.slice(1)}\n`;
    }
    message += `  • Sublevel: ${progression.currentSublevel}/3\n\n`;
    
    message += `🎁 <b>Your Benefits:</b>\n`;
    benefits.forEach(benefit => {
      message += `  • ${benefit}\n`;
    });
    
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📊 Leaderboard', 'loyalty_leaderboard')],
        [Markup.button.callback('📈 Level Chart', 'loyalty_levels')]
      ])
    });
    
  } catch (error) {
    console.error('Error in profile action:', error);
    await ctx.answerCbQuery('❌ Error loading profile');
  }
});

module.exports = profile;
