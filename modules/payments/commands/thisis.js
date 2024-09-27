const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.command('thisis', async (ctx) => {
  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV) { return; }

  if (!ctx.months.list) ctx.months.list = {};
  
  const data = ctx.message.text.split('thisis ')[1].split('_');
  const year = data[0], month = data[1], type = data[2];

  if (!ctx.months.list[year]) ctx.months.list[year] = {};
  if (!ctx.months.list[year][month]) {
    ctx.months.list[year][month] = {
      regular: {
        link: '',
        id: '',
        counter: 0
      },
      plus: {
        link: '',
        id: '',
        counter: 0
      }
    };
  }

  ctx.months.list[year][month][type].id = ctx.message.chat.id;
  const inviteLink = await ctx.createChatInviteLink({
    chat_id: ctx.message.chat.id,
    name: 'Bot handled invitation',
    creates_join_request: true
  })

  ctx.months.list[year][month][type].link = inviteLink.invite_link;
  await ctx.telegram.sendMessage(SETTINGS.CHATS.EPINETOV, `Записал чат с ID ${ctx.message.chat.id} как группу ${type} для ${year}-${month}, ссылка для вступления - ${inviteLink.invite_link}`);
})