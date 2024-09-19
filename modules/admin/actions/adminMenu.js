const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const SETTINGS = require('../../../settings.json');

module.exports = Composer.action(/^adminMenu/g, async (ctx) => {
  await ctx.editMessageText(`Выбери нужное действие`, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('Месяцы', 'adminMonths'),
        Markup.button.callback('Месяцы Плюс', 'adminMonthsPlus')
      ],
      [
        Markup.button.callback('Кикстартеры', 'adminKickstarters'),
        Markup.button.callback('Релизы', 'adminReleases')
      ],
      [
        Markup.button.callback('Люди', 'adminParticipants')
      ]
    ])
  })
});