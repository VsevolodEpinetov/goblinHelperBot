const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')
const { getMonths, updateMonth } = require('../../db/helpers');

module.exports = Composer.command('thisis', async (ctx) => {
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) { return; }

  const data = ctx.message.text.split('thisis ')[1].split('_');
  const year = data[0], month = data[1], type = data[2];

  const inviteLink = await ctx.createChatInviteLink({
    chat_id: ctx.message.chat.id,
    name: 'Bot handled invitation',
    creates_join_request: true
  })

  // Update month data in PostgreSQL
  await updateMonth(`${year}_${month}`, type, {
    id: ctx.message.chat.id,
    link: inviteLink.invite_link,
    counter: { joined: 0, paid: 0 }
  });
  await ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, `Записал чат с ID ${ctx.message.chat.id} как группу ${type} для ${year}-${month}, ссылка для вступления - ${inviteLink.invite_link}`);
})