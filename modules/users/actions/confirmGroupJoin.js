const { Composer } = require("telegraf");
const { markInvitationUsed } = require('../menuSystem');

module.exports = Composer.action('confirmGroupJoin', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  const userId = ctx.from.id;
  
  try {
    // Mark the invitation as used since user confirms they joined
    const markResult = await markInvitationUsed(userId);
    
    if (!markResult.success) {
      console.error('Failed to mark invitation as used:', markResult.error);
      await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
      return;
    }
    
    // Send confirmation message
    await ctx.reply('🍻 <b>Добро пожаловать, гоблин!</b>\n\nТеперь ты один из нас. В будущем используй /start для доступа к меню.', {
      parse_mode: 'HTML'
    });
  } catch (error) {
    console.error('Error in confirmGroupJoin:', error);
    await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
  }
});
