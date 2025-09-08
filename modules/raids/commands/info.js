const { Markup } = require('telegraf');
const raidsService = require('../db/raidsService');

module.exports = async (ctx) => {
  try {
    // Check if this is a callback query with match data
    if (!ctx.match || !ctx.match[1]) {
      // This is not a raid info callback, ignore
      return;
    }
    
    const raidId = parseInt(ctx.match[1]);
    
    // Get raid data
    const raid = await raidsService.getRaidById(raidId);
    if (!raid) {
      await ctx.answerCbQuery('❌ Рейд не найден', { show_alert: true });
      return;
    }

    // Check if user is participating
    const isParticipating = raid.participants.some(p => p.user_id === ctx.from.id);
    const isCreator = raid.created_by === ctx.from.id;

    // Calculate price per person
    const participantCount = raid.participants.length;
    const pricePerPerson = participantCount > 0 ? (raid.price / participantCount).toFixed(2) : raid.price;

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

    const message = `⚔️ <b>Рейд #${raidId}</b>\n\n` +
      `💰 <b>Общая стоимость:</b> ${raid.price} ${raid.currency}\n` +
      `👥 <b>Участников:</b> ${participantCount} чел.\n` +
      `💵 <b>С человека:</b> ${pricePerPerson} ${raid.currency}\n\n` +
      `📄 <b>Описание:</b>\n${raid.description || 'Описание не указано'}\n\n` +
      `🔗 <b>Ссылка:</b> ${raid.link || 'Не указана'}\n\n` +
      `📅 <b>Дата окончания:</b> ${raid.end_date ? new Date(raid.end_date).toLocaleDateString('ru-RU') : 'Не указана'}\n\n` +
      `👥 <b>Участники:</b>\n${participantsText}\n\n` +
      `📊 <b>Статус:</b> ${raid.status === 'open' ? '🟢 Открыт' : '🔴 Закрыт'}`;

    let keyboard;
    if (isCreator) {
      keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔒 Закрыть рейд', `raid_close_${raidId}`)],
        [Markup.button.callback('🔙 Назад', 'back_to_raids')]
      ]);
    } else if (isParticipating) {
      keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚪 Покинуть рейд', `raid_leave_${raidId}`)],
        [Markup.button.callback('🔙 Назад', 'back_to_raids')]
      ]);
    } else {
      keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('⚔️ Присоединиться к рейду', `raid_join_${raidId}`)],
        [Markup.button.callback('🔙 Назад', 'back_to_raids')]
      ]);
    }

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...keyboard
    });

  } catch (error) {
    console.error('Error getting raid info:', error);
    // Only use answerCbQuery if this is a callback query
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('❌ Произошла ошибка при получении информации о рейде', { show_alert: true });
    }
  }
};
