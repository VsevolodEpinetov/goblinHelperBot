const { Composer, Markup } = require('telegraf');
const knex = require('../../db/knex');
const SETTINGS = require('../../../settings.json');
const { logDenied } = require('../../util/logger');
const promoService = require('../../promo/promoService');
const promoUploadScene = require('../scenes/promoUpload');

console.log('📁 promoManagement.js loaded');

const promoCommands = Composer.compose([
  Composer.command('promo', async (ctx) => {
  // Simple authorization check
  const userId = ctx.from.id.toString();
  if (userId !== SETTINGS.CHATS.EPINETOV && userId !== SETTINGS.CHATS.GLAVGOBLIN) {
    logDenied(ctx.from.id, ctx.from.username, '/promo', 'unauthorized');
    return;
  }

  try {
    const promoFiles = await promoService.getAllPromoFiles();
    
    let message = `🪙 <b>Управление промо-файлами</b>\n\n`;
    message += `📊 <b>Всего файлов:</b> ${promoFiles.length}\n`;
    message += `✅ <b>Активных:</b> ${promoFiles.filter(f => f.is_active).length}\n`;
    message += `❌ <b>Неактивных:</b> ${promoFiles.filter(f => !f.is_active).length}\n\n`;
    
    if (promoFiles.length > 0) {
      message += `📋 <b>Последние файлы:</b>\n`;
      promoFiles.slice(0, 5).forEach((file, index) => {
        const status = file.is_active ? '✅' : '❌';
        const date = new Date(file.uploaded_at).toLocaleDateString('ru-RU');
        const size = file.file_size ? `(${Math.round(file.file_size / 1024)}KB)` : '';
        message += `${index + 1}. ${status} ${file.file_type} ${size} - ${date}\n`;
      });
      if (promoFiles.length > 5) {
        message += `... и ещё ${promoFiles.length - 5} файлов\n`;
      }
    }
    
    message += `\n💡 <b>Команды:</b>\n`;
    message += `• <code>/promo</code> - показать статистику\n`;
    message += `• <code>/promo_upload</code> - загрузить несколько файлов (сцена)\n`;
    message += `• <code>/promo_add</code> - добавить один документ (ответом на сообщение)\n`;
    message += `• <code>/promo_list</code> - показать все файлы\n`;
    message += `• <code>/promo_toggle &lt;id&gt;</code> - переключить статус файла\n`;
    message += `• <code>/promo_test</code> - протестировать случайный файл\n\n`;
    message += `📄 <b>Поддерживаются только документы</b>\n`;
    message += `🚀 <b>Рекомендуется:</b> используйте /promo_upload для загрузки нескольких файлов`;

    await ctx.replyWithHTML(message);

  } catch (error) {
    console.error('❌ Error in promo command:', error);
    await ctx.reply(`❌ Ошибка получения статистики: ${error.message}`);
  }
  }),

  // Start promo upload scene
  Composer.command('promo_upload', async (ctx) => {
    console.log('🔍 promo_upload command triggered by:', ctx.from.id, ctx.from.username);
    const userId = ctx.from.id.toString();
    if (userId !== SETTINGS.CHATS.EPINETOV && userId !== SETTINGS.CHATS.GLAVGOBLIN) {
      console.log('❌ Unauthorized user:', userId, 'Expected:', SETTINGS.CHATS.EPINETOV, 'or', SETTINGS.CHATS.GLAVGOBLIN);
      logDenied(ctx.from.id, ctx.from.username, '/promo_upload', 'unauthorized');
      return;
    }
    console.log('✅ User authorized, starting promo upload scene');

    try {
      await ctx.scene.enter('promoUpload');
    } catch (error) {
      console.error('❌ Error starting promo upload scene:', error);
      await ctx.reply('❌ Ошибка запуска сцены загрузки. Попробуйте ещё раз.');
    }
  }),

  // Add promo file command
  Composer.command('promo_add', async (ctx) => {
  console.log('🔍 promo_add command triggered by:', ctx.from.id, ctx.from.username);
  const userId = ctx.from.id.toString();
  if (userId !== SETTINGS.CHATS.EPINETOV && userId !== SETTINGS.CHATS.GLAVGOBLIN) {
    console.log('❌ Unauthorized user:', userId, 'Expected:', SETTINGS.CHATS.EPINETOV, 'or', SETTINGS.CHATS.GLAVGOBLIN);
    logDenied(ctx.from.id, ctx.from.username, '/promo_add', 'unauthorized');
    return;
  }
  console.log('✅ User authorized, proceeding with promo_add');

  try {
    if (!ctx.message.reply_to_message) {
      await ctx.reply('❌ Ответь на сообщение с файлом, чтобы добавить его в промо-коллекцию.');
      return;
    }

    const message = ctx.message.reply_to_message;
    const filesToAdd = [];

    // Extract documents from the message
    if (message.document) {
      filesToAdd.push({
        fileId: message.document.file_id,
        fileType: 'document',
        fileName: message.document.file_name || 'document',
        fileSize: message.document.file_size
      });
    } else if (message.media_group_id) {
      // Handle media group (album) - get all messages in the group
      console.log('📁 Processing media group:', message.media_group_id);
      
      // For now, just process the current message
      // In a real implementation, you'd need to query the database or use a different approach
      // to get all messages in the media group
      await ctx.reply('❌ Медиа-группы (альбомы) не поддерживаются. Добавляй файлы по одному.');
      return;
    } else {
      await ctx.reply('❌ Поддерживаются только документы.');
      return;
    }

    if (filesToAdd.length === 0) {
      await ctx.reply('❌ Файлы не найдены в сообщении.');
      return;
    }

    // Add all files
    let successCount = 0;
    let errorCount = 0;
    const results = [];

    for (const file of filesToAdd) {
      const success = await promoService.addPromoFile(
        file.fileId, 
        file.fileType, 
        file.fileName, 
        file.fileSize, 
        ctx.from.id
      );
      
      if (success) {
        successCount++;
        results.push(`✅ ${file.fileType}: ${file.fileName}`);
      } else {
        errorCount++;
        results.push(`❌ ${file.fileType}: ${file.fileName}`);
      }
    }

    // Send results
    let response = `📁 <b>Результат добавления файлов</b>\n\n`;
    response += `✅ <b>Успешно:</b> ${successCount}\n`;
    response += `❌ <b>Ошибок:</b> ${errorCount}\n\n`;
    
    if (results.length <= 10) {
      response += results.join('\n');
    } else {
      response += results.slice(0, 10).join('\n');
      response += `\n... и ещё ${results.length - 10} файлов`;
    }

    await ctx.replyWithHTML(response);

  } catch (error) {
    console.error('❌ Error in promo_add command:', error);
    await ctx.reply(`❌ Ошибка добавления файлов: ${error.message}`);
  }
  }),

  // List all promo files command
  Composer.command('promo_list', async (ctx) => {
  const userId = ctx.from.id.toString();
  if (userId !== SETTINGS.CHATS.EPINETOV && userId !== SETTINGS.CHATS.GLAVGOBLIN) {
    logDenied(ctx.from.id, ctx.from.username, '/promo_list', 'unauthorized');
    return;
  }

  try {
    const promoFiles = await promoService.getAllPromoFiles();
    
    if (promoFiles.length === 0) {
      await ctx.reply('📭 Промо-файлы не найдены.');
      return;
    }

    let message = `🪙 <b>Все промо-файлы</b>\n\n`;
    
    promoFiles.forEach((file, index) => {
      const status = file.is_active ? '✅' : '❌';
      const date = new Date(file.uploaded_at).toLocaleDateString('ru-RU');
      const size = file.file_size ? `(${Math.round(file.file_size / 1024)}KB)` : '';
      message += `${index + 1}. ID: ${file.id} ${status}\n`;
      message += `   Тип: ${file.file_type} ${size}\n`;
      message += `   Имя: ${file.file_name || 'N/A'}\n`;
      message += `   Дата: ${date}\n\n`;
    });

    // Split message if too long
    if (message.length > 4000) {
      const chunks = message.match(/[\s\S]{1,4000}/g) || [];
      for (const chunk of chunks) {
        await ctx.replyWithHTML(chunk);
      }
    } else {
      await ctx.replyWithHTML(message);
    }

  } catch (error) {
    console.error('❌ Error in promo_list command:', error);
    await ctx.reply(`❌ Ошибка получения списка: ${error.message}`);
  }
  }),

  // Toggle promo file status command
  Composer.command('promo_toggle', async (ctx) => {
  const userId = ctx.from.id.toString();
  if (userId !== SETTINGS.CHATS.EPINETOV && userId !== SETTINGS.CHATS.GLAVGOBLIN) {
    logDenied(ctx.from.id, ctx.from.username, '/promo_toggle', 'unauthorized');
    return;
  }

  try {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      await ctx.reply('❌ Использование: /promo_toggle <id>');
      return;
    }

    const fileId = parseInt(args[1]);
    if (isNaN(fileId)) {
      await ctx.reply('❌ Неверный ID файла.');
      return;
    }

    // Get current status
    const file = await knex('promo_files').where('id', fileId).first();
    if (!file) {
      await ctx.reply('❌ Файл не найден.');
      return;
    }

    const newStatus = !file.is_active;
    const success = await promoService.togglePromoFileStatus(fileId, newStatus);
    
    if (success) {
      const statusText = newStatus ? 'активирован' : 'деактивирован';
      await ctx.reply(`✅ Файл ID ${fileId} ${statusText}.`);
    } else {
      await ctx.reply('❌ Ошибка изменения статуса файла.');
    }

  } catch (error) {
    console.error('❌ Error in promo_toggle command:', error);
    await ctx.reply(`❌ Ошибка изменения статуса: ${error.message}`);
  }
  }),

  // Test random promo file command
  Composer.command('promo_test', async (ctx) => {
  const userId = ctx.from.id.toString();
  if (userId !== SETTINGS.CHATS.EPINETOV && userId !== SETTINGS.CHATS.GLAVGOBLIN) {
    logDenied(ctx.from.id, ctx.from.username, '/promo_test', 'unauthorized');
    return;
  }

  try {
    const promoFile = await promoService.getRandomPromoFile(0); // Use 0 as test user ID
    
    if (!promoFile) {
      await ctx.reply('❌ Нет доступных промо-файлов для тестирования.');
      return;
    }

    // Send the document
    await ctx.replyWithDocument(promoFile.file_id, {
      caption: `🧪 <b>Тестовый файл</b>\nID: ${promoFile.id}\nТип: ${promoFile.file_type}`,
      parse_mode: 'HTML'
    });

  } catch (error) {
    console.error('❌ Error in promo_test command:', error);
    await ctx.reply(`❌ Ошибка тестирования: ${error.message}`);
  }
  })
]);

module.exports = promoCommands;
