const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')
const { updateMonth } = require('../../db/helpers');

module.exports = Composer.on('channel_post', async (ctx) => {
  const channelID = ctx.channelPost.chat.id;
  const messageText = ctx.channelPost.text;

  if (!messageText) {
    return;
  }

  const data = messageText.split('thisis ')[1].split('_');
  const year = data[0], month = data[1], type = data[2];

  const inviteLink = await ctx.createChatInviteLink({
    chat_id: channelID,
    name: 'Bot handled invitation',
    creates_join_request: true
  })

  // Update month data in PostgreSQL
  await updateMonth(`${year}_${month}`, type, {
    id: channelID,
    link: inviteLink.invite_link,
    counter: { joined: 0, paid: 0 }
  });
  await ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, `Записал чат с ID ${channelID} как группу ${type} для ${year}-${month}, ссылка для вступления - ${inviteLink.invite_link}`);
})