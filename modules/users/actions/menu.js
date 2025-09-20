const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const { t } = require('../../../modules/i18n');
const SETTINGS = require('../../../settings.json');
const { getUser } = require('../../db/helpers');

module.exports = Composer.action('userMenu', async (ctx) => {
  const userData = await getUser(ctx.callbackQuery.from.id);
  if (!userData) return;

  // For all users, redirect to refreshUserStatus which handles all user types properly
  const { getUserMenu } = require('../menuSystem');
  const menu = await getUserMenu(ctx, userData);
  
  await ctx.editMessageText(menu.message, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(menu.keyboard)
  });
});