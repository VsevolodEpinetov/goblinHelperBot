const { Composer } = require('telegraf');
const { setUserLevel, getLevelInfo, LEVELS } = require('../index');
const { requireAdmin } = require('../../rbac');

const admin = new Composer();

// Admin command to set user level
admin.command('set_level', 
  requireAdmin('❌ Требуются права администратора'),
  async (ctx) => {
    try {
      const args = ctx.message.text.split(' ');
      if (args.length !== 3) {
        await ctx.reply('❌ Usage: /set_level <userId> <level>\n\nAvailable levels:\n' + 
          Object.keys(LEVELS).join(', '));
        return;
      }
      
      const userId = parseInt(args[1]);
      const level = args[2];
      
      if (!userId || isNaN(userId)) {
        await ctx.reply('❌ Invalid user ID');
        return;
      }
      
      if (!LEVELS[level]) {
        await ctx.reply('❌ Invalid level. Available levels:\n' + Object.keys(LEVELS).join(', '));
        return;
      }
      
      const result = await setUserLevel(userId, level);
      
      if (result.success) {
        const levelInfo = getLevelInfo(level);
        await ctx.reply(`✅ Successfully set user ${userId} to level: ${levelInfo.name}`);
      } else {
        await ctx.reply(`❌ Error: ${result.message}`);
      }
      
    } catch (error) {
      console.error('Error in set_level command:', error);
      await ctx.reply('❌ Error setting level');
    }
  }
);

// Admin command to list all levels
admin.command('list_levels', 
  requireAdmin('❌ Требуются права администратора'),
  async (ctx) => {
    try {
      let message = '📊 <b>Available Levels:</b>\n\n';
      
      const tiers = [1, 2, 3, 4];
      tiers.forEach(tier => {
        const tierLevels = Object.entries(LEVELS).filter(([key, value]) => value.tier === tier);
        
        message += `🏆 <b>Tier ${tier}:</b>\n`;
        tierLevels.forEach(([key, value]) => {
          message += `  • ${key}: ${value.name} (${value.discount}% discount)\n`;
        });
        message += '\n';
      });
      
      await ctx.replyWithHTML(message);
      
    } catch (error) {
      console.error('Error in list_levels command:', error);
      await ctx.reply('❌ Error listing levels');
    }
  }
);

module.exports = admin;
