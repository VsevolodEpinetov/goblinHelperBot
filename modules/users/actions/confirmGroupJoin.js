const { Composer, Markup } = require("telegraf");
const { getUserMenu } = require('../menuSystem');
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('confirmGroupJoin', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch {}
  
  const userId = ctx.from.id;
  
  try {
    // Check if user has actually joined the group (link is marked as used)
    const { getUser } = require('../../db/helpers');
    const userData = await getUser(userId);
    const menu = await getUserMenu(ctx, userData);

    // If the user has joined, they'll see the main menu
    // If not, they'll see the invitation link again
    await ctx.editMessageText(menu.message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(menu.keyboard)
    });
  } catch (error) {
    console.error('Error in confirmGroupJoin:', error);
    await ctx.editMessageText(t('messages.try_again_later'), { parse_mode: 'HTML', ...Markup.inlineKeyboard([[Markup.button.callback(t('buttons.help'), 'userHelp')]]) });
  }
});
