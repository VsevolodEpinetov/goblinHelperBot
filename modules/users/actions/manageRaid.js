const { Composer, Markup } = require("telegraf");
const { t } = require('../../../modules/i18n');
const raidsService = require('../../raids/db/raidsService');

module.exports = Composer.action(/^manageRaid_(\d+)$/, async (ctx) => {
  try {
    const raidId = parseInt(ctx.match[1]);
    const userId = ctx.from.id;
    
    console.log('🔍 manageRaid: Full ctx.from =', ctx.from);
    console.log('🔍 manageRaid: ctx.from.id =', userId, 'type:', typeof userId);
    
    // Get raid details
    const raid = await raidsService.getRaidById(raidId);
    
    if (!raid) { await ctx.answerCbQuery(t('raids.common.notFound'), { show_alert: true }); return; }
    
    // Check if user is the creator
    console.log('🔍 manageRaid: userId =', userId, 'type:', typeof userId);
    console.log('🔍 manageRaid: raid.created_by =', raid.created_by, 'type:', typeof raid.created_by);
    console.log('🔍 manageRaid: strict equality =', raid.created_by === userId);
    console.log('🔍 manageRaid: loose equality =', raid.created_by == userId);
    
    if (raid.created_by != userId) { console.log('❌ User not eligible to edit raid:', { userId, created_by: raid.created_by }); await ctx.answerCbQuery(t('raids.common.noPermission'), { show_alert: true }); return; }
    
    const participantCount = raid.participants ? raid.participants.length : 0;
    const pricePerPerson = participantCount > 0 ? (raid.price / participantCount).toFixed(2) : raid.price;
    const priceIfOneMore = participantCount > 0 ? (raid.price / (participantCount + 1)).toFixed(2) : raid.price;
    
    // Format participants list
    let participantsText = '';
    if (raid.participants && raid.participants.length > 0) {
      participantsText = raid.participants.map((p, index) => {
        const name = p.username ? `@${p.username}` : `${p.first_name} ${p.last_name}`.trim();
        return `${index + 1}. ${name}`;
      }).join('\n');
    } else {
      participantsText = 'Пока никто не присоединился';
    }

    const message = `⚔️ <b>УПРАВЛЕНИЕ РЕЙДОМ #${raid.id}</b>\n\n` +
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
      [Markup.button.callback('👥 Управление участниками', `raidParticipants_${raidId}`)],
      [Markup.button.callback('✏️ Редактировать рейд', `editRaid_${raidId}`)],
      [Markup.button.callback('🔒 Закрыть рейд', `closeRaid_${raidId}`)],
      [Markup.button.callback(t('raids.buttons.backToCreated'), 'userCreatedRaids')]
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...keyboard
    });

  } catch (error) { console.error('Error in manageRaid:', error); await ctx.answerCbQuery(t('raids.common.loadError'), { show_alert: true }); }
});
