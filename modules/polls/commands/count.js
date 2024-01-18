const { Composer } = require("telegraf");
const SETTINGS = require('../../../settings.json')
const util = require('../../util')

module.exports = Composer.command('count', async (ctx) => {
  util.log(ctx)
  if (
    ctx.message.chat.id != SETTINGS.CHATS.EPINETOV &&
    ctx.message.chat.id != SETTINGS.CHATS.TEST &&
    ctx.message.chat.id != SETTINGS.CHATS.GOBLIN
  ) { return; }

  if (ctx.message.from.id != SETTINGS.CHATS.EPINETOV || ctx.message.from.id == SETTINGS.CHATS.ARTYOM) { return; }

  if (!ctx.message.reply_to_message) {
    ctx.reply('Ты промахнулся')
  } else if (!ctx.message.reply_to_message.poll) {
    ctx.reply('Промах')
  } else {
    const data = ctx.message.reply_to_message.poll;
    let message = `📝 Результаты <b>${data.question}</b>\n\n<i>Всего проголосовало: ${data.total_voter_count}</i>\n`
    let totalCount = 0;
    await ctx.getChatMembersCount().then((count) => {
      totalCount = count - 1;

    }).catch((err) => {
      console.log(err)
      ctx.reply('Не удалось получить количество участников')
    })
    const notVoted = totalCount - data.total_voter_count;
    if (notVoted > 0) message += `<i>Ждём ещё ${notVoted} участников</i>\n`;

    data.options.forEach(studio => {
      if (studio.text !== 'Пустой вариант') {
        const percent = Math.ceil((studio.voter_count / totalCount) * 100);
        message += `\n`
        message += `${percent > 34 ? '🌟 <b>' : ''}${studio.text.split(' - ')[0]} - ${percent}%${percent > 34 ? '</b>' : ''}`
      }
    })
    ctx.reply(message, {
      parse_mode: "HTML"
    });
  }
})