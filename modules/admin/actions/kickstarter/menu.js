const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { getKickstarters } = require('../../../db/helpers');
const knex = require('../../../db/knex');

module.exports = Composer.action('adminKickstarters', async (ctx) => {
  // Check for super user
  if (!util.isSuperUser(ctx.callbackQuery.from.id)) {
    await ctx.answerCbQuery('❌ Только супер-пользователи могут управлять кикстартерами');
    return;
  }

  // Check for DM context
  if (ctx.chat.type !== 'private') {
    await ctx.answerCbQuery('❌ Управление кикстартерами доступно только в личных сообщениях');
    return;
  }

  try {
    const kickstartersData = await getKickstarters();
    
    // Get stats
    const totalKickstarters = kickstartersData.list.length;
    const promoCount = await knex('kickstarterPromoMessages')
      .countDistinct('kickstarterId as count')
      .first();
    const activePromos = promoCount?.count || 0;

    const statsMessage = 
      `📊 <b>Управление кикстартерами</b>\n\n` +
      `📦 Всего кикстартеров: <b>${totalKickstarters}</b>\n` +
      `📢 Активных промо: <b>${activePromos}</b>\n\n` +
      `Выбери действие:`;

    const keyboard = [
      [
        Markup.button.callback('➕ Добавить новый', 'adminAddKickstarter'),
        Markup.button.callback('🔍 Поиск', 'searchKickstarter')
      ],
      [
        Markup.button.callback('🔙 Назад', 'userMenu')
      ]
    ];

    if (!ctx.callbackQuery.message.photo) {
      await ctx.editMessageText(statsMessage, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(keyboard)
      });
    } else {
      await ctx.deleteMessage();
      await ctx.replyWithHTML(statsMessage, {
        ...Markup.inlineKeyboard(keyboard)
      });
    }
  } catch (error) {
    console.error('Error in adminKickstarters menu:', error);
    await ctx.answerCbQuery('❌ Ошибка при загрузке данных');
  }
});