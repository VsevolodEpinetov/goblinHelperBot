const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const { getUserMenu } = require('../menuSystem');
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('refreshUserStatus', async (ctx) => {
  try { await ctx.answerCbQuery('✅ Статус обновлён!'); } catch {}
  
  try {
    console.log('🔄 refreshUserStatus called for user:', ctx.from.id);
    
    const userData = await getUser(ctx.from.id);
    console.log('🔄 userData:', userData ? { id: userData.id, roles: userData.roles } : 'null');
    
    if (!userData) { await ctx.editMessageText(t('messages.user_not_found'), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.back'), 'refreshUserStatus')]]) }); return; }

    // Get the appropriate menu for the user
    console.log('🔄 Calling getUserMenu...');
    const menu = await getUserMenu(ctx, userData);
    console.log('🔄 Menu received:', { message: menu.message.substring(0, 50) + '...', keyboardLength: menu.keyboard.length });
    
    // Try to edit the message, but handle "same content" error gracefully
    try {
      await ctx.editMessageText(menu.message, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(menu.keyboard)
      });
      console.log('🔄 Menu updated successfully');
    } catch (editError) {
      if (editError.message.includes('message is not modified')) {
        console.log('🔄 Message content is the same, showing confirmation');
        await ctx.answerCbQuery('✅ Статус актуален!');
      } else {
        // Re-throw if it's a different error
        throw editError;
      }
    }
    
  } catch (error) {
    console.error('❌ Error in refreshUserStatus:', error);
    console.error('❌ Error stack:', error.stack);
    await ctx.editMessageText(t('messages.try_again_later'), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.back'), 'refreshUserStatus')]]) });
  }
});
