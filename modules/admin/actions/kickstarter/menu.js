const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action('adminKickstarters', async (ctx) => {
  if (!ctx.kickstarters.list) ctx.kickstarters.list = [];

  if (!ctx.callbackQuery.message.photo) {
    await ctx.editMessageText(`Меню работы с кикстартерами\n\nВсего кикстартеров в базе: ${ctx.kickstarters.list.length}`, {
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
    await ctx.replyWithHTML(`Меню работы с кикстартерами\n\nВсего кикстартеров в базе: ${ctx.kickstarters.list.length}`, {
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