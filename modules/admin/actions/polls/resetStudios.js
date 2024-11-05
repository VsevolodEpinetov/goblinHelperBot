const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const STUDIOS = require('../../../../studios.json');

module.exports = Composer.action('adminPollsStudiosReset', async (ctx) => {
  ctx.polls.studios = [];
  await ctx.editMessageText(`✅ <i>Все добавленные студии были <b>сброшены</b></i>\n\n<u>Добавленные студии:</u>\n${ctx.polls.studios.join('\n')}`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('+/-', 'adminPollsStudiosAdd'),
        Markup.button.callback('Сбросить', 'adminPollsStudiosReset'),
      ],
      [
        Markup.button.callback('←', 'adminPolls')
      ]
    ])
  })
});