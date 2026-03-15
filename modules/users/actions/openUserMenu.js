const { Composer, Markup } = require('telegraf');
const { getUser } = require('../../db/helpers');
const { getApprovedUserMenu } = require('../menus');

/**
 * Opens the regular user (goblin) menu regardless of admin status.
 * Used by "Открыть пользовательское меню" button in admin panel.
 */
module.exports = Composer.action('openUserMenu', async (ctx) => {
  try {
    await ctx.answerCbQuery('👤 Пользовательское меню');
  } catch {}

  try {
    const userData = await getUser(ctx.from.id);

    if (!userData) {
      await ctx.editMessageText(
        '❌ <b>Лицо не найдено в хрониках</b>\n\nТвои данные исчезли в тумане. Попробуй снова позже.',
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'refreshUserStatus')]])
        }
      );
      return;
    }

    const menu = await getApprovedUserMenu(ctx, userData);

    await ctx.editMessageText(menu.message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard(menu.keyboard)
    });
  } catch (error) {
    console.error('❌ Error in openUserMenu:', error);
    await ctx.editMessageText(
      '❌ <b>Произошла ошибка</b>\n\nПопробуй ещё раз позже.',
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Назад', 'refreshUserStatus')]])
      }
    );
  }
});
