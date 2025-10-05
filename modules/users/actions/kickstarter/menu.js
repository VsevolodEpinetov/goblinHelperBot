const { Composer, Markup } = require("telegraf");
const { getUser } = require('../../../db/helpers');
const { t } = require('../../../../modules/i18n');

module.exports = Composer.action('userKickstarters', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    const userData = await getUser(ctx.from.id);
    if (!userData) {
      await ctx.editMessageText(t('kickstarters.menu.errors.userNotFound'), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback(t('kickstarters.menu.buttons.back'), 'refreshUserStatus')]])
      });
      return;
    }

    const purchases = userData.purchases || {};
    const scrolls = Math.floor((purchases.groups?.plus?.length || 0) / 3) * 2 - (purchases.scrollsSpent || 0);
    const purchasedKickstarters = purchases.kickstarters?.length || 0;
    const availableKickstarters = 5; // Example number
    
    const kickstarterMessage = `${t('kickstarters.menu.title')}\n\n` +
      `${t('kickstarters.menu.abilities', { scrolls, purchased: purchasedKickstarters, available: availableKickstarters })}\n\n` +
      `${t('kickstarters.menu.how')}\n\n` +
      `${t('kickstarters.menu.whatIncluded')}\n\n` +
      `📊 <b>Рекомендации:</b>\n` +
      `${scrolls > 0 ? t('kickstarters.menu.recommend.canBuy') : t('kickstarters.menu.recommend.noScrolls')}`;

    const kickstarterKeyboard = [];
    
    // Primary actions - simplified to only show purchased and find new
    kickstarterKeyboard.push([
      Markup.button.callback('📚 Мои кикстартеры', 'myKickstarters'),
      Markup.button.callback('🔍 Найти новые', 'browseKickstarters')
    ]);
    
    // Single back button
    kickstarterKeyboard.push([
      Markup.button.callback(t('kickstarters.menu.buttons.back'), 'refreshUserStatus')
    ]);

    await ctx.editMessageText(kickstarterMessage, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(kickstarterKeyboard)
    });
    
  } catch (error) {
    console.error('Error in userKickstarters:', error);
    await ctx.editMessageText(t('kickstarters.menu.errors.generic'), {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[Markup.button.callback(t('kickstarters.menu.buttons.back'), 'refreshUserStatus')]])
    });
  }
});