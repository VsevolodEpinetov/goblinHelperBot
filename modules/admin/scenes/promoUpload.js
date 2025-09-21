const { Scenes, Markup } = require('telegraf');
const SETTINGS = require('../../../settings.json');
const { logDenied } = require('../../util/logger');
const promoService = require('../../promo/promoService');

const promoUploadScene = new Scenes.BaseScene('promoUpload');

// Scene entry point
promoUploadScene.enter(async (ctx) => {
  // Authorization check
  const userId = ctx.from.id.toString();
  if (userId !== SETTINGS.CHATS.EPINETOV) {
    await ctx.reply('❌ У вас нет прав для использования этой функции.');
    return ctx.scene.leave();
  }

  ctx.session.promoFiles = [];
  
  await ctx.reply(
    '📁 <b>Загрузка промо-файлов</b>\n\n' +
    'Отправляйте документы по одному. Я буду их собирать.\n\n' +
    'Когда закончите, отправьте <code>/done</code>',
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'cancel_promo_upload')]
      ])
    }
  );
});

// Handle document uploads
promoUploadScene.on('document', async (ctx) => {
  try {
    const document = ctx.message.document;
    
    // Add file to session
    ctx.session.promoFiles.push({
      fileId: document.file_id,
      fileName: document.file_name || 'document',
      fileSize: document.file_size
    });
    
    const count = ctx.session.promoFiles.length;
    await ctx.reply(
      `✅ <b>Файл ${count} добавлен:</b> ${document.file_name || 'document'}\n\n` +
      `📊 <b>Всего файлов:</b> ${count}\n\n` +
      'Продолжайте отправлять файлы или напишите <code>/done</code> для завершения.',
      { parse_mode: 'HTML' }
    );
    
  } catch (error) {
    console.error('❌ Error processing document in promo upload scene:', error);
    await ctx.reply('❌ Ошибка обработки файла. Попробуйте ещё раз.');
  }
});

// Handle /done command
promoUploadScene.command('done', async (ctx) => {
  try {
    if (!ctx.session.promoFiles || ctx.session.promoFiles.length === 0) {
      await ctx.reply('❌ Нет файлов для загрузки. Сцена завершена.');
      return ctx.scene.leave();
    }
    
    const files = ctx.session.promoFiles;
    let successCount = 0;
    let errorCount = 0;
    const results = [];
    
    // Process all files
    for (const file of files) {
      const success = await promoService.addPromoFile(
        file.fileId,
        'document',
        file.fileName,
        file.fileSize,
        ctx.from.id
      );
      
      if (success) {
        successCount++;
        results.push(`✅ ${file.fileName}`);
      } else {
        errorCount++;
        results.push(`❌ ${file.fileName}`);
      }
    }
    
    // Send results
    let response = `📁 <b>Результат загрузки</b>\n\n`;
    response += `✅ <b>Успешно:</b> ${successCount}\n`;
    response += `❌ <b>Ошибок:</b> ${errorCount}\n\n`;
    
    if (results.length <= 10) {
      response += results.join('\n');
    } else {
      response += results.slice(0, 10).join('\n');
      response += `\n... и ещё ${results.length - 10} файлов`;
    }
    
    await ctx.replyWithHTML(response);
    
    // Clear session and leave scene
    ctx.session.promoFiles = [];
    await ctx.scene.leave();
    
  } catch (error) {
    console.error('❌ Error in promo upload done command:', error);
    await ctx.reply('❌ Ошибка завершения загрузки. Сцена завершена.');
    await ctx.scene.leave();
  }
});

// Handle cancel button
promoUploadScene.action('cancel_promo_upload', async (ctx) => {
  const count = ctx.session.promoFiles ? ctx.session.promoFiles.length : 0;
  ctx.session.promoFiles = [];
  
  await ctx.answerCbQuery('❌ Загрузка отменена');
  await ctx.editMessageText(
    `❌ <b>Загрузка отменена</b>\n\n` +
    `Было собрано файлов: ${count}`,
    { parse_mode: 'HTML' }
  );
  
  await ctx.scene.leave();
});

// Handle other messages
promoUploadScene.on('text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) {
    // Let other commands pass through
    return;
  }
  
  await ctx.reply(
    '📁 Отправляйте документы или используйте <code>/done</code> для завершения.',
    { parse_mode: 'HTML' }
  );
});

// Handle non-document files
promoUploadScene.on('photo', async (ctx) => {
  await ctx.reply('❌ Поддерживаются только документы. Отправьте документ.');
});

promoUploadScene.on('video', async (ctx) => {
  await ctx.reply('❌ Поддерживаются только документы. Отправьте документ.');
});

promoUploadScene.on('animation', async (ctx) => {
  await ctx.reply('❌ Поддерживаются только документы. Отправьте документ.');
});

promoUploadScene.on('sticker', async (ctx) => {
  await ctx.reply('❌ Поддерживаются только документы. Отправьте документ.');
});

module.exports = promoUploadScene;
