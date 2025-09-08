const { Composer, Markup } = require("telegraf");
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('userRaids', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  try {
    const message = `${t('raids.menu.title')}\n\n${t('raids.menu.intro')}`;
    
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(t('raids.menu.buttons.created'), 'userCreatedRaids')],
        [Markup.button.callback(t('raids.menu.buttons.participating'), 'userParticipatedRaids')],
        [Markup.button.callback(t('raids.menu.buttons.create'), 'createRaid')],
        [Markup.button.callback(t('raids.menu.buttons.back'), 'refreshUserStatus')]
      ])
    });
    
  } catch (error) {
    console.error('Error in userRaids:', error);
    await ctx.editMessageText(require('../../../modules/i18n').t('messages.try_again_later'), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(require('../../../modules/i18n').t('messages.back'), 'refreshUserStatus')]]) });
  }
});
