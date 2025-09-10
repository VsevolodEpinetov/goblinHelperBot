const { Scenes, Markup } = require('telegraf');
const { generateProgressBar } = require('../utils');

// Function to post raid announcement in the public topic
async function postRaidAnnouncement(ctx, raid) {
  try {
    const participantCount = raid.participants.length;
    const pricePerPerson = participantCount > 0 ? (raid.price / participantCount).toFixed(2) : raid.price;
    const priceIfOneMore = participantCount > 0 ? (raid.price / (participantCount + 1)).toFixed(2) : raid.price;
    
    // Format participants list
    let participantsText = '';
    if (raid.participants.length > 0) {
      participantsText = raid.participants.map((p, index) => {
        const name = p.username ? `@${p.username}` : `${p.first_name} ${p.last_name}`.trim();
        return `${index + 1}. ${name}`;
      }).join('\n');
    } else {
      participantsText = 'Пока никто не присоединился';
    }

    // Format photos if any
    let photos = [];
    if (raid.photos && raid.photos.length > 0) {
      photos = raid.photos.map(photo => ({
        type: 'photo',
        media: photo.file_id
      }));
    }

    const message = `⚔️ <b>НОВЫЙ РЕЙД #${raid.id}</b>\n\n` +
      `💰 <b>Общая стоимость:</b> ${raid.price} ${raid.currency}\n` +
      `👥 <b>Участников:</b> ${participantCount} чел.\n` +
      `💵 <b>С человека сейчас:</b> ${pricePerPerson} ${raid.currency}\n` +
      `🎯 <b>Если присоединится еще один:</b> ${priceIfOneMore} ${raid.currency}\n\n` +
      `📄 <b>Описание:</b>\n${raid.description || 'Описание не указано'}\n\n` +
      `🔗 <b>Ссылка:</b> ${raid.link || 'Не указана'}\n\n` +
      `📅 <b>Дата окончания:</b> ${raid.end_date ? new Date(raid.end_date).toLocaleDateString('ru-RU') : 'Не указана'}\n\n` +
      `👥 <b>Участники:</b>\n${participantsText}\n\n` +
      `📊 <b>Статус:</b> 🟢 Открыт для присоединения`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('⚔️ Присоединиться к рейду', `raid_join_${raid.id}`)],
      [Markup.button.callback('ℹ️ Подробная информация', `raid_info_${raid.id}`)]
    ]);

    // Post in the raids topic
    const targetChatId = process.env.MAIN_GROUP_ID;
    const targetTopicId = process.env.RAIDS_TOPIC_ID;
    
    if (photos.length > 0) {
      // Send with photos
      const mediaGroup = photos.map((photo, index) => ({
        ...photo,
        caption: index === 0 ? message : undefined,
        parse_mode: 'HTML'
      }));
      
      const sentMessages = await ctx.telegram.sendMediaGroup(targetChatId, mediaGroup, {
        message_thread_id: targetTopicId ? parseInt(targetTopicId) : undefined
      });
      
      // Send keyboard as separate message
      await ctx.telegram.sendMessage(targetChatId, 'Выберите действие:', {
        message_thread_id: targetTopicId ? parseInt(targetTopicId) : undefined,
        reply_markup: keyboard.reply_markup
      });
      
      // Update raid with message IDs
      const messageIds = sentMessages.map(msg => msg.message_id);
      await require('../db/raidsService').updateRaidMessageIds(raid.id, messageIds);
      
    } else {
      // Send without photos
      const sentMessage = await ctx.telegram.sendMessage(targetChatId, message, {
        message_thread_id: targetTopicId ? parseInt(targetTopicId) : undefined,
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup
      });
      
      // Update raid with message ID
      await require('../db/raidsService').updateRaidMessageIds(raid.id, [sentMessage.message_id]);
    }
    
    // Raid posted successfully
    
  } catch (error) {
    console.error('Error posting raid announcement:', error);
    throw error;
  }
}

const reviewScene = new Scenes.BaseScene('RAID_SCENE_REVIEW_STAGE');

reviewScene.enter(async (ctx) => {
  const raidData = ctx.session.raid;
  const progressBar = generateProgressBar(6);
  
  // Format end date
  let endDateText = 'Не указана';
  if (raidData.endDate) {
    const date = new Date(raidData.endDate);
    endDateText = date.toLocaleDateString('ru-RU');
  }
  
  // Format price
  const priceText = raidData.price && raidData.currency ? 
    `${raidData.price} ${raidData.currency}` : 'Не указана';
  
  const message = `👀 <b>Предварительный просмотр рейда</b>\n\n` +
    `📊 <b>Прогресс:</b> ${progressBar}\n\n` +
    `🖼 <b>Фотографии:</b> ${raidData.photos?.length || 0} шт.\n` +
    `🔗 <b>Ссылка:</b> ${raidData.link || 'Не указана'}\n` +
    `💰 <b>Цена:</b> ${priceText}\n` +
    `📄 <b>Описание:</b> ${raidData.description ? 
      (raidData.description.length > 100 ? 
        raidData.description.substring(0, 100) + '...' : 
        raidData.description) : 'Не указано'}\n` +
    `📅 <b>Дата окончания:</b> ${endDateText}\n\n` +
    `✅ <b>Все готово для создания рейда!</b>\n\n` +
    `⚠️ <b>Проверьте данные и подтвердите создание</b>`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('✅ Создать рейд', 'raid_create')],
    [Markup.button.callback('🔙 Назад', 'raid_prev_step')],
    [Markup.button.callback('❌ Отмена', 'raid_cancel')]
  ]);

  await ctx.reply(message, {
    parse_mode: 'HTML',
    ...keyboard
  });
});

reviewScene.action('raid_create', async (ctx) => {
  await ctx.answerCbQuery();
  
  try {
    const raidsService = require('../db/raidsService');
    const raidData = ctx.session.raid;
    
    // Prepare raid data for database
    const dbRaidData = {
      title: 'Рейд без названия', // We can add title field later
      description: raidData.description || '',
      link: raidData.link || '',
      price: raidData.price,
      currency: raidData.currency || 'RUB',
      created_by: ctx.from.id,
      created_by_username: ctx.from.username || 'not_set',
      created_by_first_name: ctx.from.first_name || '',
      created_by_last_name: ctx.from.last_name || '',
      chat_id: ctx.chat.id.toString(),
      message_id: ctx.message?.message_id?.toString() || '',
      end_date: raidData.endDate,
      photos: raidData.photos || [],
      metadata: raidData.metadata || {}
    };

    // Save to database
    const result = await raidsService.createRaid(dbRaidData);
    
    if (!result.success) {
      throw new Error(result.error);
    }

    // Get the created raid with all data
    const createdRaid = await raidsService.getRaidById(result.raidId);
    
    if (!createdRaid) {
      throw new Error('Failed to retrieve created raid');
    }

    // Post raid announcement in the public topic
    await postRaidAnnouncement(ctx, createdRaid);

    // Send confirmation to DM
    const message = `🎉 <b>Рейд создан успешно!</b>\n\n` +
      `⚔️ <b>Рейд #${result.raidId} опубликован в канале</b>\n\n` +
      `📢 <b>Что дальше:</b>\n` +
      `• Участники могут присоединиться через кнопки в канале\n` +
      `• Цена будет автоматически пересчитываться\n` +
      `• Вы получите уведомления о новых участниках\n\n` +
      `💡 <b>Совет:</b> Следите за активностью рейда в канале`;

    await ctx.reply(message, {
      parse_mode: 'HTML'
    });
    
    // Clear session and exit scene
    delete ctx.session.raid;
    ctx.scene.leave();
    
  } catch (error) {
    console.error('Error creating raid:', error);
    await ctx.reply('❌ Произошла ошибка при создании рейда. Попробуйте еще раз');
  }
});

reviewScene.action('raid_prev_step', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.enter('RAID_SCENE_DATE_STAGE');
});

reviewScene.action('raid_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  delete ctx.session.raid;
  await ctx.reply('❌ Создание рейда отменено');
  ctx.scene.leave();
});

reviewScene.on('message', async (ctx, next) => {
  // Only handle messages if user is in this scene
  if (ctx.scene.session && ctx.scene.session.current === 'RAID_SCENE_REVIEW_STAGE') {
    await ctx.reply('👀 Пожалуйста, используйте кнопки для управления рейдом');
  } else {
    return next();
  }
});

module.exports = reviewScene;
