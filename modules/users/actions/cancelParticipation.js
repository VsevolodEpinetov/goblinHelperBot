const { Composer, Markup } = require("telegraf");
const { t } = require('../../../modules/i18n');
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
      t('applyFlow.cancel.success'),
      { parse_mode: 'HTML' }
    );
    
  } catch (error) {
    console.error('Error in cancelParticipation:', error);
    await ctx.editMessageText(
      t('applyFlow.cancel.error'),
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback(t('applyFlow.cancel.startOver'), 'whatIsIt')]
        ])
      }
    );
  }
});
