const { Composer, Markup } = require("telegraf");
const raidsService = require('../../raids/db/raidsService');

module.exports = Composer.action(/^editRaidTitle_(\d+)$/, async (ctx) => {
  try {
    const raidId = parseInt(ctx.match[1]);
    const userId = ctx.from.id;
    
    // Get raid details
    const raid = await raidsService.getRaidById(raidId);
    
    if (!raid) {
      await ctx.answerCbQuery('❌ Рейд не найден', { show_alert: true });
      return;
    }
    
    // Check if user is the creator
    if (raid.created_by != userId) {
      await ctx.answerCbQuery('❌ Вы не можете редактировать этот рейд', { show_alert: true });
      return;
    }
    
    // Store the raid ID in session for the next message
    ctx.session.editingRaid = {
      id: raidId,
      field: 'title'
    };
    
    const message = `✏️ <b>РЕДАКТИРОВАНИЕ НАЗВАНИЯ РЕЙДА #${raid.id}</b>\n\n` +
      `Текущее название: <b>${raid.title}</b>\n\n` +
      `Отправьте новое название рейда:`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('❌ Отмена', `editRaid_${raidId}`)]
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      ...keyboard
    });
    
  } catch (error) {
    console.error('Error in editRaidTitle:', error);
    await ctx.answerCbQuery(require('../../../modules/i18n').t('raids.common.loadError'), { show_alert: true });
  }
});
