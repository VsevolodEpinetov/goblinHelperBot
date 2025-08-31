const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { getUser, getKickstarters } = require('../../../db/helpers');

module.exports = Composer.action('userKickstarters', async (ctx) => {
  const kickstartersData = await getKickstarters();
  const userId = ctx.callbackQuery.from.id;
  const userData = await getUser(userId);
  if (!userData) return;
  
  const purchasedAtLeastOne = userData.purchases.kickstarters.length > 0;

  let buttons = [
    [
      Markup.button.callback('🔍', 'searchKickstarter'),
    ],
    [
      Markup.button.callback('🏠', 'userMenu')
    ]
  ]

  if (purchasedAtLeastOne) {
    buttons = [
      [
        Markup.button.callback('🔍', 'searchKickstarter'),
        Markup.button.callback('Мои покупки', `showPurchasedKickstarters`),
      ],
      [
        Markup.button.callback('🏠', 'userMenu')
      ]
    ]
  }

  if (!ctx.callbackQuery.message.photo) {
    await ctx.editMessageText(`<b>Кикстартеры</b>\n\nВсего кикстартеров в базе: ${kickstartersData.list.length}`, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard(buttons)
    })
  } else {
    await ctx.deleteMessage();
    await ctx.replyWithHTML(`<b>Кикстартеры</b>\n\nВсего кикстартеров в базе: ${kickstartersData.list.length}`, {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard(buttons)
    })
  }
});