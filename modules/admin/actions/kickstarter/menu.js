const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { getKickstarters } = require('../../../db/helpers');

module.exports = Composer.action('adminKickstarters', async (ctx) => {
  const kickstartersData = await getKickstarters();

  if (!ctx.callbackQuery.message.photo) {
    await ctx.editMessageText(`Меню работы с кикстартерами\n\nВсего кикстартеров в базе: ${kickstartersData.list.length}`, {
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('+', 'adminAddKickstarter'),
          Markup.button.callback('🔍', 'searchKickstarter'),
          Markup.button.callback('✏️', 'adminEditKickstarter')
        ],
        [
          Markup.button.callback('←', 'adminMenu')
        ]
      ])
    })
  } else {
    await ctx.deleteMessage();
    await ctx.replyWithHTML(`Меню работы с кикстартерами\n\nВсего кикстартеров в базе: ${kickstartersData.list.length}`, {
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('+', 'adminAddKickstarter'),
          Markup.button.callback('🔍', 'searchKickstarter'),
          Markup.button.callback('✏️', 'adminEditKickstarter')
        ],
        [
          Markup.button.callback('←', 'adminMenu')
        ]
      ])
    })
  }
});