const { Scenes, Markup } = require("telegraf");
const util = require('../../../util');
const knex = require('../../../db/knex');
const { addKickstarter } = require('../../../db/helpers');
const { sendKickstarterPromo } = require('../../actions/kickstarter/util/kickstarterPromo');

const currentStageName = 'ADMIN_SCENE_ADD_KICKSTARTER_FILES'

const adminAddKickstarterFiles = new Scenes.BaseScene(currentStageName);

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

adminAddKickstarterFiles.enter(async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  // Check if this is editing mode (adding files to existing kickstarter)
  const isEditing = ctx.session.editingKickstarter && ctx.session.editingKickstarter.field === 'addFiles';
  
  if (isEditing) {
    if (!ctx.session.editingKickstarter.files) {
      ctx.session.editingKickstarter.files = [];
    }
    const message = await ctx.replyWithHTML(
      `Пришли <b>файлы</b> для добавления\n\nЗагружено файлов: ${ctx.session.editingKickstarter.files.length}`,
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Готово', 'finishedAddFiles')],
        [Markup.button.callback('❌ Отмена', 'cancelKickstarterEdit')]
      ])
    );
    ctx.session.toEdit = message.message_id;
    ctx.session.chatID = message.chat.id;
  } else {
    // New kickstarter mode
    if (!ctx.session.kickstarter.files) {
      ctx.session.kickstarter.files = [];
    }

    await ctx.telegram.editMessageText(
      ctx.session.chatID,
      ctx.session.toEdit,
      undefined,
      `Пришли <b>файлы</b> проекта\n\nЗагружено файлов: ${ctx.session.kickstarter.files.length}`,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Готово', 'finishedFiles')],
          [Markup.button.callback('❌ Отмена', 'cancelKickstarterAdd')]
        ])
      }
    );
  }
});

adminAddKickstarterFiles.action('cancelKickstarterAdd', async (ctx) => {
  ctx.session.kickstarter = null;
  await ctx.answerCbQuery('Отменено');
  await ctx.scene.leave();
  await ctx.reply('❌ Добавление кикстартера отменено');
});

adminAddKickstarterFiles.on('document', async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  const doc = ctx.message.document;
  const isEditing = ctx.session.editingKickstarter && ctx.session.editingKickstarter.field === 'addFiles';
  
  const fileInfo = {
    fileId: doc.file_id,
    fileName: doc.file_name || 'Без имени',
    fileSize: doc.file_size || 0
  };

  if (isEditing) {
    ctx.session.editingKickstarter.files.push(fileInfo);
  } else {
    ctx.session.kickstarter.files.push(fileInfo);
  }

  await ctx.deleteMessage(ctx.message.message_id);

  // Build file list message
  const files = isEditing ? ctx.session.editingKickstarter.files : ctx.session.kickstarter.files;
  let fileListMessage = isEditing ? 
    `Пришли <b>файлы</b> для добавления\n\n` :
    `Пришли <b>файлы</b> проекта\n\n`;
  fileListMessage += `Загружено файлов: <b>${files.length}</b>\n\n`;
  
  if (files.length > 0) {
    fileListMessage += `<b>Список файлов:</b>\n`;
    files.forEach((file, index) => {
      const size = formatFileSize(file.fileSize);
      fileListMessage += `${index + 1}. ${file.fileName} (${size})\n`;
    });
  }

  const actionButton = isEditing ? 'finishedAddFiles' : 'finishedFiles';
  const cancelButton = isEditing ? 'cancelKickstarterEdit' : 'cancelKickstarterAdd';

  await ctx.telegram.editMessageText(
    ctx.session.chatID,
    ctx.session.toEdit,
    undefined,
    fileListMessage,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Готово', actionButton)],
        [Markup.button.callback('❌ Отмена', cancelButton)]
      ])
    }
  );
});

adminAddKickstarterFiles.action('finishedFiles', async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  await ctx.answerCbQuery('Сохраняю...');
  
  try {
    // Convert files array to fileId array for database
    const filesData = ctx.session.kickstarter.files.map(f => f.fileId);
    ctx.session.kickstarter.files = filesData;

    // Add kickstarter to database
    const kickstarterId = await addKickstarter(ctx.session.kickstarter);

    // Send promo message
    const promoResult = await sendKickstarterPromo(ctx, ctx.session.kickstarter, kickstarterId);

    let successMessage = `✅ <b>Кикстартер успешно добавлен!</b>\n\n`;
    successMessage += `ID: <b>${kickstarterId}</b>\n`;
    
    if (promoResult.success) {
      successMessage += `📢 Промо-сообщение отправлено в группу`;
    } else {
      successMessage += `⚠️ Ошибка отправки промо: ${promoResult.error}`;
    }

    await ctx.telegram.editMessageText(
      ctx.session.chatID,
      ctx.session.toEdit,
      undefined,
      successMessage,
      {
        parse_mode: "HTML",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('➕ Добавить новый', 'adminAddKickstarter'),
            Markup.button.callback('🔍 Поиск', 'searchKickstarter')
          ],
          [
            Markup.button.callback('🔙 Назад', 'adminKickstarters')
          ]
        ])
      }
    );

    ctx.session.kickstarter = null;
    await ctx.scene.leave();
  } catch (error) {
    console.error('Error saving kickstarter:', error);
    await ctx.reply(`❌ Ошибка при сохранении кикстартера: ${error.message}`);
    await ctx.scene.leave();
  }
});

adminAddKickstarterFiles.action('finishedAddFiles', async (ctx) => {
  if (!util.isSuperUser(ctx.from.id) || ctx.chat.type !== 'private') {
    await ctx.reply('❌ Доступ запрещён');
    return ctx.scene.leave();
  }

  await ctx.answerCbQuery('Сохраняю...');
  
  try {
    const kickstarterId = ctx.session.editingKickstarter.id;
    const filesData = ctx.session.editingKickstarter.files.map(f => f.fileId);

    // Get current files count
    const currentFiles = await knex('kickstarterFiles')
      .where('kickstarterId', kickstarterId)
      .select('ord')
      .orderBy('ord', 'desc')
      .first();
    
    const startOrd = currentFiles ? currentFiles.ord + 1 : 1;

    // Insert new files
    if (filesData.length > 0) {
      const fileInserts = filesData.map((fileId, index) => ({
        kickstarterId: kickstarterId,
        ord: startOrd + index,
        fileId: fileId
      }));
      await knex('kickstarterFiles').insert(fileInserts);
    }

    await ctx.telegram.editMessageText(
      ctx.session.chatID,
      ctx.session.toEdit,
      undefined,
      `✅ Файлы добавлены!\n\nДобавлено файлов: <b>${filesData.length}</b>`,
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
    console.error('Error adding files:', error);
    await ctx.reply(`❌ Ошибка при добавлении файлов: ${error.message}`);
    await ctx.scene.leave();
  }
});

adminAddKickstarterFiles.action('cancelKickstarterEdit', async (ctx) => {
  ctx.session.editingKickstarter = null;
  await ctx.answerCbQuery('Отменено');
  await ctx.scene.leave();
  await ctx.reply('❌ Редактирование отменено');
});

module.exports = adminAddKickstarterFiles;