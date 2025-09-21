const { Composer, Markup } = require("telegraf");
const knex = require('../../db/knex');

module.exports = Composer.action('cancelParticipation', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  const userId = ctx.callbackQuery.from.id;
  
  try {
    // Assign selfbanned role instead of deleting
    await knex('userRoles').where('userId', userId).del();
    await knex('userRoles').insert({
      userId: userId,
      role: 'selfbanned'
    });
    
    console.log(`❌ User ${userId} cancelled participation and was self-banned`);
    
    // Show cancellation message
    await ctx.editMessageText(
      '💀 <b>Ты отвернулся от совета</b>\n\n' +
'Двери захлопнулись. Пути назад нет.\n\n' +
'Гоблины не любят трусов. Второго шанса не будет.',
      { parse_mode: 'HTML' }
    );
    
  } catch (error) {
    console.error('Error in cancelParticipation:', error);
    await ctx.editMessageText(
      "❌ <b>Произошла ошибка</b>\n\nПопробуй ещё раз позже.",
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Начать сначала", 'whatIsIt')]
        ])
      }
    );
  }
});
