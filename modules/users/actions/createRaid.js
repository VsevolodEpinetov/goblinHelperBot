const { Composer, Markup } = require("telegraf");

module.exports = Composer.action('createRaid', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    const message = `⚔️ <b>СОЗДАНИЕ РЕЙДА</b>\n\n` +
                   `Чтобы создать рейд, используй команду:\n\n` +
                   `<code>Гоблины, на рейд!</code>\n\n` +
                   `Эта команда запустит процесс создания рейда в твоих личных сообщениях.\n\n` +
                   `💡 <b>Совет:</b> Рейды создаются только в личных сообщениях с ботом, а затем публикуются в канале.`;
    
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад к рейдам', 'userRaids')]
      ])
    });
    
  } catch (error) {
    console.error('Error in createRaid:', error);
    await ctx.editMessageText(
      '❌ <b>Произошла ошибка</b>\n\n' +
      'Попробуй еще раз позже.',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(require('../../../modules/i18n').t('messages.back'), 'refreshUserStatus')]
        ])
      }
    );
  }
});
