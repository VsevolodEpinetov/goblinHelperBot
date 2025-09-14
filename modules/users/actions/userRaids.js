const { Composer, Markup } = require("telegraf");

module.exports = Composer.action('userRaids', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    const message = `⚔️ <b>Рейды</b>\n\nЗдесь гоблины объединяют кошели ради больших трофеев. Выбирай тропу:`;
    
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('⚔️ Созданные рейды', 'userCreatedRaids')],
        [Markup.button.callback('🎯 Участвую в рейдах', 'userParticipatedRaids')],
        [Markup.button.callback('➕ Создать рейд', 'createRaid')],
        [Markup.button.callback('🔙 Назад', 'refreshUserStatus')]
      ])
    });
    
  } catch (error) {
    console.error('Error in userRaids:', error);
    await ctx.editMessageText('❌ <b>Произошла ошибка</b>\n\nПопробуй ещё раз позже.', { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'refreshUserStatus')]]) });
  }
});
