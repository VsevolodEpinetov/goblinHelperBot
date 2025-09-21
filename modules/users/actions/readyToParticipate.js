const { Composer, Markup } = require("telegraf");
const knex = require('../../db/knex');
const { getUser } = require('../../db/helpers');

module.exports = Composer.action('readyToParticipate', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  const userId = ctx.callbackQuery.from.id;
  
  try {
    // Check if user already exists
    const existingUser = await getUser(userId);
    
    if (!existingUser) {
      // Create user with 'prereg' status
      await knex('users').insert({
        id: userId,
        username: ctx.callbackQuery.from.username,
        firstName: ctx.callbackQuery.from.first_name,
        lastName: ctx.callbackQuery.from.last_name
      });
      
      // Add prereg role
      await knex('userRoles').insert({
        userId: userId,
        role: 'prereg'
      });
      
      console.log(`✅ User ${userId} registered with prereg status`);
    }
    
    // Step 4: Process explanation
    await ctx.editMessageText(
      '🎯 <b>РЕШАЮЩИЙ МОМЕНТ</b>\n\n' +
'Ты стоишь у входа в логово. Дальше — только вперёд.\n' +
'Если откажешься сейчас — дороги обратно не будет.\n\n' +
'Готов идти дальше?',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback("✅ Да, готов!", 'confirmParticipation'),
            Markup.button.callback("❌ Передумал", 'cancelParticipation')
          ]
        ])
      }
    );
    
  } catch (error) {
    console.error('Error in readyToParticipate:', error);
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
