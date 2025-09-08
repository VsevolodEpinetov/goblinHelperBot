const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const knex = require('../../db/knex');
const { t } = require('../../i18n');

module.exports = Composer.action('userProfile', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  const userId = ctx.from.id;
  
  try {
    const userData = await getUser(userId);
    
    if (!userData) {
      await ctx.editMessageText(t('messages.user_not_found'), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.back'), 'refreshUserStatus')]])
      });
      return;
    }
    
    const roles = userData.roles || [];
    const roleText = roles.length > 0 ? roles.join(', ') : 'Нет ролей';
    
    const baseParams = {
      id: userData.id,
      firstName: userData.first_name,
      username: userData.username !== 'not_set' ? `@${userData.username}` : '—',
      roles: roleText
    };
    
    // Balance removed (no stars balance)

    // Loyalty section (RPG)
    try {
      const lvl = await knex('user_levels').where({ user_id: Number(userId) }).first();
      if (lvl) {
        const benefitsByTier = require('../../../configs/benefits');
        const perkList = benefitsByTier[lvl.current_tier] || [];
        const perks = perkList.length ? `🎁 <b>Бонусы:</b> ${perkList.join(', ')}` : '';
        const toNext = lvl.xp_to_next_level != null ? ` (до след. уровня: ${lvl.xp_to_next_level})` : '';
        const message = t('profile.template', {
          ...baseParams,
          tier: String(lvl.current_tier || '').toUpperCase(),
          level: lvl.current_level,
          xp: lvl.total_xp,
          toNext,
          perks
        });

        await ctx.editMessageText(message, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.back'), 'refreshUserStatus')]]) });
        return;
      }
    } catch (e) {
      // Non-fatal: ignore
    }

    // Fallback without lvl
    const message = t('profile.template', {
      ...baseParams,
      tier: 'WOOD',
      level: 1,
      xp: 0,
      toNext: '',
      perks: ''
    });
    await ctx.editMessageText(message, { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.back'), 'refreshUserStatus')]]) });
    
  } catch (error) {
    console.error('Error in userProfile:', error);
    await ctx.editMessageText(t('messages.try_again_later'), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t('messages.back'), 'refreshUserStatus')]]) });
  }
});
