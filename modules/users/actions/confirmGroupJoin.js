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
    }
    
    // No message editing needed - user manually confirmed they joined
  } catch (error) {
    console.error('Error in confirmGroupJoin:', error);
  }
});
