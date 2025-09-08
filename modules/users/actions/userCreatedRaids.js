const { Composer, Markup } = require("telegraf");
const raidsService = require('../../raids/db/raidsService');
const { t } = require('../../../modules/i18n');

module.exports = Composer.action('userCreatedRaids', async (ctx) => {
  try {
    const userId = ctx.from.id;
    
    // Get user's created raids only
    const createdRaids = await raidsService.getUserCreatedRaids(userId, {});
    console.log('🔍 userCreatedRaids: userId =', userId, 'createdRaids count =', createdRaids.length);
    if (createdRaids.length > 0) {
      console.log('🔍 Created raids:', createdRaids.map(r => ({ id: r.id, created_by: r.created_by, title: r.title })));
    }
    
    if (createdRaids.length === 0) {
      const message = `📝 <b>СОЗДАННЫЕ РЕЙДЫ</b>\n\n` +
        `У вас пока нет созданных рейдов.\n\n` +
        `Создайте рейд командой: <code>Гоблины, на рейд!</code>`;

      const keyboard = Markup.inlineKeyboard([[Markup.button.callback(t('raids.menu.buttons.back'), 'userRaids')]]);

      await ctx.editMessageText(message, {
        parse_mode: 'HTML',
        ...keyboard
      });
      return;
    }

    // Separate active and closed raids
    const activeRaids = createdRaids.filter(raid => raid.status === 'open');
    const closedRaids = createdRaids.filter(raid => raid.status === 'closed');

    let message = `📝 <b>СОЗДАННЫЕ РЕЙДЫ</b>\n\n`;
    
    if (activeRaids.length > 0) {
      message += `🟢 <b>Активные рейды (${activeRaids.length}):</b>\n`;
      activeRaids.forEach((raid, index) => {
        const participantCount = raid.participants ? raid.participants.length : 0;
        const pricePerPerson = participantCount > 0 ? (raid.price / participantCount).toFixed(2) : raid.price;
        message += `${index + 1}. <b>Рейд #${raid.id}</b> - ${raid.price} ${raid.currency}\n`;
        message += `   👥 ${participantCount} участников • ${pricePerPerson} ${raid.currency}/чел\n`;
        message += `   📅 ${new Date(raid.created_at).toLocaleDateString('ru-RU')}\n\n`;
      });
    }
    
    if (closedRaids.length > 0) {
      message += `🔴 <b>Закрытые рейды (${closedRaids.length}):</b>\n`;
      closedRaids.forEach((raid, index) => {
        const participantCount = raid.participants ? raid.participants.length : 0;
        message += `${index + 1}. <b>Рейд #${raid.id}</b> - ${raid.price} ${raid.currency}\n`;
        message += `   👥 ${participantCount} участников\n`;
        message += `   📅 ${new Date(raid.created_at).toLocaleDateString('ru-RU')}\n\n`;
      });
    }

    const keyboard = Markup.inlineKeyboard([
      ...activeRaids.slice(0, 5).map(raid => [Markup.button.callback(`⚔️ Рейд #${raid.id}`, `manageRaid_${raid.id}`)]),
      [Markup.button.callback(t('raids.menu.buttons.back'), 'userRaids')]
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...keyboard
    });

  } catch (error) { console.error('Error in userCreatedRaids:', error); await ctx.answerCbQuery(t('raids.common.loadError'), { show_alert: true }); }
});
