const { Composer, Markup } = require("telegraf");
const { t } = require('../../../modules/i18n');
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
      t('messages.participation.text'),
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(t('messages.participation.yes'), 'confirmParticipation'),
            Markup.button.callback(t('messages.participation.cancel'), 'cancelParticipation')
          ]
        ])
      }
    );
    
  } catch (error) {
    console.error('Error in readyToParticipate:', error);
    await ctx.editMessageText(
      t('messages.try_again_later'),
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(t('messages.participation.startOver'), 'whatIsIt')]
        ])
      }
    );
  }
});
