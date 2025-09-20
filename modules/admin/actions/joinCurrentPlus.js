const { Composer } = require('telegraf');
const { getMonthChatId } = require('../../db/helpers');
const { getCurrentPeriod } = require('../../users/menuSystem');
const { createInvitationLink } = require('../../invitationService');

module.exports = Composer.action('join_current_plus', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    
    // Get current period
    const currentPeriod = getCurrentPeriod(ctx);
    const [year, month] = currentPeriod.split('_');
    
    // Get chat ID for plus group
    const chatId = await getMonthChatId(year, month, 'plus');
    
    if (!chatId) {
      await ctx.reply('❌ Чат для текущего PLUS месяца не настроен');
      return;
    }
    
    // Create invitation link using the existing service
    const linkResult = await createInvitationLink(
      ctx.callbackQuery.from.id,
      chatId,
      currentPeriod,
      'plus'
    );
    
    if (!linkResult.success) {
      await ctx.reply('❌ Не удалось создать приглашение');
      return;
    }
    
    // Send invitation to admin
    await ctx.telegram.sendMessage(
      ctx.callbackQuery.from.id, 
      `🧭 <b>Приглашение в текущий PLUS месяц</b>\n\n` +
      `📅 Период: ${year}-${month}\n` +
      `🔗 Ссылка для вступления: ${linkResult.inviteLink}`,
      { parse_mode: 'HTML' }
    );
    
    // Log the action
    const timestamp = new Date().toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const context = ctx.chat?.type === 'private' ? 'DMs' : `group ${ctx.chat?.title || 'unknown'} (${ctx.chat?.id})`;
    console.log(`${timestamp} [INFO] User @${ctx.callbackQuery.from.username || 'unknown'} (${ctx.callbackQuery.from.id}) called action join_current_plus in ${context}`);
    
  } catch (error) {
    console.error('❌ Error in join_current_plus action:', error);
    await ctx.reply('❌ Не удалось создать приглашение');
  }
});
