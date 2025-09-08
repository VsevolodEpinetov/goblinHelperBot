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
    const tickets = Math.floor((purchases.groups?.plus?.length || 0) / 3) * 2 - (purchases.ticketsSpent || 0);
    const purchasedKickstarters = purchases.kickstarters?.length || 0;
    const availableKickstarters = 5; // Example number
    
    const kickstarterMessage = `${t('kickstarters.menu.title')}\n\n` +
      `${t('kickstarters.menu.abilities', { tickets, purchased: purchasedKickstarters, available: availableKickstarters })}\n\n` +
      `${t('kickstarters.menu.how')}\n\n` +
      `${t('kickstarters.menu.whatIncluded')}\n\n` +
      `📊 <b>Рекомендации:</b>\n` +
      `${tickets > 0 ? t('kickstarters.menu.recommend.canBuy') : t('kickstarters.menu.recommend.noTickets')}`;

    const kickstarterKeyboard = [];
    
    // Primary actions based on available tickets
    if (tickets > 0) {
      kickstarterKeyboard.push([
        Markup.button.callback(t('kickstarters.menu.buttons.buy'), 'browseKickstarters'),
        Markup.button.callback(t('kickstarters.menu.buttons.useTicket'), 'useTicket')
      ]);
    } else {
      kickstarterKeyboard.push([
        Markup.button.callback(t('kickstarters.menu.buttons.buyPlus'), 'addPlusToCurrentMonth')
      ]);
    }
    
    // Standard actions
    kickstarterKeyboard.push([
      Markup.button.callback(t('kickstarters.menu.buttons.my'), 'myKickstarters'),
      Markup.button.callback(t('kickstarters.menu.buttons.search'), 'searchKickstarters')
    ]);
    
    kickstarterKeyboard.push([
      Markup.button.callback(t('kickstarters.menu.buttons.stats'), 'kickstarterStats'),
      Markup.button.callback(t('kickstarters.menu.buttons.help'), 'kickstarterHelp')
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