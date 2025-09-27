const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action('removeRejected', async (ctx) => {
  const users = JSON.parse(JSON.stringify(ctx.users.list));
  let totalAmountOfUsers = Object.keys(users).length;
  let removedCount = 0;

  for (const userId in users) {
    const user = users[userId];
    if (user.roles && user.roles.length === 1 && user.roles.includes('rejected')) {
      delete users[userId];
      removedCount++;
    }
  }

  ctx.users.list = users;

  await ctx.editMessageText(`✅ <i>Все лишние (${removedCount}) были удалены</i>\n\nВсего зарегистрировано: ${totalAmountOfUsers}`, {
    parse_mode: "HTML",
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🔍', 'searchUser'),
        Markup.button.callback('🗑', 'removeRejected')
      ],
      [
        Markup.button.callback('←', `userMenu`)
      ]
    ])
  })

});