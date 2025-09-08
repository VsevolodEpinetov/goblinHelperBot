const { Composer, Markup } = require("telegraf");
const raidsService = require('../../raids/db/raidsService');

module.exports = Composer.action('userParticipatedRaids', async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    // Get user's participated raids (where they're not the creator)
    const allUserRaids = await raidsService.getUserRaids(userId, {});
    console.log('🔍 All user raids:', allUserRaids.length);
    const participatedRaids = allUserRaids.filter(raid => raid.created_by !== userId);
    console.log('🔍 Participated raids:', participatedRaids.length);
    
    if (participatedRaids.length === 0) {
      const message = `👥 <b>УЧАСТВУЮ В РЕЙДАХ</b>\n\n` +
        `Вы пока не участвуете ни в одном рейде.\n\n` +
        `Найдите интересные рейды в канале и присоединяйтесь!`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад к рейдам', 'userRaids')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...keyboard
      });
      return;
    }

    // Separate active and closed raids
    const activeRaids = participatedRaids.filter(raid => raid.status === 'open');
    const closedRaids = participatedRaids.filter(raid => raid.status === 'closed');

    let message = `👥 <b>УЧАСТВУЮ В РЕЙДАХ</b>\n\n`;
    
    if (activeRaids.length > 0) {
      message += `🟢 <b>Активные рейды (${activeRaids.length}):</b>\n`;
      activeRaids.forEach((raid, index) => {
        const participantCount = raid.participants ? raid.participants.length : 0;
        const pricePerPerson = participantCount > 0 ? (raid.price / participantCount).toFixed(2) : raid.price;
        message += `${index + 1}. <b>Рейд #${raid.id}</b> - ${raid.price} ${raid.currency}\n`;
        message += `   👥 ${participantCount} участников • ${pricePerPerson} ${raid.currency}/чел\n`;
        message += `   👤 Создатель: ${raid.created_by_username || 'Неизвестно'}\n`;
        message += `   📅 ${new Date(raid.created_at).toLocaleDateString('ru-RU')}\n\n`;
      });
    }
    
    if (closedRaids.length > 0) {
      message += `🔴 <b>Закрытые рейды (${closedRaids.length}):</b>\n`;
      closedRaids.forEach((raid, index) => {
        const participantCount = raid.participants ? raid.participants.length : 0;
        message += `${index + 1}. <b>Рейд #${raid.id}</b> - ${raid.price} ${raid.currency}\n`;
        message += `   👥 ${participantCount} участников\n`;
        message += `   👤 Создатель: ${raid.created_by_username || 'Неизвестно'}\n`;
        message += `   📅 ${new Date(raid.created_at).toLocaleDateString('ru-RU')}\n\n`;
      });
    }

    const keyboard = Markup.inlineKeyboard([
      ...activeRaids.slice(0, 5).map(raid => [
        Markup.button.callback(`⚔️ Рейд #${raid.id}`, `viewRaid_${raid.id}`)
      ]),
      [Markup.button.callback('🔙 Назад к рейдам', 'userRaids')]
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...keyboard
    });

  } catch (error) {
    console.error('Error in userParticipatedRaids:', error);
    await ctx.answerCbQuery(require('../../../modules/i18n').t('raids.common.loadError'), { show_alert: true });
  }
});
