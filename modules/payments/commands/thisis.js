const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')
const { getMonths, updateMonth } = require('../../db/helpers');
const knex = require('../../db/knex');

module.exports = Composer.command('thisis', async (ctx) => {
  if (ctx.message.from.id.toString() !== SETTINGS.CHATS.EPINETOV && ctx.message.from.id.toString() !== SETTINGS.CHATS.GLAVGOBLIN) { 
    console.log(`❌ thisis command rejected: user ${ctx.message.from.id} is not EPINETOV (${SETTINGS.CHATS.EPINETOV}) or GLAVGOBLIN (${SETTINGS.CHATS.GLAVGOBLIN})`);
    return; 
  }

  console.log(`✅ thisis command received from authorized user: ${ctx.message.text}`);
  
  const data = ctx.message.text.split('thisis ')[1].split('_');
  const year = data[0], month = data[1], type = data[2];
  
  console.log(`📅 Parsed data: year=${year}, month=${month}, type=${type}`);

  const inviteLink = await ctx.createChatInviteLink({
    chat_id: ctx.message.chat.id,
    name: 'Bot handled invitation',
    creates_join_request: true
  })
  
  console.log(`🔗 Created invite link: ${inviteLink.invite_link}`);

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
    id: ctx.message.chat.id,
    counter: { joined: 0, paid: 0 }
  });
  
  await ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, `Записал чат с ID ${ctx.message.chat.id} как группу ${type} для ${year}-${month}, ссылка для вступления - ${inviteLink.invite_link}`);
  await ctx.telegram.sendMessage(SETTINGS.CHATS.GLAVGOBLIN, `Записал чат с ID ${ctx.message.chat.id} как группу ${type} для ${year}-${month}, ссылка для вступления - ${inviteLink.invite_link}`);
})