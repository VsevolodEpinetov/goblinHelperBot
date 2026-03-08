const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { getAllUsers, updateUser } = require('../../../db/helpers');
const { ensureRoles } = require('../../../rbac');

const SUPER_ROLES = ['super'];

module.exports = Composer.action('removeRejected', async (ctx) => {
  const check = await ensureRoles(ctx, SUPER_ROLES);
  if (!check.allowed) return;

  const usersData = await getAllUsers();
  const users = JSON.parse(JSON.stringify(usersData.list));
  let totalAmountOfUsers = Object.keys(users).length;
  let removedCount = 0;

  for (const userId in users) {
    const user = users[userId];
    if (user.roles && user.roles.length === 1 && user.roles.includes('rejected')) {
      delete users[userId];
      removedCount++;
    }
  }

  // Note: User data is now managed through database, no need to update ctx.users.list

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