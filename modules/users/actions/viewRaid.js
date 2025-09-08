const { Composer, Markup } = require("telegraf");
const raidsService = require('../../raids/db/raidsService');

module.exports = Composer.action(/^viewRaid_(\d+)$/, async (ctx) => {
  try {
    const raidId = parseInt(ctx.match[1]);
    const userId = ctx.from.id;
    
    // Get raid details
    const raid = await raidsService.getRaidById(raidId);
    
    if (!raid) {
      await ctx.answerCbQuery('❌ Рейд не найден', { show_alert: true });
      return;
    }
    
    // Check if user is participating
    const isParticipating = raid.participants.some(p => p.user_id === userId);
    if (!isParticipating) {
      await ctx.answerCbQuery('❌ Вы не участвуете в этом рейде', { show_alert: true });
      return;
    }
    
    const participantCount = raid.participants ? raid.participants.length : 0;
    const pricePerPerson = participantCount > 0 ? (raid.price / participantCount).toFixed(2) : raid.price;
    const priceIfOneMore = participantCount > 0 ? (raid.price / (participantCount + 1)).toFixed(2) : raid.price;
    
    // Format participants list
    let participantsText = '';
    if (raid.participants && raid.participants.length > 0) {
      participantsText = raid.participants.map((p, index) => {
        const name = p.username ? `@${p.username}` : `${p.first_name} ${p.last_name}`.trim();
        const isMe = p.user_id === userId;
        return `${index + 1}. ${name}${isMe ? ' (Вы)' : ''}`;
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
      [Markup.button.callback('🚪 Покинуть рейд', `raid_leave_${raidId}`)],
      [Markup.button.callback('🔙 Назад к рейдам участия', 'userParticipatedRaids')]
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...keyboard
    });

  } catch (error) {
    console.error('Error in viewRaid:', error);
    await ctx.answerCbQuery(require('../../../modules/i18n').t('raids.common.loadError'), { show_alert: true });
  }
});
