const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')
const { updateMonth } = require('../../db/helpers');
const knex = require('../../db/knex');

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

  // Store invitation link in invitationLinks table (group link)
  await knex('invitationLinks').insert({
    userId: null, // Group link, not user-specific
    groupPeriod: `${year}_${month}`,
    groupType: type,
    telegramInviteLink: inviteLink.invite_link,
    telegramInviteLinkName: inviteLink.name,
    telegramInviteLinkCreatorId: inviteLink.creator?.id,
    telegramInviteLinkIsPrimary: inviteLink.is_primary || false,
    telegramInviteLinkIsRevoked: inviteLink.is_revoked || false,
    telegramInviteLinkExpireDate: inviteLink.expire_date ? new Date(inviteLink.expire_date * 1000) : null,
    telegramInviteLinkMemberLimit: inviteLink.member_limit || 1,
    createsJoinRequest: inviteLink.creates_join_request || true,
    useCount: 0,
    createdAt: new Date()
  });

  // Update month data in PostgreSQL (without link since it's now in invitationLinks)
  await updateMonth(`${year}_${month}`, type, {
    id: channelID,
    counter: { joined: 0, paid: 0 }
  });
  
  await ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, `Записал чат с ID ${channelID} как группу ${type} для ${year}-${month}, ссылка для вступления - ${inviteLink.invite_link}`);
  await ctx.telegram.sendMessage(SETTINGS.CHATS.GLAVGOBLIN, `Записал чат с ID ${channelID} как группу ${type} для ${year}-${month}, ссылка для вступления - ${inviteLink.invite_link}`);
})