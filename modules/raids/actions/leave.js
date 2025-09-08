const { Markup } = require('telegraf');
const raidsService = require('../db/raidsService');

// Helper function to update public raid message (same as in join.js)
async function updatePublicRaidMessage(ctx, raid) {
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

    const message = `⚔️ <b>РЕЙД #${raid.id}</b>\n\n` +
      `💰 <b>Общая стоимость:</b> ${raid.price} ${raid.currency}\n` +
      `👥 <b>Участников:</b> ${participantCount} чел.\n` +
      `💵 <b>С человека сейчас:</b> ${pricePerPerson} ${raid.currency}\n` +
      `🎯 <b>Если присоединится еще один:</b> ${priceIfOneMore} ${raid.currency}\n\n` +
      `📄 <b>Описание:</b>\n${raid.description || 'Описание не указано'}\n\n` +
      `🔗 <b>Ссылка:</b> ${raid.link || 'Не указана'}\n\n` +
      `📅 <b>Дата окончания:</b> ${raid.end_date ? new Date(raid.end_date).toLocaleDateString('ru-RU') : 'Не указана'}\n\n` +
      `👥 <b>Участники:</b>\n${participantsText}\n\n` +
      `📊 <b>Статус:</b> ${raid.status === 'open' ? '🟢 Открыт' : '🔴 Закрыт'}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('⚔️ Присоединиться к рейду', `raid_join_${raid.id}`)]
    ]);

    // Update the message in the public topic
    console.log(`🔍 Attempting to update public message for raid ${raid.id}, message_id: ${raid.message_id}`);
    if (raid.message_id) {
      try {
        // Check if this is a media group (multiple message IDs in metadata)
        const messageIds = raid.metadata?.messageIds || [raid.message_id];
        console.log(`🔍 Message IDs for raid ${raid.id}:`, messageIds);
        
        if (messageIds.length > 1) {
          // This is a media group - send a new text message with updated info
          console.log(`🔍 Sending new message for media group raid ${raid.id}`);
          const newMessage = await ctx.telegram.sendMessage(
            process.env.MAIN_GROUP_ID,
            `📊 <b>ОБНОВЛЕНИЕ РЕЙДА #${raid.id}</b>\n\n` + message,
            {
              message_thread_id: process.env.RAIDS_TOPIC_ID ? parseInt(process.env.RAIDS_TOPIC_ID) : undefined,
              parse_mode: 'HTML',
              reply_markup: keyboard.reply_markup
            }
          );
          console.log(`✅ New update message sent for raid ${raid.id}: ${newMessage.message_id}`);
        } else {
          // This is a single text message - edit it
          await ctx.telegram.editMessageText(
            process.env.MAIN_GROUP_ID,
            raid.message_id,
            undefined,
            message,
            {
              parse_mode: 'HTML',
              reply_markup: keyboard.reply_markup
            }
          );
          console.log(`✅ Public message updated for raid ${raid.id}`);
        }
      } catch (error) {
        console.log('❌ Could not update public raid message:', error.message);
        // Fallback: send a new message
        try {
          const fallbackMessage = await ctx.telegram.sendMessage(
            process.env.MAIN_GROUP_ID,
            `📊 <b>ОБНОВЛЕНИЕ РЕЙДА #${raid.id}</b>\n\n` + message,
            {
              message_thread_id: process.env.RAIDS_TOPIC_ID ? parseInt(process.env.RAIDS_TOPIC_ID) : undefined,
              parse_mode: 'HTML',
              reply_markup: keyboard.reply_markup
            }
          );
          console.log(`✅ Fallback message sent for raid ${raid.id}: ${fallbackMessage.message_id}`);
        } catch (fallbackError) {
          console.log('❌ Fallback message also failed:', fallbackError.message);
        }
      }
    } else {
      console.log(`❌ No message_id found for raid ${raid.id}, cannot update public message`);
    }
  } catch (error) {
    console.error('Error updating public raid message:', error);
  }
}

module.exports = async (ctx) => {
  try {
    // Check if this is a callback query with match data
    if (!ctx.match || !ctx.match[1]) {
      return;
    }
    
    const raidId = parseInt(ctx.match[1]);
    const userId = ctx.from.id;

    // Try to leave the raid
    const result = await raidsService.leaveRaid(raidId, userId);
    
    if (!result.success) {
      await ctx.answerCbQuery(`❌ ${result.error}`, { show_alert: true });
      return;
    }

    // Get updated raid data
    const raid = await raidsService.getRaidById(raidId);
    if (!raid) {
      await ctx.answerCbQuery('❌ Рейд не найден', { show_alert: true });
      return;
    }

    // Calculate new price per person
    const participantCount = raid.participants.length;
    const pricePerPerson = participantCount > 0 ? (raid.price / participantCount).toFixed(2) : raid.price;

    await ctx.answerCbQuery(`✅ Вы покинули рейд. Теперь с человека: ${pricePerPerson} ${raid.currency}`);
    
    // Update the public raid message
    await updatePublicRaidMessage(ctx, raid);

  } catch (error) {
    console.error('Error leaving raid:', error);
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('❌ Произошла ошибка при выходе из рейда', { show_alert: true });
    }
  }
};
