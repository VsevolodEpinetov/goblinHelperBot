const { Composer, Markup } = require('telegraf');
const { t } = require('../../i18n');

const help = new Composer();

help.command('loyalty_help', async (ctx) => {
  try {
    await showLoyaltyHelp(ctx);
  } catch (error) {
    console.error('Error in loyalty help command:', error);
    await ctx.reply('❌ Error loading help');
  }
});

help.action('loyalty_help', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await showLoyaltyHelp(ctx, true);
  } catch (error) {
    console.error('Error in loyalty help action:', error);
    await ctx.answerCbQuery('❌ Error loading help');
  }
});

async function showLoyaltyHelp(ctx, isEdit = false) {
  try {
    let message = `🎁 <b>Loyalty Level System</b>\n\n`;
    message += `Our community uses a level system based on valuable materials!\n\n`;
    
    message += `📊 <b>Level System:</b>\n`;
    message += `• 10 different materials (Bronze → Adamantium)\n`;
    message += `• 3 sublevels each (III → II → I)\n`;
    message += `• 30 total levels to progress through\n`;
    message += `• Higher levels = better discounts & benefits\n\n`;
    
    message += `💡 <b>How it works:</b>\n`;
    message += `• Levels are assigned by administrators\n`;
    message += `• Based on community contribution and activity\n`;
    message += `• Higher levels unlock more benefits\n`;
    message += `• Check your profile to see your current level\n`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('👤 My Profile', 'loyalty_profile')],
      [Markup.button.callback('📊 Leaderboard', 'loyalty_leaderboard')],
      [Markup.button.callback('📈 Level Chart', 'loyalty_levels')]
    ]);
    
    if (isEdit) {
      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...keyboard
      });
    } else {
      await ctx.replyWithHTML(message, keyboard);
    }
    
  } catch (error) {
    console.error('Error showing loyalty help:', error);
    throw error;
  }
}

// Action handler for level chart
help.action('loyalty_levels', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    
    let message = `📊 <b>Loyalty Level Chart</b>\n\n`;
    
    message += `🥉 <b>Bronze Tier:</b>\n`;
    message += `  • Bronze III (lowest)\n`;
    message += `  • Bronze II\n`;
    message += `  • Bronze I\n\n`;
    
    message += `🟠 <b>Copper Tier:</b>\n`;
    message += `  • Copper III\n`;
    message += `  • Copper II\n`;
    message += `  • Copper I\n\n`;
    
    message += `⚫ <b>Iron Tier:</b>\n`;
    message += `  • Iron III\n`;
    message += `  • Iron II\n`;
    message += `  • Iron I\n\n`;
    
    message += `🔘 <b>Steel Tier:</b>\n`;
    message += `  • Steel III\n`;
    message += `  • Steel II\n`;
    message += `  • Steel I\n\n`;
    
    message += `🥈 <b>Silver Tier:</b>\n`;
    message += `  • Silver III\n`;
    message += `  • Silver II\n`;
    message += `  • Silver I\n\n`;
    
    message += `🥇 <b>Gold Tier:</b>\n`;
    message += `  • Gold III\n`;
    message += `  • Gold II\n`;
    message += `  • Gold I\n\n`;
    
    message += `💎 <b>Platinum Tier:</b>\n`;
    message += `  • Platinum III\n`;
    message += `  • Platinum II\n`;
    message += `  • Platinum I\n\n`;
    
    message += `💠 <b>Diamond Tier:</b>\n`;
    message += `  • Diamond III\n`;
    message += `  • Diamond II\n`;
    message += `  • Diamond I\n\n`;
    
    message += `⚔️ <b>Adamantium Tier:</b>\n`;
    message += `  • Adamantium III\n`;
    message += `  • Adamantium II\n`;
    message += `  • Adamantium I (highest)\n\n`;
    
    message += `🏆 <i>Reach the top and become a legend!</i>`;
    
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('👤 My Profile', 'loyalty_profile')],
        [Markup.button.callback('📊 Leaderboard', 'loyalty_leaderboard')],
        [Markup.button.callback('🎁 How it Works', 'loyalty_help')]
      ])
    });
    
  } catch (error) {
    console.error('Error showing level chart:', error);
    await ctx.answerCbQuery('❌ Error loading level chart');
  }
});

module.exports = help;
