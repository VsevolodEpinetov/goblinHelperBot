const { Composer, Markup } = require("telegraf");
const util = require('../../util');
const SETTINGS = require('../../../settings.json');

module.exports = Composer.action(/^adminMenu/g, async (ctx) => {
  await ctx.editMessageText(`Выбери нужное действие`, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('Месяцы', 'adminMonths'),
        Markup.button.callback('🔔 Напомнить', 'adminRemind')
      ],
      [
        Markup.button.callback('Кикстартеры', 'adminKickstarters'),
        Markup.button.callback('Релизы', 'adminReleases')
      ],
      [
        Markup.button.callback('Люди', 'adminParticipants'),
        Markup.button.callback('Голосования', 'adminPolls'),
      ],
      [
        Markup.button.callback('💫 Баланс звёзд', 'adminStarsBalance'),
        Markup.button.callback('💸 Вывод звёзд', 'adminStarsWithdraw')
      ]
    ])
  })
});