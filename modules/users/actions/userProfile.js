const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../db/helpers');
const knex = require('../../db/knex');

module.exports = Composer.action('userProfile', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  const userId = ctx.from.id;
  
  try {
    const userData = await getUser(userId);
    
    if (!userData) {
      await ctx.editMessageText(
        '❌ <b>Лицо не найдено в хрониках</b>\n\n' +
        'Твои следы растворились в тумане. Попробуй позже.',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'refreshUserStatus')]])
        }
      );
      return;
    }
    
    const roles = userData.roles || [];
    const roleText = roles.length > 0 ? roles.join(', ') : '—';
    
    const baseParams = {
      id: userData.id,
      firstName: userData.first_name,
      username: userData.username !== 'not_set' ? `@${userData.username}` : '—',
      roles: roleText
    };
    
    // Loyalty section (RPG)
    try {
      const lvl = await knex('user_levels').where({ user_id: Number(userId) }).first();
      if (lvl) {
        const benefitsByTier = require('../../../configs/benefits');
        const perkList = benefitsByTier[lvl.current_tier] || [];
        const perks =
          perkList.length ? `🗝 <b>Доступы:</b> ${perkList.join(', ')}` : '';
        const toNext =
          lvl.xp_to_next_level != null ? ` (до следующего уровня: ${lvl.xp_to_next_level})` : '';
        
        const message =
          `👤 <b>Карточка гоблина</b>\n\n` +
          `🆔 <b>ID:</b> <code>${baseParams.id}</code>\n` +
          `📛 <b>Имя:</b> ${baseParams.firstName}\n` +
          `🏷 <b>Username:</b> ${baseParams.username}\n` +
          `🎭 <b>Роли:</b> ${baseParams.roles}\n\n` +
          `🏅 <b>Ранг:</b> ${String(lvl.current_tier || '').toUpperCase()} ${lvl.current_level}\n` +
          `✨ <b>Опыт:</b> ${lvl.total_xp}${toNext}\n` +
          (perks ? `${perks}\n` : ``);

        await ctx.editMessageText(
          message,
          { parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'refreshUserStatus')]])
          }
        );
        return;
      }
    } catch (e) {
      // Non-fatal: ignore
    }

    // Fallback without lvl
    const message =
      `👤 <b>Карточка гоблина</b>\n\n` +
      `🆔 <b>ID:</b> <code>${baseParams.id}</code>\n` +
      `📛 <b>Имя:</b> ${baseParams.firstName}\n` +
      `🏷 <b>Username:</b> ${baseParams.username}\n` +
      `🎭 <b>Роли:</b> ${baseParams.roles}\n\n` +
      `🏅 <b>Ранг:</b> WOOD 1\n` +
      `✨ <b>Опыт:</b> 0\n`;

    await ctx.editMessageText(
      message,
      { parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'refreshUserStatus')]])
      }
    );
    
  } catch (error) {
    console.error('Error in userProfile:', error);
    await ctx.editMessageText(
      '❌ <b>Произошла ошибка</b>\n\nПопробуй ещё раз позже.',
      { parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'refreshUserStatus')]])
      }
    );
  }
});
