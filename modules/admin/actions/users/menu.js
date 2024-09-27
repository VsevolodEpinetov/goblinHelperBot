const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action(/^adminParticipants/g, async (ctx) => {
  const totalAmountOfUsers = Object.keys(ctx.users.list).length;

  await ctx.editMessageText(`👤 <b>Пользователи</b>\n\nВсего зарегистрировано: ${totalAmountOfUsers}`, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🔍', 'searchUser')
      ],
      [
        Markup.button.callback('←', `adminMenu`)
      ]
    ])
  })
});