const { Composer, Markup } = require("telegraf");
const util = require('../../../util');
const SETTINGS = require('../../../../settings.json');
const { getKickstarter } = require('../../../db/helpers');

module.exports = Composer.action(/^sendFilesKickstarter_/g, async (ctx) => {
  try {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  } catch (e) {
    await ctx.replyWithHTML(`Из-за ограничений телеграма тебе нужно использовать /start ещё раз. Старое сообщение останется, можешь его удалить вручную, если мешает.`)
    return;
  }
  const ksId = ctx.callbackQuery.data.split('_')[2];
  const userId = ctx.callbackQuery.data.split('_')[1];
  const ksData = await getKickstarter(ksId);
  
  if (!ksData) {
    await ctx.replyWithHTML('Кикстартер не найден');
    return;
  }

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

  const chunkArray = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  if (ksData.files.length > 1) {
    const chunks = chunkArray(ksData.files, 10);
    for (const chunk of chunks) {
      await ctx.replyWithMediaGroup(
        chunk.map((p) => ({
          type: 'document',
          media: p
        }))
      );
    }
  } else {
    await ctx.replyWithDocument(ksData.files[0], {
      type: 'document'
    })
  }

  await ctx.telegram.sendMessage(SETTINGS.CHATS.LOGS, `ℹ️ user ${userId} got kickstarter ${ksId} files (${ksData.creator} - ${ksData.name})`)
});