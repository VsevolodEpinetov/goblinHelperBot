const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');

module.exports = Composer.action(/^sendFilesKickstarter_/g, async (ctx) => {
  await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  const ksId = ctx.callbackQuery.data.split('_')[2];
  const userId = ctx.callbackQuery.data.split('_')[1];
  const ksData = ctx.kickstarters.list[ksId];

  if (ksData.photos.length > 1) {
    await ctx.replyWithMediaGroup(
      ksData.photos.map((p, id) => {
        return {
          type: 'photo',
          media: p,
          caption: id === 0
            ? `<b>${ksData.creator}</b>\n<i>${ksData.name}</i>`
            : null,
          parse_mode: 'HTML'
        };
      })
    );
  } else {
    await ctx.replyWithPhoto(ksData.photos[0], {
      type: 'photo',
      caption: `<b>${ksData.creator}</b>\n<i>${ksData.name}</i>`,
      parse_mode: "HTML"
    })
  }

  if (ksData.files.length > 1) {
    await ctx.replyWithMediaGroup(
      ksData.files.map((p, id) => {
        return {
          type: 'document',
          media: p
        };
      })
    );
  } else {
    await ctx.replyWithDocument(ksData.files[0], {
      type: 'document'
    })
  }

  await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `ℹ️ user ${userId} got kickstarter ${ksId} files (${ksData.creator} - ${ksData.name})`)
});