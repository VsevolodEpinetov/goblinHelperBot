const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { getAllUsers } = require('../../../db/helpers');

module.exports = Composer.action(/^adminParticipants/g, async (ctx) => {
  const usersData = await getAllUsers();
  const totalAmountOfUsers = Object.keys(usersData.list).length;

  await ctx.editMessageText(`👤 <b>Пользователи</b>\n\nВсего зарегистрировано: ${totalAmountOfUsers}`,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('🔍', 'searchUser'),
          Markup.button.callback('🗑', 'removeRejected')
        ],
        [
          Markup.button.callback('🔗 Ссылки', 'adminInviteLinksMenu')
        ],
        [
          Markup.button.callback('←', `adminMenu`)
        ]
      ])
    }
  )
});