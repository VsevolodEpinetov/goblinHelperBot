const { Scenes, Markup } = require("telegraf");
const util = require('../../../util');
const knex = require('../../../db/knex');

const currentStageName = 'ADMIN_SCENE_REPLACE_KICKSTARTER_FILES'

const adminReplaceKickstarterFiles = new Scenes.BaseScene(currentStageName);

// Helper function to format file size
function formatFileSize(bytes) {
  if (!bytes) return 'N/A';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(2)} MB`;
  }
  const kb = bytes / 1024;
  return `${kb.toFixed(2)} KB`;
}

adminReplaceKickstarterFiles.enter(async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  if (!ctx.session.editingKickstarter.files) {
    ctx.session.editingKickstarter.files = [];
  }

  const message = await ctx.replyWithHTML(
    `Пришли <b>файлы</b> для замены\n\nЗагружено файлов: ${ctx.session.editingKickstarter.files.length}`,
    Markup.inlineKeyboard([
      [Markup.button.callback('✅ Готово', 'finishedReplaceFiles')],
      [Markup.button.callback('❌ Отмена', 'cancelKickstarterEdit')]
    ])
  );
  ctx.session.toEdit = message.message_id;
  ctx.session.chatID = message.chat.id;
});

adminReplaceKickstarterFiles.action('cancelKickstarterEdit', async (ctx) => {
  ctx.session.editingKickstarter = null;
  await ctx.answerCbQuery('Отменено');
  await ctx.scene.leave();
  await ctx.reply('❌ Редактирование отменено');
});

adminReplaceKickstarterFiles.on('document', async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  const doc = ctx.message.document;
  ctx.session.editingKickstarter.files.push({
    fileId: doc.file_id,
    fileName: doc.file_name || 'Без имени',
    fileSize: doc.file_size || 0
  });

  await ctx.deleteMessage(ctx.message.message_id);

  // Build file list message
  let fileListMessage = `Пришли <b>файлы</b> для замены\n\n`;
  fileListMessage += `Загружено файлов: <b>${ctx.session.editingKickstarter.files.length}</b>\n\n`;
  
  if (ctx.session.editingKickstarter.files.length > 0) {
    fileListMessage += `<b>Список файлов:</b>\n`;
    ctx.session.editingKickstarter.files.forEach((file, index) => {
      const size = formatFileSize(file.fileSize);
      fileListMessage += `${index + 1}. ${file.fileName} (${size})\n`;
    });
  }

  await ctx.telegram.editMessageText(
    ctx.session.chatID,
    ctx.session.toEdit,
    undefined,
    fileListMessage,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Готово', 'finishedReplaceFiles')],
        [Markup.button.callback('❌ Отмена', 'cancelKickstarterEdit')]
      ])
    }
  );
});

adminReplaceKickstarterFiles.action('finishedReplaceFiles', async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  await ctx.answerCbQuery('Сохраняю...');

  try {
    const kickstarterId = ctx.session.editingKickstarter.id;
    const filesData = ctx.session.editingKickstarter.files.map(f => f.fileId);

    // Delete old files
    await knex('kickstarterFiles').where('kickstarterId', kickstarterId).del();

    // Insert new files
    if (filesData.length > 0) {
      const fileInserts = filesData.map((fileId, index) => ({
        kickstarterId: kickstarterId,
        ord: index + 1,
        fileId: fileId
      }));
      await knex('kickstarterFiles').insert(fileInserts);
    }

    await ctx.telegram.editMessageText(
      ctx.session.chatID,
      ctx.session.toEdit,
      undefined,
      `✅ Файлы заменены!\n\nКоличество файлов: <b>${filesData.length}</b>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Назад', 'adminKickstarters')]
        ])
      }
    );

    ctx.session.editingKickstarter = null;
    await ctx.scene.leave();
  } catch (error) {
    console.error('Error replacing files:', error);
    await ctx.reply(`❌ Ошибка при замене файлов: ${error.message}`);
    await ctx.scene.leave();
  }
});

module.exports = adminReplaceKickstarterFiles;