const { Composer, Markup } = require("telegraf");
const raidsService = require('../../raids/db/raidsService');

module.exports = Composer.action(/^editRaidDate_(\d+)$/, async (ctx) => {
  try {
    const raidId = parseInt(ctx.match[1]);
    const userId = ctx.from.id;
    
    const raid = await raidsService.getRaidById(raidId);
    
    if (!raid || raid.created_by != userId) {
      await ctx.answerCbQuery('❌ Рейд не найден или вы не можете его редактировать', { show_alert: true });
      return;
    }
    
    ctx.session.editingRaid = { id: raidId, field: 'date' };
    
    const message = `✏️ <b>РЕДАКТИРОВАНИЕ ДАТЫ ОКОНЧАНИЯ РЕЙДА #${raid.id}</b>\n\n` +
      `Текущая дата: ${raid.end_date ? new Date(raid.end_date).toLocaleDateString('ru-RU') : 'Не указана'}\n\n` +
      `Отправьте новую дату окончания (например: 2025-12-31):`;
    
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', `editRaid_${raidId}`)]
      ])
    });
    
  } catch (error) {
    console.error('Error in editRaidDate:', error);
    await ctx.answerCbQuery(require('../../../modules/i18n').t('raids.common.loadError'), { show_alert: true });
  }
});
